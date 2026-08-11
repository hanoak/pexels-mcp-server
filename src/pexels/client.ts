import type { Config } from '../config.js'
import { logger } from '../lib/logger.js'
import { createRedactor } from '../lib/redact.js'
import { USER_AGENT } from '../version.js'
import { type PexelsErrorKind, PexelsApiError, type RateLimitInfo } from './errors.js'

// Every documented Pexels endpoint (photos, videos, collections) lives under
// /v1/ — bake it into the base URL so tool call sites pass version-free
// resource paths (e.g. '/search', '/videos/popular') and can't typo the prefix.
const DEFAULT_BASE_URL = 'https://api.pexels.com/v1'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RETRIES = 2
const BASE_BACKOFF_MS = 300
const MAX_BACKOFF_MS = 8_000
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

export interface PexelsClientOptions {
  /** Injectable fetch implementation (defaults to the global `fetch`). */
  readonly fetch?: typeof fetch
  readonly baseUrl?: string
  readonly timeoutMs?: number
  readonly maxRetries?: number
  /** Injectable sleep (tests pass a no-op to avoid real backoff delays). */
  readonly sleep?: (ms: number) => Promise<void>
}

export type QueryValue = string | number | boolean | undefined
export type QueryParams = Record<string, QueryValue>

export interface GetOptions {
  readonly params?: QueryParams
  /** Abort signal from the caller (e.g. MCP cancellation); aborts are not retried. */
  readonly signal?: AbortSignal
}

export interface PexelsResponse<T = unknown> {
  /** Parsed JSON body. Callers validate the shape with a zod schema. */
  readonly data: T
  readonly rateLimit: RateLimitInfo
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Thin HTTP client for the Pexels API. Sends the required Authorization
 * header, enforces a timeout, retries transient failures with backoff,
 * tracks rate-limit state across calls, and maps failures to a typed
 * {@link PexelsApiError}.
 *
 * It performs no response validation — callers validate `data` with a zod
 * schema so upstream field changes degrade gracefully.
 */
export class PexelsClient {
  readonly #apiKey: string
  readonly #fetch: typeof fetch
  readonly #baseUrl: string
  readonly #timeoutMs: number
  readonly #maxRetries: number
  readonly #sleep: (ms: number) => Promise<void>
  readonly #redact: (input: string) => string
  // Pexels omits the rate-limit headers on a 429 response, so the last value
  // seen on a prior response is cached to (a) report an accurate reset time
  // once the quota is hit, and (b) short-circuit further calls once the
  // quota is known to be exhausted, instead of firing a request we already
  // know will fail.
  #lastRateLimit: RateLimitInfo | undefined

  constructor(config: Config, options: PexelsClientOptions = {}) {
    this.#apiKey = config.apiKey
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    this.#sleep = options.sleep ?? defaultSleep
    this.#redact = createRedactor(config.apiKey)
  }

  /** Perform an authenticated GET, retrying transient failures. */
  async get<T = unknown>(path: string, options: GetOptions = {}): Promise<PexelsResponse<T>> {
    const quotaError = this.#quotaExhaustedError()
    if (quotaError) throw quotaError

    const url = this.#buildUrl(path, options.params)
    let attempt = 0

    for (;;) {
      try {
        const response = await this.#fetchWithTimeout(url, options.signal)
        const rateLimit = this.#recordRateLimit(response.headers)

        if (response.ok) {
          const data = (await response.json()) as T
          logger.debug(
            `GET ${path} -> ${response.status} (remaining: ${rateLimit.remaining ?? '?'})`,
          )
          return { data, rateLimit }
        }

        if (RETRYABLE_STATUSES.has(response.status) && attempt < this.#maxRetries) {
          const delay = retryDelay(response, attempt)
          attempt += 1
          logger.warn(
            `GET ${path} -> ${response.status}; retry ${attempt}/${this.#maxRetries} in ${delay}ms`,
          )
          await this.#sleep(delay)
          continue
        }

        throw await this.#mapErrorResponse(response, rateLimit)
      } catch (error) {
        if (error instanceof PexelsApiError) throw error

        // A caller-initiated abort is never retried.
        if (options.signal?.aborted) {
          throw new PexelsApiError('network', this.#redact('Request was cancelled'), {
            cause: error,
          })
        }

        const kind: PexelsErrorKind = isTimeout(error) ? 'timeout' : 'network'
        if (attempt < this.#maxRetries) {
          const delay = backoff(attempt)
          attempt += 1
          logger.warn(
            `GET ${path} failed (${kind}); retry ${attempt}/${this.#maxRetries} in ${delay}ms`,
          )
          await this.#sleep(delay)
          continue
        }

        const message =
          kind === 'timeout'
            ? `Pexels request timed out after ${this.#timeoutMs}ms.`
            : 'Pexels request failed: could not reach the Pexels API.'
        throw new PexelsApiError(kind, this.#redact(message), { cause: error })
      }
    }
  }

  #buildUrl(path: string, params?: QueryParams): string {
    const url = new URL(`${this.#baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  #fetchWithTimeout(url: string, external?: AbortSignal): Promise<Response> {
    const timeout = AbortSignal.timeout(this.#timeoutMs)
    const signal = external ? AbortSignal.any([timeout, external]) : timeout
    return this.#fetch(url, {
      method: 'GET',
      headers: {
        // Pexels takes the raw key with no scheme prefix — header form keeps
        // it out of loggable URLs.
        Authorization: this.#apiKey,
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
      signal,
    })
  }

  /** Read the rate-limit headers and cache them if this response carried any. */
  #recordRateLimit(headers: Headers): RateLimitInfo {
    const rateLimit = readRateLimit(headers)
    if (rateLimit.limit !== undefined || rateLimit.remaining !== undefined) {
      this.#lastRateLimit = rateLimit
    }
    return rateLimit
  }

  /**
   * Pre-flight check: if a prior response told us the quota is exhausted and
   * the reset window hasn't passed yet, refuse the call outright instead of
   * spending a request (and retry attempts) on something that will just 429.
   */
  #quotaExhaustedError(): PexelsApiError | undefined {
    const rl = this.#lastRateLimit
    if (!rl || rl.remaining !== 0 || rl.resetEpoch === undefined) return undefined
    if (Date.now() >= rl.resetEpoch * 1000) return undefined
    const resetIso = new Date(rl.resetEpoch * 1000).toISOString()
    return new PexelsApiError(
      'rate_limit',
      `Pexels rate limit quota exhausted. Resets at ${resetIso}.`,
      { rateLimit: rl },
    )
  }

  async #mapErrorResponse(response: Response, rateLimit: RateLimitInfo): Promise<PexelsApiError> {
    const status = response.status
    const detail = await this.#extractDetail(response)
    const suffix = detail ? `: ${detail}` : ''
    // A 429 omits the rate-limit headers, so fall back to the last known
    // values (from a prior 2xx) to report an accurate reset time.
    const effectiveRateLimit =
      rateLimit.limit !== undefined || rateLimit.remaining !== undefined
        ? rateLimit
        : (this.#lastRateLimit ?? rateLimit)

    let kind: PexelsErrorKind
    let message: string

    if (status === 401) {
      kind = 'auth'
      message = `Pexels rejected the API key (401). Check that PEXELS_API_KEY is valid${suffix}.`
    } else if (status === 403) {
      kind = 'forbidden'
      message = `Pexels returned 403 Forbidden${suffix}.`
    } else if (status === 404) {
      kind = 'not_found'
      message = `Pexels resource not found (404)${suffix}.`
    } else if (status === 429) {
      kind = 'rate_limit'
      const resetNote =
        effectiveRateLimit.resetEpoch !== undefined
          ? ` Resets at ${new Date(effectiveRateLimit.resetEpoch * 1000).toISOString()}.`
          : ''
      message = `Pexels rate limit hit (429) after ${this.#maxRetries} retries.${resetNote}`
    } else if (status === 400 || status === 422) {
      kind = 'bad_request'
      message = `Pexels rejected the request (${status})${suffix}.`
    } else if (status >= 500) {
      kind = 'server'
      message = `Pexels server error (${status})${suffix}. This is usually transient.`
    } else {
      kind = 'unknown'
      message = `Pexels request failed (${status})${suffix}.`
    }

    return new PexelsApiError(kind, this.#redact(message), {
      status,
      rateLimit: effectiveRateLimit,
    })
  }

  /** Best-effort extraction of Pexels' `{ "error": "..." }` body, redacted. */
  async #extractDetail(response: Response): Promise<string> {
    let body: string
    try {
      body = await response.text()
    } catch {
      return ''
    }
    if (!body) return ''
    try {
      const parsed: unknown = JSON.parse(body)
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof (parsed as { error: unknown }).error === 'string'
      ) {
        return this.#redact((parsed as { error: string }).error)
      }
    } catch {
      // Not JSON — fall through to the raw (truncated) body.
    }
    return this.#redact(body.slice(0, 200))
  }
}

function readRateLimit(headers: Headers): RateLimitInfo {
  return {
    limit: parseHeaderInt(headers.get('x-ratelimit-limit')),
    remaining: parseHeaderInt(headers.get('x-ratelimit-remaining')),
    resetEpoch: parseHeaderInt(headers.get('x-ratelimit-reset')),
  }
}

function parseHeaderInt(value: string | null): number | undefined {
  if (value === null) return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

function retryDelay(response: Response, attempt: number): number {
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    if (retryAfter !== null) {
      const seconds = Number(retryAfter)
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, MAX_BACKOFF_MS)
      }
    }
  }
  return backoff(attempt)
}

function backoff(attempt: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
  const jitter = Math.floor(Math.random() * 100)
  return base + jitter
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError'
}

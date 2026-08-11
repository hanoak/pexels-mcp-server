/**
 * Classification of a failed Pexels request. The tool layer maps these to
 * MCP `isError` results with actionable messages the model can act on.
 */
export type PexelsErrorKind =
  | 'auth' // 401 — bad/rejected API key
  | 'forbidden' // 403
  | 'rate_limit' // 429, or a pre-emptive quota-exhausted short-circuit
  | 'not_found' // 404
  | 'bad_request' // 400 / 422 — invalid parameters
  | 'server' // 5xx — usually transient
  | 'timeout' // request exceeded the client timeout
  | 'network' // fetch failed / connection error / cancelled
  | 'unknown' // anything else

export interface RateLimitInfo {
  /** `X-Ratelimit-Limit` header, if present. */
  readonly limit: number | undefined
  /** `X-Ratelimit-Remaining` header, if present. */
  readonly remaining: number | undefined
  /**
   * `X-Ratelimit-Reset` header (unix seconds), if present. Pexels omits all
   * three rate-limit headers on a 429 response, so this is often the last
   * value seen on a prior successful response rather than a fresh one.
   */
  readonly resetEpoch: number | undefined
}

export interface PexelsApiErrorOptions {
  readonly status?: number
  readonly rateLimit?: RateLimitInfo
  readonly cause?: unknown
}

/**
 * Error used for any Pexels-related failure — thrown by {@link PexelsClient}
 * (most, but not all, of its throw sites redact the message) or by
 * tool-layer input validation (never redacted). `toToolError` applies
 * redaction unconditionally as the actual safety net; don't assume a
 * message here is already clean just because it came from the client.
 */
export class PexelsApiError extends Error {
  readonly kind: PexelsErrorKind
  readonly status: number | undefined
  readonly rateLimit: RateLimitInfo | undefined

  constructor(kind: PexelsErrorKind, message: string, options: PexelsApiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'PexelsApiError'
    this.kind = kind
    this.status = options.status
    this.rateLimit = options.rateLimit
  }
}

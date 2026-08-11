import { describe, expect, it } from 'vitest'

import type { Config } from '../../src/config.js'
import { PexelsClient } from '../../src/pexels/client.js'
import { PexelsApiError } from '../../src/pexels/errors.js'

const config: Config = { apiKey: 'test-api-key-123' }

const noopSleep = async (): Promise<void> => {}

interface Recorded {
  url: string
  init: RequestInit
}

function fakeFetch(responder: (call: number) => Response | Promise<Response>) {
  const calls: Recorded[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return responder(calls.length - 1)
  }) as unknown as typeof fetch
  return { fn, calls }
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

async function catchError(promise: Promise<unknown>): Promise<PexelsApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof PexelsApiError) return error
    throw error
  }
  throw new Error('expected the promise to reject')
}

describe('PexelsClient.get', () => {
  it('sends the required headers and returns parsed data + rate limit', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse(
        { id: 'abc' },
        {
          headers: {
            'x-ratelimit-limit': '200',
            'x-ratelimit-remaining': '199',
            'x-ratelimit-reset': '1700000000',
          },
        },
      ),
    )
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

    const res = await client.get<{ id: string }>('/photos/abc')

    expect(res.data).toEqual({ id: 'abc' })
    expect(res.rateLimit).toEqual({ limit: 200, remaining: 199, resetEpoch: 1700000000 })

    const headers = new Headers(calls[0]!.init.headers)
    // Pexels takes the raw key, no scheme prefix (unlike Unsplash's `Client-ID`).
    expect(headers.get('authorization')).toBe('test-api-key-123')
    expect(headers.get('accept-version')).toBeNull()
    expect(headers.get('user-agent')).toContain('pexels-mcp-server/')
  })

  it('serializes query params and skips undefined values', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ photos: [] }))
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

    await client.get('/search', {
      params: { query: 'cats', page: 1, orientation: undefined },
    })

    const url = new URL(calls[0]!.url)
    // /v1 is baked into the client's base URL, not the caller-supplied path.
    expect(url.pathname).toBe('/v1/search')
    expect(url.searchParams.get('query')).toBe('cats')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.has('orientation')).toBe(false)
  })

  it('maps 401 to an auth error', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ error: 'Invalid API key' }, { status: 401 }))
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/photos/abc'))
    expect(error.kind).toBe('auth')
    expect(error.status).toBe(401)
  })

  it('maps 403 to a forbidden error regardless of remaining quota (no Unsplash-style 403 quota quirk)', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    )
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/curated'))
    expect(error.kind).toBe('forbidden')
    expect(error.status).toBe(403)
  })

  it('maps 404 to a not_found error', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ error: 'Not found' }, { status: 404 }))
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/photos/missing'))
    expect(error.kind).toBe('not_found')
  })

  it('retries a 429 then succeeds', async () => {
    const responses = [
      jsonResponse(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'retry-after': '0' } },
      ),
      jsonResponse({ ok: true }),
    ]
    const { fn, calls } = fakeFetch((i) => responses[i]!)
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 2 })

    const res = await client.get<{ ok: boolean }>('/x')
    expect(res.data).toEqual({ ok: true })
    expect(calls.length).toBe(2)
  })

  it('honors Retry-After (seconds) on a 429', async () => {
    const delays: number[] = []
    const responses = [
      jsonResponse({}, { status: 429, headers: { 'retry-after': '2' } }),
      jsonResponse({ ok: true }),
    ]
    const { fn } = fakeFetch((i) => responses[i]!)
    const client = new PexelsClient(config, {
      fetch: fn,
      sleep: async (ms) => {
        delays.push(ms)
      },
      maxRetries: 2,
    })

    await client.get('/x')
    expect(delays[0]).toBe(2000)
  })

  it('exhausts retries on a 429 and reports the cached reset time (headers are absent on the 429 itself)', async () => {
    const responses = [
      jsonResponse(
        { ok: true },
        {
          headers: {
            'x-ratelimit-limit': '200',
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': '1700000000',
          },
        },
      ),
      // The 429 itself carries none of the rate-limit headers.
      jsonResponse({ error: 'Rate limit exceeded' }, { status: 429 }),
    ]
    const { fn, calls } = fakeFetch((i) => responses[Math.min(i, 1)]!)
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 0 })

    // First call populates the cache with remaining=0 and a reset time, but
    // doesn't trip the short-circuit yet (that only applies to the *next* call).
    await client.get('/x')

    const error = await catchError(client.get('/x'))
    expect(error.kind).toBe('rate_limit')
    expect(error.status).toBe(429)
    expect(error.message).toContain('2023-11-14T22:13:20.000Z')
    expect(calls.length).toBe(2)
  })

  it('exhausts retries on 5xx and throws a server error', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({}, { status: 503 }))
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 1 })

    const error = await catchError(client.get('/x'))
    expect(error.kind).toBe('server')
    expect(calls.length).toBe(2) // initial attempt + 1 retry
  })

  it('redacts the API key from error messages', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({ error: 'rejected token test-api-key-123' }, { status: 400 }),
    )
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/x'))
    expect(error.message).not.toContain('test-api-key-123')
    expect(error.message).toContain('[REDACTED]')
  })

  it('maps a timeout to a timeout error', async () => {
    const { fn, calls } = fakeFetch(() => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    })
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 0 })

    const error = await catchError(client.get('/x'))
    expect(error.kind).toBe('timeout')
    expect(calls.length).toBe(1)
  })

  it('retries a network failure then succeeds', async () => {
    let firstCall = true
    const { fn, calls } = fakeFetch(() => {
      if (firstCall) {
        firstCall = false
        throw new TypeError('fetch failed')
      }
      return jsonResponse({ ok: true })
    })
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 2 })

    const res = await client.get<{ ok: boolean }>('/x')
    expect(res.data).toEqual({ ok: true })
    expect(calls.length).toBe(2)
  })

  it('does not retry when the caller aborts', async () => {
    const controller = new AbortController()
    controller.abort()
    const { fn, calls } = fakeFetch(() => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })
    const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 3 })

    const error = await catchError(client.get('/x', { signal: controller.signal }))
    expect(error.kind).toBe('network')
    expect(calls.length).toBe(1)
  })

  describe('quota short-circuit', () => {
    it('refuses further calls once remaining=0 and the reset window is in the future, without hitting fetch', async () => {
      const futureReset = Math.floor(Date.now() / 1000) + 3600
      const { fn, calls } = fakeFetch(() =>
        jsonResponse(
          { ok: true },
          {
            headers: {
              'x-ratelimit-limit': '200',
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(futureReset),
            },
          },
        ),
      )
      const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

      await client.get('/x')
      expect(calls.length).toBe(1)

      const error = await catchError(client.get('/x'))
      expect(error.kind).toBe('rate_limit')
      expect(error.message).toContain('Resets at')
      // The short-circuit never called fetch a second time.
      expect(calls.length).toBe(1)
    })

    it('allows a call through once the cached reset time has passed', async () => {
      const pastReset = Math.floor(Date.now() / 1000) - 10
      const responses = [
        jsonResponse(
          { ok: true },
          {
            headers: {
              'x-ratelimit-limit': '200',
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(pastReset),
            },
          },
        ),
        jsonResponse({ ok: true }),
      ]
      const { fn, calls } = fakeFetch((i) => responses[i]!)
      const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

      await client.get('/x')
      await client.get('/x')
      expect(calls.length).toBe(2)
    })

    it('does not short-circuit when remaining is still positive', async () => {
      const { fn, calls } = fakeFetch(() =>
        jsonResponse(
          { ok: true },
          { headers: { 'x-ratelimit-limit': '200', 'x-ratelimit-remaining': '5' } },
        ),
      )
      const client = new PexelsClient(config, { fetch: fn, sleep: noopSleep })

      await client.get('/x')
      await client.get('/x')
      expect(calls.length).toBe(2)
    })
  })
})

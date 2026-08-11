import { describe, expect, it } from 'vitest'

import { createRedactor, redactSecret } from '../../src/lib/redact.js'

describe('redactSecret', () => {
  it('replaces every occurrence of the secret', () => {
    const out = redactSecret('key=SECRET123 and again SECRET123', 'SECRET123')
    expect(out).toBe('key=[REDACTED] and again [REDACTED]')
    expect(out).not.toContain('SECRET123')
  })

  it('returns the input unchanged when the secret is undefined', () => {
    expect(redactSecret('nothing to hide', undefined)).toBe('nothing to hide')
  })

  it('ignores trivially short secrets to avoid over-redaction', () => {
    expect(redactSecret('a b c a', 'a')).toBe('a b c a')
  })
})

describe('createRedactor', () => {
  it('binds the secret for reuse', () => {
    const redact = createRedactor('SECRET123')
    expect(redact('x SECRET123 y')).toBe('x [REDACTED] y')
    expect(redact('no secret here')).toBe('no secret here')
  })

  it('redacts every secret when bound to multiple', () => {
    const redact = createRedactor('access-key-123', 'user-token-456')
    expect(redact('key=access-key-123 token=user-token-456')).toBe(
      'key=[REDACTED] token=[REDACTED]',
    )
  })

  it('skips undefined secrets without throwing', () => {
    const redact = createRedactor('access-key-123', undefined)
    expect(redact('key=access-key-123')).toBe('key=[REDACTED]')
  })

  it('returns the input unchanged when bound to no secrets', () => {
    const redact = createRedactor()
    expect(redact('nothing to hide')).toBe('nothing to hide')
  })
})

import { describe, expect, it } from 'vitest'

import { ConfigError, loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('returns config for a valid API key', () => {
    const cfg = loadConfig({ PEXELS_API_KEY: 'abc123def456' })
    expect(cfg.apiKey).toBe('abc123def456')
  })

  it('trims surrounding whitespace from the key', () => {
    const cfg = loadConfig({ PEXELS_API_KEY: '  abc123def456  ' })
    expect(cfg.apiKey).toBe('abc123def456')
  })

  it('ignores unrelated environment variables', () => {
    const cfg = loadConfig({ PEXELS_API_KEY: 'abc123def456', PATH: '/usr/bin', HOME: '/root' })
    expect(cfg).toEqual({ apiKey: 'abc123def456' })
  })

  it('throws ConfigError when the key is missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError)
  })

  it('throws ConfigError when the key is blank/whitespace', () => {
    expect(() => loadConfig({ PEXELS_API_KEY: '   ' })).toThrow(ConfigError)
  })

  it('includes actionable guidance in the missing-key message', () => {
    let message = ''
    try {
      loadConfig({})
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('PEXELS_API_KEY')
    expect(message).toContain('pexels.com/api')
  })
})

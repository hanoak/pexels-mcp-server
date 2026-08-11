import { describe, expect, it } from 'vitest'

import type { Config } from '../src/config.js'
import { logger } from '../src/lib/logger.js'
import { PexelsClient } from '../src/pexels/client.js'
import { createServer, SERVER_NAME, SERVER_VERSION } from '../src/server.js'

const config: Config = { apiKey: 'test-key' }
const ctx = { client: new PexelsClient(config), config, redact: (s: string) => s }

describe('createServer', () => {
  it('constructs a connectable MCP server instance', () => {
    const server = createServer(ctx)
    expect(server).toBeDefined()
    // The SDK exposes the low-level Server via `.server`.
    expect(server.server).toBeDefined()
  })

  it('exposes stable server identity metadata', () => {
    expect(SERVER_NAME).toBe('pexels-mcp-server')
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('logger', () => {
  it('exposes all level methods', () => {
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      expect(typeof logger[level]).toBe('function')
    }
  })
})

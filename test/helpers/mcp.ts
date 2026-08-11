import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import type { Config } from '../../src/config.js'
import { PexelsClient } from '../../src/pexels/client.js'
import { createServer } from '../../src/server.js'

/** Shared test config (fake key). */
export const testConfig: Config = { apiKey: 'test-key' }

export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

/** Fake fetch that records the requested URLs and returns `responder()` each call. */
export function fakeFetch(responder: () => Response) {
  const calls: string[] = []
  const fn = (async (input: string | URL | Request) => {
    calls.push(String(input))
    return responder()
  }) as unknown as typeof fetch
  return { fn, calls }
}

/** Spin up a real MCP Client wired to our server over in-memory transports. */
export async function connect(fetchImpl: typeof fetch): Promise<Client> {
  const client = new PexelsClient(testConfig, { fetch: fetchImpl, sleep: async () => {} })
  const server = createServer({ client, config: testConfig, redact: (s) => s })
  const mcpClient = new Client({ name: 'test', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await mcpClient.connect(clientTransport)
  return mcpClient
}

/** Parse the first text content block of a tool result as JSON. */
export function parseResult(res: CallToolResult): unknown {
  const content = res.content as Array<{ type: string; text: string }>
  return JSON.parse(content[0]!.text)
}

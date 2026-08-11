import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadConfig } from './config.js'
import { logger } from './lib/logger.js'
import { createRedactor } from './lib/redact.js'
import { PexelsClient } from './pexels/client.js'
import { registerTools, type ToolContext } from './tools/index.js'
import { PACKAGE_NAME, PACKAGE_VERSION } from './version.js'

/** Server identity reported to MCP clients (sourced from the shared version module). */
export const SERVER_NAME = PACKAGE_NAME
export const SERVER_VERSION = PACKAGE_VERSION

/**
 * Server-wide guidance sent to clients on `initialize`. Placeholder until the
 * tool surface exists — replaced with the real license/usage guidance once
 * the photos/videos/collections domains are in (see docs/ROADMAP.md §11).
 */
export const SERVER_INSTRUCTIONS =
  'This server provides read-only access to the Pexels photo and video library.'

/**
 * Build the MCP server and register its tools against the injected context.
 * Pure and dependency-injected — tests pass a fake client via `ctx`.
 * Resources/prompts are registered here too once later units add them.
 */
export function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  )

  registerTools(server, ctx)

  return server
}

/**
 * Composition root: fail-fast validate the environment, build the Pexels
 * client, assemble the server, and wire it to the stdio transport.
 */
export async function runServer(): Promise<void> {
  // Fail fast: validate the environment before opening the transport, so a
  // missing key surfaces as a clear startup message, not a cryptic 401 later.
  const config = loadConfig()
  const client = new PexelsClient(config)
  const redact = createRedactor(config.apiKey)
  const server = createServer({ client, config, redact })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} started on stdio`)

  installShutdownHandlers()
}

/**
 * Exit cleanly when the client stops us: by signal, or by closing our stdin
 * (how MCP clients such as Claude Desktop terminate a spawned server). Without
 * this the process lingers as an orphan on every client restart.
 */
function installShutdownHandlers(): void {
  let shuttingDown = false
  const shutdown = (reason: string, code = 0): void => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`shutting down (${reason})`)
    process.exit(code)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.stdin.on('end', () => shutdown('stdin closed'))
  process.stdin.on('close', () => shutdown('stdin closed'))
}

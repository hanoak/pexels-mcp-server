import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadConfig } from './config.js'
import { logger } from './lib/logger.js'
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
 * Build the MCP server instance. Tools/resources/prompts are registered here
 * in later units; for now this returns a bare, connectable server so we have
 * a green, runnable baseline.
 */
export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  )

  // TODO: register Pexels tools, resources, and prompts (added in later units).

  return server
}

/** Create the server, wire the stdio transport, and install shutdown handlers. */
export async function runServer(): Promise<void> {
  // Fail fast: validate the environment before opening the transport, so a
  // missing key surfaces as a clear startup message, not a cryptic 401 later.
  loadConfig()

  const server = createServer()
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

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { Config } from '../config.js'
import type { PexelsClient } from '../pexels/client.js'

/**
 * Dependencies injected into every tool handler. Built by the composition
 * root (`runServer`) and passed through `createServer`.
 */
export interface ToolContext {
  readonly client: PexelsClient
  readonly config: Config
  /** Strips the API key from any text before it reaches a tool's isError result. */
  readonly redact: (input: string) => string
}

/**
 * Register all Pexels MCP tools onto the server. Each tool lives in its own
 * file under `src/tools/` and exposes a registrar this function calls, e.g.:
 *
 *   registerPhotoTools(server, ctx)
 *
 * No tools are implemented yet, so this is currently a no-op — but the seam
 * exists so tools land by adding one file + one call here, never by editing
 * `server.ts`.
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  // Intentionally unused until the first tool is added.
  void server
  void ctx
}

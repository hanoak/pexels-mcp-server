import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { Config } from '../config.js'
import type { PexelsClient } from '../pexels/client.js'
import { registerPhotoTools } from './photos.js'
import { registerVideoTools } from './videos.js'

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
 * file under `src/tools/` and exposes a registrar this function calls — tools
 * land by adding one file + one call here, never by editing `server.ts`.
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  registerPhotoTools(server, ctx)
  registerVideoTools(server, ctx)
}

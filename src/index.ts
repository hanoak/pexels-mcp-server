import { ConfigError } from './config.js'
import { nodeVersionError } from './lib/node-guard.js'
import { runServer } from './server.js'
import { PACKAGE_NAME, PACKAGE_VERSION } from './version.js'

/**
 * Entry point for the `pexels-mcp-server` bin. The tsup build prepends the
 * `#!/usr/bin/env node` shebang so this file is directly executable via npx.
 */

const HELP = `${PACKAGE_NAME} v${PACKAGE_VERSION}
A Model Context Protocol (MCP) server for the Pexels API.

This is a stdio server, meant to be launched by an MCP client (Claude Desktop,
Cursor, etc.) — not run directly. Configure it in your client and provide a
Pexels API key via the PEXELS_API_KEY environment variable.

Usage:
  pexels-mcp-server            Run the MCP server over stdio
  pexels-mcp-server --version  Print the version and exit
  pexels-mcp-server --help     Print this help and exit

Environment:
  PEXELS_API_KEY  (required)    your Pexels API key
  LOG_LEVEL       debug | info | warn | error (default: info)

Docs: https://github.com/hanoak/pexels-mcp-server`

// Last-resort crash guards. A stray throw must go to stderr, never stdout
// (which carries the JSON-RPC stream), and must exit non-zero.
function fatal(prefix: string, error: unknown): never {
  // Configuration problems are user-facing: print the guidance verbatim,
  // without the "fatal" framing or a stack trace.
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`[pexels-mcp-server] fatal: ${prefix}: ${detail}\n`)
  process.exit(1)
}

function main(): void {
  // Refuse to run on an unsupported Node.js with a clear message instead of a
  // cryptic crash mid-conversation when a newer API is missing.
  const versionError = nodeVersionError()
  if (versionError !== null) {
    process.stderr.write(`${versionError}\n`)
    process.exit(1)
  }

  const args = new Set(process.argv.slice(2))

  if (args.has('--version') || args.has('-v')) {
    process.stdout.write(`${PACKAGE_VERSION}\n`)
    return
  }
  if (args.has('--help') || args.has('-h')) {
    process.stdout.write(`${HELP}\n`)
    return
  }

  // Launched interactively in a terminal? The stdio JSON-RPC loop would just
  // hang waiting for input, so print usage and exit instead of appearing frozen.
  if (process.stdin.isTTY) {
    process.stderr.write(`${HELP}\n`)
    return
  }

  process.on('uncaughtException', (error) => fatal('uncaughtException', error))
  process.on('unhandledRejection', (reason) => fatal('unhandledRejection', reason))
  runServer().catch((error: unknown) => fatal('startup', error))
}

main()

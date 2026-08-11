import { createRequire } from 'node:module'

/**
 * Server/bin identity reported to MCP clients. `PACKAGE_VERSION` is read from
 * package.json's `version` field at startup — package.json is the single
 * source of truth, so there is no manual sync step (Changesets bumps it; the
 * running server reflects it). package.json is always shipped in the published
 * tarball and sits one level up from the bundled `dist/index.js`, so the
 * relative resolve holds both when installed and when run from source.
 * `PACKAGE_NAME` is the unscoped bin name (`pexels-mcp-server`) — NOT
 * package.json's scoped `name` field (`@hanoak/pexels-mcp-server`).
 */
const pkg = createRequire(import.meta.url)('../package.json') as {
  version: string
}

export const PACKAGE_NAME = 'pexels-mcp-server'
export const PACKAGE_VERSION = pkg.version

/** Descriptive User-Agent sent on every Pexels API request (good-citizen behaviour). */
export const USER_AGENT = `${PACKAGE_NAME}/${PACKAGE_VERSION} (+https://github.com/hanoak/pexels-mcp-server)`

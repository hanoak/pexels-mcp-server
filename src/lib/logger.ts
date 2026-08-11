/**
 * Minimal leveled logger.
 *
 * CRITICAL: In a stdio MCP server, stdout carries the JSON-RPC message stream.
 * Writing anything else to stdout corrupts it, so ALL log output goes to stderr.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const

export type LogLevel = keyof typeof LEVELS

function resolveLevel(): LogLevel {
  const raw = (process.env.LOG_LEVEL ?? 'info').toLowerCase()
  return raw in LEVELS ? (raw as LogLevel) : 'info'
}

function write(level: LogLevel, message: string): void {
  if (LEVELS[level] < LEVELS[resolveLevel()]) return
  // stderr only — never stdout.
  process.stderr.write(`[pexels-mcp-server] ${level}: ${message}\n`)
}

export const logger = {
  debug: (message: string): void => write('debug', message),
  info: (message: string): void => write('info', message),
  warn: (message: string): void => write('warn', message),
  error: (message: string): void => write('error', message),
}

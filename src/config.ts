import { z } from 'zod'

/**
 * Thrown when the server is misconfigured (e.g. a missing API key). The
 * message is user-facing guidance — the entry point prints it verbatim to
 * stderr and exits non-zero, rather than dumping a stack trace.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const EnvSchema = z.object({
  PEXELS_API_KEY: z.string().trim().min(1),
})

export interface Config {
  /** Pexels API key, sent as the `Authorization` header (no prefix). */
  readonly apiKey: string
}

/**
 * Load and validate configuration from the environment. Throws {@link ConfigError}
 * with actionable guidance when required values are missing — a fail-fast at
 * startup instead of a cryptic 401 on the first tool call.
 *
 * Accepts an explicit env map for testability; defaults to `process.env`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env)

  if (!result.success) {
    const lines = ['Invalid configuration for pexels-mcp-server:']
    for (const issue of result.error.issues) {
      lines.push(`  - ${String(issue.path[0] ?? '(root)')}: ${issue.message}`)
    }
    lines.push('')
    lines.push('Set PEXELS_API_KEY to your Pexels API key.')
    lines.push('Create a free account to get one instantly: https://www.pexels.com/api/')
    throw new ConfigError(lines.join('\n'))
  }

  return {
    apiKey: result.data.PEXELS_API_KEY,
  }
}

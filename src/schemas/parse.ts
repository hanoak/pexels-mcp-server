import type { z } from 'zod'

import { logger } from '../lib/logger.js'

/**
 * Thrown when a Pexels response fails validation against a (lenient) schema.
 * Because the schemas require almost nothing, a failure means the payload is
 * genuinely unexpected — the tool layer maps this to an MCP `isError` result.
 */
export class SchemaValidationError extends Error {
  constructor(context: string, options?: { cause?: unknown }) {
    super(`Unexpected Pexels response shape for ${context}.`, options)
    this.name = 'SchemaValidationError'
  }
}

/**
 * Validate `data` against `schema`, warning (to stderr) and throwing
 * {@link SchemaValidationError} on mismatch. This is the "passthrough-with-warn"
 * boundary: lenient schemas absorb most upstream drift, and the rare genuine
 * mismatch is surfaced loudly rather than crashing opaquely.
 */
export function parseResponse<Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
  context: string,
): z.infer<Schema> {
  const result = schema.safeParse(data)
  if (!result.success) {
    const paths = result.error.issues.map((issue) => issue.path.join('.') || '(root)').join(', ')
    logger.warn(`response validation failed for ${context}: ${paths}`)
    throw new SchemaValidationError(context, { cause: result.error })
  }
  return result.data
}

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import { PexelsApiError } from '../pexels/errors.js'
import { SchemaValidationError } from '../schemas/parse.js'

type Redactor = (input: string) => string
const noRedact: Redactor = (input) => input

/** Wrap plain text as a successful tool result. */
export function toTextResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

/** Wrap a JSON-serializable payload as a pretty-printed text tool result. */
export function toJsonResult(payload: unknown): CallToolResult {
  return toTextResult(JSON.stringify(payload, null, 2))
}

/**
 * Map any thrown error to an MCP result with `isError: true`, so recoverable
 * failures come back as content the model can see and adapt to — never as a
 * thrown JSON-RPC protocol error. This redaction call is the one guaranteed
 * safety net: not every PexelsApiError throw site redacts its own message
 * (see the type's doc comment), so this must not be treated as optional.
 */
export function toToolError(error: unknown, redact: Redactor = noRedact): CallToolResult {
  return { content: [{ type: 'text', text: redact(errorText(error)) }], isError: true }
}

function errorText(error: unknown): string {
  if (error instanceof PexelsApiError) return error.message
  if (error instanceof SchemaValidationError) return error.message
  if (error instanceof Error) return `Unexpected error: ${error.message}`
  return 'Unexpected error.'
}

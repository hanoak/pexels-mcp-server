import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

/** Register prompt templates that guide clients through common Pexels tasks. */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'find_photo',
    {
      title: 'Find a Pexels photo',
      description:
        'Search Pexels for a photo matching a description and present it with a courtesy credit.',
      argsSchema: {
        subject: z
          .string()
          .min(1)
          .describe('What the photo should depict, e.g. "a foggy pine forest at sunrise".'),
        // Kept a lenient string rather than a z.enum: MCP prompt arguments always
        // arrive as strings, and some clients (e.g. Claude Desktop) send "" for an
        // unfilled optional — which a strict enum rejects with -32602. We validate
        // the value in the handler instead, ignoring anything unexpected.
        orientation: z
          .string()
          .optional()
          .describe('Optional preferred orientation: landscape, portrait, or square.'),
      },
    },
    (args) => {
      const ORIENTATIONS = ['landscape', 'portrait', 'square']
      const orientation =
        args.orientation && ORIENTATIONS.includes(args.orientation)
          ? ` in ${args.orientation} orientation`
          : ''
      const text = [
        `Find a high-quality Pexels photo of ${args.subject}${orientation}.`,
        'Use the `pexels_search_photos` tool, choose the most fitting result, then present it:',
        '- display the image using its `src.large` (or a closer-fitting size) URL,',
        '- and include the courtesy `credit` (text or HTML) — appreciated but not required by',
        "  Pexels' license.",
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )
}

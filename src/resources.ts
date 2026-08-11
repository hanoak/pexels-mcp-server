import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const USAGE_GUIDE_URI = 'pexels://guides/usage'

/**
 * Human/model-readable usage guide, covering the same license ground as the
 * server `instructions` (they're not an exact mirror: this adds the
 * no-bulk-download/no-cloning restriction and omits the untrusted-text
 * directive, which only makes sense addressed to the model at init time).
 */
const USAGE_GUIDE = [
  '# Using Pexels photos & videos',
  '',
  "Pexels' license is lighter than many stock-photo APIs — attribution is",
  '**not required**, but a few real restrictions still apply.',
  '',
  '## Attribution (optional, appreciated)',
  '',
  'Every photo returned by this server includes a `credit` object with ready-to-use `text` and',
  "`html` crediting the photographer and Pexels. It's not mandatory, but include it when",
  "convenient — it costs nothing and it's good practice.",
  '',
  "## What is and isn't allowed",
  '',
  '- Hotlink the returned image/video URLs directly; do not rehost them.',
  '- Do not resell unaltered content as a physical product (poster, print, merchandise) without',
  '  modifying it first.',
  '- Do not redistribute Pexels content on another stock-photo or wallpaper platform.',
  '- Do not use Pexels content as part of a trademark, logo, or business/service name, or in a',
  "  way that implies a person's or brand's endorsement.",
  '- Do not depict an identifiable person in a bad or offensive light.',
  '- Do not build a bulk-download tool or clone the core Pexels browsing experience.',
  '',
  '## Content safety',
  '',
  'Pexels has no safe-search/content-filter query parameter — use judgment in how you phrase',
  'search queries.',
  '',
  '## Account-scoped tools',
  '',
  "`pexels_list_my_collections` reflects the Pexels account tied to the server's configured API",
  'key, not the person chatting — Pexels has no per-conversation login.',
  '',
  'Reference: https://www.pexels.com/license/',
].join('\n')

/** Register read-only reference resources (usage/license guide). */
export function registerResources(server: McpServer): void {
  server.registerResource(
    'usage-guide',
    USAGE_GUIDE_URI,
    {
      title: 'Pexels usage & license guide',
      description:
        "What is and isn't allowed when using Pexels photos/videos from this server: the real " +
        'license restrictions, optional attribution, and content-safety notes.',
      mimeType: 'text/markdown',
    },
    () => ({
      contents: [{ uri: USAGE_GUIDE_URI, mimeType: 'text/markdown', text: USAGE_GUIDE }],
    }),
  )
}

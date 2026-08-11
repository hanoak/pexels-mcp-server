import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const ORIENTATIONS = ['landscape', 'portrait', 'square']

/**
 * MCP prompt arguments always arrive as strings, and some clients (e.g. Claude
 * Desktop) send "" for an unfilled optional — which a strict z.enum rejects
 * with -32602. Keep closed-set args (like orientation) as plain strings and
 * validate them here instead, silently ignoring anything unrecognized.
 */
function pickLenient(value: string | undefined, allowed: readonly string[]): string | undefined {
  return value && allowed.includes(value) ? value : undefined
}

/**
 * Same string/empty-optional handling as {@link pickLenient}, but for
 * genuinely open-ended args (e.g. `color`, which accepts a named color *or*
 * any hex code — unlike Unsplash's closed color-bucket enum, there's no
 * fixed allowlist to validate against).
 */
function pickNonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Parse a prompt's optional numeric arg (also always a string). A valid
 * value ≥1 is capped at `max`; a missing, non-numeric, or below-1 value
 * falls back to `fallback` rather than being clamped up to 1.
 */
function clampCount(value: string | undefined, fallback: number, max: number): number {
  const n = value ? Number.parseInt(value, 10) : NaN
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback
}

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
        orientation: z
          .string()
          .optional()
          .describe('Optional preferred orientation: landscape, portrait, or square.'),
      },
    },
    (args) => {
      const orientation = pickLenient(args.orientation, ORIENTATIONS)
      const orientationPart = orientation ? ` in ${orientation} orientation` : ''
      const text = [
        `Find a high-quality Pexels photo of ${args.subject}${orientationPart}.`,
        'Use the `pexels_search_photos` tool, choose the most fitting result, then present it:',
        '- display the image using its `src.large` (or a closer-fitting size) URL,',
        '- and include the courtesy `credit` (text or HTML) — appreciated but not required by',
        "  Pexels' license.",
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  server.registerPrompt(
    'photo_gallery',
    {
      title: 'Build a Pexels photo gallery',
      description:
        'Search Pexels for a themed set of photos and present them all with courtesy credits.',
      argsSchema: {
        theme: z
          .string()
          .min(1)
          .describe('What the gallery should be about, e.g. "autumn forests".'),
        count: z.string().optional().describe('How many photos to include (default 5, max 10).'),
        orientation: z
          .string()
          .optional()
          .describe('Optional preferred orientation: landscape, portrait, or square.'),
        color: z
          .string()
          .optional()
          .describe(
            'Optional preferred color, e.g. blue, black, orange, or a hex code like "#ffffff".',
          ),
      },
    },
    (args) => {
      const orientation = pickLenient(args.orientation, ORIENTATIONS)
      const color = pickNonEmpty(args.color)
      const count = clampCount(args.count, 5, 10)

      const filters = [orientation && `orientation: "${orientation}"`, color && `color: "${color}"`]
        .filter(Boolean)
        .join(', ')
      const filtersSuffix = filters ? ` (${filters})` : ''

      const text = [
        `Build a themed Pexels photo gallery about ${args.theme}${filtersSuffix}.`,
        `Use the \`pexels_search_photos\` tool (per_page: ${count}${filters ? `, ${filters}` : ''}) ` +
          `to gather up to ${count} well-matched photos, then present each one:`,
        '- display the image using its `src.large` (or a closer-fitting size) URL,',
        '- and include the courtesy `credit` next to it.',
        'Skip any results that do not fit the theme well rather than padding the gallery to the ' +
          'requested count.',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  server.registerPrompt(
    'find_video',
    {
      title: 'Find a Pexels video',
      description:
        'Search Pexels for a video matching a description and present it with a courtesy credit.',
      argsSchema: {
        subject: z
          .string()
          .min(1)
          .describe('What the video should depict, e.g. "waves crashing on rocks".'),
        orientation: z
          .string()
          .optional()
          .describe('Optional preferred orientation: landscape, portrait, or square.'),
      },
    },
    (args) => {
      const orientation = pickLenient(args.orientation, ORIENTATIONS)
      const orientationPart = orientation ? ` in ${orientation} orientation` : ''
      const text = [
        `Find a high-quality Pexels video of ${args.subject}${orientationPart}.`,
        'Use the `pexels_search_videos` tool, choose the most fitting result, then present it:',
        '- describe the video and link to it using its `url` (the Pexels video page),',
        '- mention a suitable rendition from `video_files` for the intended use (e.g. the ' +
          'highest-resolution `hd` file for playback, a smaller `sd` file for a quick preview),',
        '- and include a courtesy credit to the videographer (`user.name`/`user.url`) —',
        "  appreciated but not required by Pexels' license.",
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  server.registerPrompt(
    'collection_tour',
    {
      title: 'Tour a Pexels collection',
      description: 'Find a featured Pexels collection matching a theme and walk through its media.',
      argsSchema: {
        theme: z
          .string()
          .min(1)
          .describe('What kind of collection to look for, e.g. "urban architecture".'),
        count: z
          .string()
          .optional()
          .describe('How many items to show from the collection (default 5, max 10).'),
      },
    },
    (args) => {
      const count = clampCount(args.count, 5, 10)
      const text = [
        `Find a featured Pexels collection related to ${args.theme} and give it a tour.`,
        'Use the `pexels_list_featured_collections` tool to find a matching collection (check ' +
          'each title/description), then `pexels_get_collection_media` (id: the chosen ' +
          `collection's id, per_page: ${count}) to gather up to ${count} of its items.`,
        'Present the collection title/description first, then each item:',
        '- display the image/video using its most relevant URL (`src.large` for a photo, `url` ' +
          'for a video),',
        '- note whether each item is a photo or a video (`media_type`),',
        '- and include the courtesy credit for each.',
        'If no featured collection is a good match, say so rather than forcing an unrelated one.',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  server.registerPrompt(
    'media_brief',
    {
      title: 'Build a mixed Pexels media brief',
      description:
        'Gather both photos and videos for a theme and present them together as a brief.',
      argsSchema: {
        theme: z
          .string()
          .min(1)
          .describe('What the brief should be about, e.g. "cozy autumn mornings".'),
        photo_count: z
          .string()
          .optional()
          .describe('How many photos to include (default 3, max 6).'),
        video_count: z
          .string()
          .optional()
          .describe('How many videos to include (default 2, max 6).'),
      },
    },
    (args) => {
      const photoCount = clampCount(args.photo_count, 3, 6)
      const videoCount = clampCount(args.video_count, 2, 6)
      const text = [
        `Put together a mixed media brief for "${args.theme}": both photos and video clips.`,
        `Use \`pexels_search_photos\` (per_page: ${photoCount}) for up to ${photoCount} photos, ` +
          `and \`pexels_search_videos\` (per_page: ${videoCount}) for up to ${videoCount} video clips.`,
        'Present them together as one brief, grouped by type (Photos, then Videos):',
        '- display each photo using its `src.large` URL and each video using its `url`,',
        '- and include the courtesy credit for each item.',
        'Skip any result that does not fit the theme well rather than padding to the requested ' +
          'counts.',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { PexelsApiError } from '../pexels/errors.js'
import {
  CuratedPhotosResponseSchema,
  PhotoSchema,
  SearchPhotosResponseSchema,
} from '../schemas/photo.js'
import { parseResponse } from '../schemas/parse.js'
import { IMAGE_URL_HINT, toCompactPhoto } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 80

// Locales documented for /search and /videos/search. Kept as an in-handler
// allowlist (not a zod enum) so the tool's JSON Schema stays small — a
// rejected locale still gets a clear, actionable error listing valid values.
const VALID_LOCALES = new Set([
  'en-US',
  'pt-BR',
  'es-ES',
  'ca-ES',
  'de-DE',
  'it-IT',
  'fr-FR',
  'sv-SE',
  'id-ID',
  'pl-PL',
  'ja-JP',
  'zh-TW',
  'zh-CN',
  'ko-KR',
  'th-TH',
  'nl-NL',
  'hu-HU',
  'vi-VN',
  'cs-CZ',
  'da-DK',
  'fi-FI',
  'uk-UA',
  'el-GR',
  'ro-RO',
  'nb-NO',
  'sk-SK',
  'tr-TR',
  'ru-RU',
])

function validateLocale(locale: string | undefined): string | undefined {
  if (locale === undefined) return undefined
  if (!VALID_LOCALES.has(locale)) {
    throw new PexelsApiError(
      'bad_request',
      `Invalid locale "${locale}". Valid locales: ${[...VALID_LOCALES].sort().join(', ')}.`,
    )
  }
  return locale
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

const searchPhotosInput = {
  query: z.string().trim().min(1).describe('The search query, e.g. "ocean", "tigers", "pears".'),
  orientation: z
    .enum(['landscape', 'portrait', 'square'])
    .optional()
    .describe('Desired photo orientation.'),
  size: z
    .enum(['large', 'medium', 'small'])
    .optional()
    .describe('Minimum photo size: large (24MP), medium (12MP), or small (4MP).'),
  color: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe(
      'Desired photo color: a named color (red, orange, yellow, green, turquoise, blue, ' +
        'violet, pink, brown, black, gray, white) or a hex code like "#ffffff".',
    ),
  locale: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('The locale of the search, e.g. "en-US", "fr-FR" (28 supported locales).'),
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Items per page (clamped to a max of 80).'),
}

const curatedPhotosInput = {
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Items per page (clamped to a max of 80).'),
}

const getPhotoInput = {
  id: z.coerce.number().int().positive().describe('The numeric Pexels photo ID.'),
}

/** Register the photos-domain tools onto the server. */
export function registerPhotoTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'pexels_search_photos',
    {
      title: 'Search Pexels Photos',
      description:
        'Search Pexels for photos matching a query, with optional orientation/size/color/locale ' +
        'filters. Returns compact photo objects with pre-sized URLs and a courtesy credit ' +
        '(attribution is appreciated but not required by the Pexels license). Read-only.' +
        IMAGE_URL_HINT,
      inputSchema: searchPhotosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const locale = validateLocale(args.locale)
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/search', {
          params: {
            query: args.query,
            orientation: args.orientation,
            size: args.size,
            color: args.color,
            locale,
            page: args.page,
            per_page: perPage,
          },
          signal: extra.signal,
        })
        const parsed = parseResponse(SearchPhotosResponseSchema, res.data, 'search photos')
        return toJsonResult({
          photos: parsed.photos.map(toCompactPhoto),
          total_results: parsed.total_results,
          page: parsed.page ?? args.page,
          per_page: parsed.per_page ?? perPage,
          has_next_page: Boolean(parsed.next_page),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'pexels_curated_photos',
    {
      title: 'Curated Pexels Photos',
      description:
        "List Pexels' hand-curated photo picks, refreshed hourly (paginated). Returns compact " +
        'photo objects. Read-only.' +
        IMAGE_URL_HINT,
      inputSchema: curatedPhotosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/curated', {
          params: { page: args.page, per_page: perPage },
          signal: extra.signal,
        })
        const parsed = parseResponse(CuratedPhotosResponseSchema, res.data, 'curated photos')
        return toJsonResult({
          photos: parsed.photos.map(toCompactPhoto),
          total_results: parsed.total_results,
          page: parsed.page ?? args.page,
          per_page: parsed.per_page ?? perPage,
          has_next_page: Boolean(parsed.next_page),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'pexels_get_photo',
    {
      title: 'Get Pexels Photo',
      description:
        'Get a single Pexels photo by its numeric ID, with full detail, pre-sized URLs, and a ' +
        'courtesy credit. Read-only.' +
        IMAGE_URL_HINT,
      inputSchema: getPhotoInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get(`/photos/${args.id}`, { signal: extra.signal })
        const photo = parseResponse(PhotoSchema, res.data, 'get photo')
        return toJsonResult({ photo: toCompactPhoto(photo), rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}

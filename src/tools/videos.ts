import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { PexelsApiError } from '../pexels/errors.js'
import { parseResponse } from '../schemas/parse.js'
import {
  PopularVideosResponseSchema,
  SearchVideosResponseSchema,
  VideoSchema,
} from '../schemas/video.js'
import { toCompactVideo, VIDEO_FILES_HINT } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 80

// Same 28-code list documented for /search — duplicated rather than shared
// with photos.ts so each domain file stays self-contained (see CLAUDE.md
// folder conventions: no cross-domain abstractions until real duplication
// forces a third instance, and collections has no locale param).
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

const searchVideosInput = {
  query: z.string().trim().min(1).describe('The search query, e.g. "ocean", "tigers", "pears".'),
  orientation: z
    .enum(['landscape', 'portrait', 'square'])
    .optional()
    .describe('Desired video orientation.'),
  size: z
    .enum(['large', 'medium', 'small'])
    .optional()
    .describe('Minimum video size: large (4K), medium (Full HD), or small (HD).'),
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

const popularVideosInput = {
  min_width: z.number().int().positive().optional().describe('Minimum video width in pixels.'),
  min_height: z.number().int().positive().optional().describe('Minimum video height in pixels.'),
  min_duration: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Minimum video duration in seconds.'),
  max_duration: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum video duration in seconds.'),
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Items per page (clamped to a max of 80).'),
}

const getVideoInput = {
  id: z.coerce.number().int().positive().describe('The numeric Pexels video ID.'),
}

/** Register the videos-domain tools onto the server. */
export function registerVideoTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'pexels_search_videos',
    {
      title: 'Search Pexels Videos',
      description:
        'Search Pexels for videos matching a query, with optional orientation/size/locale ' +
        'filters. Returns compact video objects with rendition links. Read-only.' +
        VIDEO_FILES_HINT,
      inputSchema: searchVideosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const locale = validateLocale(args.locale)
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/videos/search', {
          params: {
            query: args.query,
            orientation: args.orientation,
            size: args.size,
            locale,
            page: args.page,
            per_page: perPage,
          },
          signal: extra.signal,
        })
        const parsed = parseResponse(SearchVideosResponseSchema, res.data, 'search videos')
        return toJsonResult({
          videos: parsed.videos.map((v) => toCompactVideo(v)),
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
    'pexels_popular_videos',
    {
      title: 'Popular Pexels Videos',
      description:
        'List currently popular Pexels videos, optionally filtered by minimum width/height and ' +
        'duration range. Returns compact video objects. Read-only.' +
        VIDEO_FILES_HINT,
      inputSchema: popularVideosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        if (
          args.min_duration !== undefined &&
          args.max_duration !== undefined &&
          args.min_duration > args.max_duration
        ) {
          throw new PexelsApiError(
            'bad_request',
            `min_duration (${args.min_duration}) must be <= max_duration (${args.max_duration}).`,
          )
        }
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/videos/popular', {
          params: {
            min_width: args.min_width,
            min_height: args.min_height,
            min_duration: args.min_duration,
            max_duration: args.max_duration,
            page: args.page,
            per_page: perPage,
          },
          signal: extra.signal,
        })
        const parsed = parseResponse(PopularVideosResponseSchema, res.data, 'popular videos')
        return toJsonResult({
          videos: parsed.videos.map((v) => toCompactVideo(v)),
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
    'pexels_get_video',
    {
      title: 'Get Pexels Video',
      description:
        'Get a single Pexels video by its numeric ID, with full detail and every available ' +
        'rendition (unlike the search/popular tools, this returns the complete video_files ' +
        'list, not just the top few). Read-only.',
      inputSchema: getVideoInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get(`/videos/videos/${args.id}`, { signal: extra.signal })
        const video = parseResponse(VideoSchema, res.data, 'get video')
        return toJsonResult({
          video: toCompactVideo(video, { fullFiles: true }),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}

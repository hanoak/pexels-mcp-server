import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { CollectionMediaItem } from '../schemas/collection.js'
import {
  CollectionMediaResponseSchema,
  FeaturedCollectionsResponseSchema,
  MyCollectionsResponseSchema,
} from '../schemas/collection.js'
import { parseResponse } from '../schemas/parse.js'
import {
  type CompactPhoto,
  type CompactVideo,
  IMAGE_URL_HINT,
  toCompactCollection,
  toCompactPhoto,
  toCompactVideo,
  VIDEO_FILES_HINT,
} from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 80

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

const featuredCollectionsInput = {
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Items per page (clamped to a max of 80).'),
}

const myCollectionsInput = {
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Items per page (clamped to a max of 80).'),
}

const getCollectionMediaInput = {
  id: z.string().trim().min(1).describe('The Pexels collection ID.'),
  type: z
    .enum(['photos', 'videos'])
    .optional()
    .describe('Filter media by type. Omit to return both photos and videos.'),
  sort: z.enum(['asc', 'desc']).optional().describe('Sort order.'),
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Items per page (clamped to a max of 80).'),
}

/**
 * Distinguish a photo-shaped media item from a video-shaped one. Prefers the
 * documented `type` field (checked case-insensitively — docs disagree on
 * exact casing and this hasn't been hands-on-verified against a live
 * response), falling back to a structural check when `type` is missing or
 * unrecognized.
 */
function isVideoItem(item: CollectionMediaItem): boolean {
  const type = item.type?.toLowerCase()
  if (type === 'video') return true
  if (type === 'photo') return false
  return item.video_files !== undefined || item.duration !== undefined
}

/** Project a mixed-media item into the same compact shape its own domain tool would return. */
function toCompactMediaItem(
  item: CollectionMediaItem,
): { media_type: 'photo' | 'video' } & (CompactPhoto | CompactVideo) {
  if (isVideoItem(item)) {
    return {
      media_type: 'video',
      ...toCompactVideo({
        id: item.id,
        width: item.width,
        height: item.height,
        url: item.url,
        image: item.image,
        duration: item.duration,
        user: item.user,
        video_files: item.video_files ?? [],
        video_pictures: item.video_pictures ?? [],
      }),
    }
  }
  return {
    media_type: 'photo',
    ...toCompactPhoto({
      id: item.id,
      width: item.width,
      height: item.height,
      url: item.url,
      photographer: item.photographer,
      photographer_url: item.photographer_url,
      photographer_id: item.photographer_id,
      avg_color: item.avg_color,
      src: item.src,
      alt: item.alt,
    }),
  }
}

/** Register the collections-domain tools onto the server. */
export function registerCollectionTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'pexels_list_featured_collections',
    {
      title: 'List Featured Pexels Collections',
      description:
        "List Pexels' featured collections (paginated). Returns collection metadata only — " +
        'call pexels_get_collection_media for the photos/videos inside one. Read-only.',
      inputSchema: featuredCollectionsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/collections/featured', {
          params: { page: args.page, per_page: perPage },
          signal: extra.signal,
        })
        const parsed = parseResponse(
          FeaturedCollectionsResponseSchema,
          res.data,
          'featured collections',
        )
        return toJsonResult({
          collections: parsed.collections.map(toCompactCollection),
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
    'pexels_list_my_collections',
    {
      title: 'List My Pexels Collections',
      description:
        'List the collections belonging to the Pexels account that owns the configured API ' +
        'key (paginated). Since Pexels has no per-conversation OAuth login, this always ' +
        "reflects the API key's own account, not the person chatting — it will be empty " +
        'unless that account has created collections on pexels.com. Read-only.',
      inputSchema: myCollectionsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/collections', {
          params: { page: args.page, per_page: perPage },
          signal: extra.signal,
        })
        const parsed = parseResponse(MyCollectionsResponseSchema, res.data, 'my collections')
        return toJsonResult({
          collections: parsed.collections.map(toCompactCollection),
          total_results: parsed.total_results,
          page: parsed.page ?? args.page,
          per_page: parsed.per_page ?? perPage,
          has_next_page: Boolean(parsed.next_page),
          ...(parsed.collections.length === 0
            ? {
                note:
                  'No collections found for the Pexels account tied to this API key. This ' +
                  "reflects that account's own collections on pexels.com, not the current " +
                  'conversation — Pexels has no per-user login.',
              }
            : {}),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'pexels_get_collection_media',
    {
      title: 'Get Pexels Collection Media',
      description:
        'Get the photos and/or videos inside a Pexels collection by its ID (paginated, ' +
        'optionally filtered to just photos or just videos). Each item is returned in the ' +
        'same compact shape its own domain tool would use, tagged with `media_type`. Read-only.' +
        IMAGE_URL_HINT +
        VIDEO_FILES_HINT,
      inputSchema: getCollectionMediaInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get(`/collections/${encodeURIComponent(args.id)}`, {
          params: { type: args.type, sort: args.sort, page: args.page, per_page: perPage },
          signal: extra.signal,
        })
        const parsed = parseResponse(CollectionMediaResponseSchema, res.data, 'collection media')
        return toJsonResult({
          media: parsed.media.map(toCompactMediaItem),
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
}

import { z } from 'zod'

import { PaginationSchema } from './pagination.js'
import { PhotoSrcSchema } from './photo.js'
import { VideoFileSchema, VideoPictureSchema, VideoUserSchema } from './video.js'

/**
 * A collection-media item is either a Photo or a Video. Docs describe a
 * `type` field distinguishing the two but disagree on exact casing
 * ("Photo"/"Video" vs lowercase) and this hasn't been hands-on-verified
 * against a live response — so `type` is modeled as a lenient optional
 * string here rather than a strict enum that could reject a real payload
 * over a casing mismatch. One superset shape covers both item kinds; the
 * tool handler does the actual (case-insensitive) discrimination.
 */
export const CollectionMediaItemSchema = z.object({
  id: z.number(),
  type: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  url: z.string().optional(),
  // Photo-only fields.
  photographer: z.string().optional(),
  photographer_url: z.string().optional(),
  photographer_id: z.number().optional(),
  avg_color: z.string().nullish(),
  src: PhotoSrcSchema.optional(),
  alt: z.string().nullish(),
  // Video-only fields.
  image: z.string().optional(),
  duration: z.number().optional(),
  user: VideoUserSchema.optional(),
  video_files: z.array(VideoFileSchema).optional(),
  video_pictures: z.array(VideoPictureSchema).optional(),
})
export type CollectionMediaItem = z.infer<typeof CollectionMediaItemSchema>

export const CollectionSchema = z.object({
  // Collection IDs are opaque alphanumeric strings, unlike photo/video IDs.
  id: z.string(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  private: z.boolean().optional(),
  media_count: z.number().optional(),
  photos_count: z.number().optional(),
  videos_count: z.number().optional(),
})
export type Collection = z.infer<typeof CollectionSchema>

export const FeaturedCollectionsResponseSchema = PaginationSchema.extend({
  collections: z.array(CollectionSchema).default([]),
})

export const MyCollectionsResponseSchema = PaginationSchema.extend({
  collections: z.array(CollectionSchema).default([]),
})

export const CollectionMediaResponseSchema = PaginationSchema.extend({
  media: z.array(CollectionMediaItemSchema).default([]),
})

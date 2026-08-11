import { z } from 'zod'

import { PaginationSchema } from './pagination.js'

/**
 * Lenient schemas for the Pexels video responses we consume. See photo.ts for
 * the general design rationale (validate only consumed fields, stay lenient).
 */

export const VideoFileSchema = z.object({
  id: z.number().optional(),
  // Pexels' field-type docs list only "hd"/"sd", but its own example
  // responses already include a third value, "hls" — kept as a lenient
  // string since even the vendor's docs are inconsistent about the full set.
  quality: z.string().nullish(),
  file_type: z.string().optional(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  fps: z.number().optional(),
  link: z.string().optional(),
})

export const VideoPictureSchema = z.object({
  id: z.number().optional(),
  picture: z.string().optional(),
  nr: z.number().optional(),
})

export const VideoUserSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
})

export const VideoSchema = z.object({
  id: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  url: z.string().optional(),
  image: z.string().optional(),
  duration: z.number().optional(),
  user: VideoUserSchema.optional(),
  video_files: z.array(VideoFileSchema).default([]),
  video_pictures: z.array(VideoPictureSchema).default([]),
})
export type Video = z.infer<typeof VideoSchema>

export const SearchVideosResponseSchema = PaginationSchema.extend({
  videos: z.array(VideoSchema).default([]),
})

export const PopularVideosResponseSchema = PaginationSchema.extend({
  videos: z.array(VideoSchema).default([]),
})

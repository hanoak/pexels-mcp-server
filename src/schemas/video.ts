import { z } from 'zod'

import { PaginationSchema } from './pagination.js'

/**
 * Lenient schemas for the Pexels video responses we consume. See photo.ts for
 * the general design rationale (validate only consumed fields, stay lenient).
 */

export const VideoFileSchema = z.object({
  id: z.number().optional(),
  // Documented values are just "hd"/"sd", but kept as a lenient string in
  // case Pexels adds a value — this is a response schema, not a tool input.
  quality: z.string().nullish(),
  file_type: z.string().optional(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  fps: z.number().optional(),
  link: z.string().optional(),
})
export type VideoFile = z.infer<typeof VideoFileSchema>

export const VideoPictureSchema = z.object({
  id: z.number().optional(),
  picture: z.string().optional(),
  nr: z.number().optional(),
})
export type VideoPicture = z.infer<typeof VideoPictureSchema>

export const VideoUserSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
  url: z.string().optional(),
})
export type VideoUser = z.infer<typeof VideoUserSchema>

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
export type SearchVideosResponse = z.infer<typeof SearchVideosResponseSchema>

export const PopularVideosResponseSchema = PaginationSchema.extend({
  videos: z.array(VideoSchema).default([]),
})
export type PopularVideosResponse = z.infer<typeof PopularVideosResponseSchema>

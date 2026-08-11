import { z } from 'zod'

import { PaginationSchema } from './pagination.js'

/**
 * Lenient schemas for the Pexels photo responses we consume.
 *
 * Design: validate only the fields we actually use, and keep nearly
 * everything optional/nullable. Unknown fields Pexels adds are ignored
 * (stripped); fields it renames or drops surface as `undefined` instead of
 * crashing every tool. Only `id` is required. Pexels photo IDs are integers
 * (unlike Unsplash's string IDs) per the live API documentation.
 */

export const PhotoSrcSchema = z.object({
  original: z.string().optional(),
  large2x: z.string().optional(),
  large: z.string().optional(),
  medium: z.string().optional(),
  small: z.string().optional(),
  portrait: z.string().optional(),
  landscape: z.string().optional(),
  tiny: z.string().optional(),
})
export type PhotoSrc = z.infer<typeof PhotoSrcSchema>

export const PhotoSchema = z.object({
  id: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  url: z.string().optional(),
  photographer: z.string().optional(),
  photographer_url: z.string().optional(),
  photographer_id: z.number().optional(),
  avg_color: z.string().nullish(),
  src: PhotoSrcSchema.optional(),
  alt: z.string().nullish(),
  // Whether the account that owns the API key has liked this photo.
  liked: z.boolean().optional(),
})
export type Photo = z.infer<typeof PhotoSchema>

export const SearchPhotosResponseSchema = PaginationSchema.extend({
  photos: z.array(PhotoSchema).default([]),
})
export type SearchPhotosResponse = z.infer<typeof SearchPhotosResponseSchema>

export const CuratedPhotosResponseSchema = PaginationSchema.extend({
  photos: z.array(PhotoSchema).default([]),
})
export type CuratedPhotosResponse = z.infer<typeof CuratedPhotosResponseSchema>

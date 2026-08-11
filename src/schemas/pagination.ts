import { z } from 'zod'

/**
 * Shared pagination envelope fields returned by every Pexels list endpoint
 * (search, curated, popular, featured collections, my collections,
 * collection media). All optional — a missing/renamed field degrades
 * gracefully instead of breaking every list tool.
 */
export const PaginationSchema = z.object({
  page: z.number().optional(),
  per_page: z.number().optional(),
  total_results: z.number().optional(),
  next_page: z.string().nullish(),
  prev_page: z.string().nullish(),
})
export type Pagination = z.infer<typeof PaginationSchema>

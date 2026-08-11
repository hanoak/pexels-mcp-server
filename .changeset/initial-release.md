---
'@hanoak/pexels-mcp-server': major
---

Initial public release. An MCP server covering the complete documented Pexels API in one release — there's no OAuth tier to hold a v2 behind:

- **Photos**: `pexels_search_photos`, `pexels_curated_photos`, `pexels_get_photo`
- **Videos**: `pexels_search_videos`, `pexels_popular_videos`, `pexels_get_video`
- **Collections**: `pexels_list_featured_collections`, `pexels_list_my_collections`, `pexels_get_collection_media`
- A `pexels://guides/usage` resource covering the real license restrictions and the optional courtesy-credit convention
- A 5-prompt library: `find_photo`, `photo_gallery`, `find_video`, `collection_tour`, `media_brief`
- A robust HTTP client with retries/backoff and Pexels-specific rate-limit-quota caching (Pexels omits its rate-limit headers on a 429 response)

import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse, parseResult } from '../helpers/mcp.js'

const videoFixture = {
  id: 456,
  width: 1920,
  height: 1080,
  url: 'https://www.pexels.com/video/456',
  image: 'https://images.pexels.com/videos/456/preview.jpg',
  duration: 30,
  user: { id: 7, name: 'Jane Doe', url: 'https://www.pexels.com/@janedoe' },
  video_files: [
    {
      id: 1,
      quality: 'hd',
      file_type: 'video/mp4',
      width: 1920,
      height: 1080,
      fps: 25,
      link: 'https://videos.pexels.com/1.mp4',
    },
    {
      id: 2,
      quality: 'sd',
      file_type: 'video/mp4',
      width: 640,
      height: 360,
      fps: 25,
      link: 'https://videos.pexels.com/2.mp4',
    },
  ],
  video_pictures: [{ id: 1, picture: 'https://images.pexels.com/videos/456/pic1.jpg', nr: 0 }],
}

describe('videos tools registration', () => {
  it('lists all three videos-domain tools with read-only annotations', async () => {
    const { fn } = fakeFetch(() => jsonResponse({}))
    const client = await connect(fn)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['pexels_search_videos', 'pexels_popular_videos', 'pexels_get_video']),
    )
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true)
      expect(tool.annotations?.openWorldHint).toBe(true)
    }

    await client.close()
  })
})

describe('pexels_search_videos', () => {
  it('returns compact videos with pagination and rate-limit info', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse(
        { page: 1, per_page: 10, total_results: 1, next_page: null, videos: [videoFixture] },
        { headers: { 'x-ratelimit-limit': '200', 'x-ratelimit-remaining': '199' } },
      ),
    )
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_search_videos',
      arguments: { query: 'ocean' },
    })
    const body = parseResult(res as never) as {
      videos: Array<{ id: number; video_files: unknown[]; video_files_count: number }>
      has_next_page: boolean
      rate_limit: { remaining: number }
    }

    expect(body.videos).toHaveLength(1)
    expect(body.videos[0]!.id).toBe(456)
    expect(body.videos[0]!.video_files_count).toBe(2)
    expect(body.has_next_page).toBe(false)
    expect(body.rate_limit.remaining).toBe(199)

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/videos/search')
    expect(url.searchParams.get('query')).toBe('ocean')

    await client.close()
  })

  it('clamps per_page to the documented max of 80', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ videos: [] }))
    const client = await connect(fn)

    await client.callTool({
      name: 'pexels_search_videos',
      arguments: { query: 'ocean', per_page: 500 },
    })

    const url = new URL(calls[0]!)
    expect(url.searchParams.get('per_page')).toBe('80')

    await client.close()
  })

  it('rejects an invalid locale before calling the API', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ videos: [] }))
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_search_videos',
      arguments: { query: 'ocean', locale: 'xx-XX' },
    })

    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('Invalid locale "xx-XX"')
    expect(calls.length).toBe(0)

    await client.close()
  })
})

describe('pexels_popular_videos', () => {
  it('returns compact videos', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ page: 1, videos: [videoFixture] }))
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_popular_videos', arguments: {} })
    const body = parseResult(res as never) as { videos: Array<{ id: number }> }
    expect(body.videos).toHaveLength(1)

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/videos/popular')

    await client.close()
  })

  it('forwards min/max width/height/duration filters', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ videos: [] }))
    const client = await connect(fn)

    await client.callTool({
      name: 'pexels_popular_videos',
      arguments: { min_width: 1920, min_height: 1080, min_duration: 5, max_duration: 60 },
    })

    const url = new URL(calls[0]!)
    expect(url.searchParams.get('min_width')).toBe('1920')
    expect(url.searchParams.get('min_height')).toBe('1080')
    expect(url.searchParams.get('min_duration')).toBe('5')
    expect(url.searchParams.get('max_duration')).toBe('60')

    await client.close()
  })

  it('rejects min_duration > max_duration before calling the API', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ videos: [] }))
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_popular_videos',
      arguments: { min_duration: 60, max_duration: 5 },
    })

    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('min_duration (60) must be <= max_duration (5)')
    expect(calls.length).toBe(0)

    await client.close()
  })
})

describe('pexels_get_video', () => {
  it('returns every rendition (not just the top few) for a single video', async () => {
    const manyFiles = Array.from({ length: 7 }, (_, i) => ({
      id: i,
      quality: i < 3 ? 'hd' : 'sd',
      file_type: 'video/mp4',
      width: 1920 - i * 100,
      height: 1080 - i * 100,
      fps: 25,
      link: `https://videos.pexels.com/${i}.mp4`,
    }))
    const { fn, calls } = fakeFetch(() => jsonResponse({ ...videoFixture, video_files: manyFiles }))
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_get_video', arguments: { id: '456' } })
    const body = parseResult(res as never) as { video: { id: number; video_files: unknown[] } }
    expect(body.video.id).toBe(456)
    expect(body.video.video_files).toHaveLength(7)

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/videos/videos/456')

    await client.close()
  })

  it('surfaces a 404 as a clean isError result', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ error: 'Not found' }, { status: 404 }))
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_get_video', arguments: { id: 999 } })
    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('404')

    await client.close()
  })
})

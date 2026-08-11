import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse, parseResult } from '../helpers/mcp.js'

const photoItem = {
  id: 123,
  width: 4000,
  height: 3000,
  url: 'https://www.pexels.com/photo/123',
  photographer: 'Jane Doe',
  photographer_url: 'https://www.pexels.com/@janedoe',
  avg_color: '#0c0c0c',
  src: { original: 'https://images.pexels.com/photos/123/original.jpg' },
  alt: 'A cat',
}

const videoItem = {
  id: 456,
  width: 1920,
  height: 1080,
  url: 'https://www.pexels.com/video/456',
  image: 'https://images.pexels.com/videos/456/preview.jpg',
  duration: 30,
  video_files: [
    { id: 1, quality: 'hd', width: 1920, height: 1080, link: 'https://videos.pexels.com/1.mp4' },
  ],
  video_pictures: [],
}

describe('collections tools registration', () => {
  it('lists all three collections-domain tools with read-only annotations', async () => {
    const { fn } = fakeFetch(() => jsonResponse({}))
    const client = await connect(fn)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'pexels_list_featured_collections',
        'pexels_list_my_collections',
        'pexels_get_collection_media',
      ]),
    )
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true)
    }

    await client.close()
  })
})

describe('pexels_list_featured_collections', () => {
  it('returns compact collections', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse({ page: 1, collections: [{ id: 'abc123', title: 'Nature', media_count: 10 }] }),
    )
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_list_featured_collections', arguments: {} })
    const body = parseResult(res as never) as { collections: Array<{ id: string; title: string }> }
    expect(body.collections).toEqual([expect.objectContaining({ id: 'abc123', title: 'Nature' })])

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/collections/featured')

    await client.close()
  })
})

describe('pexels_list_my_collections', () => {
  it('returns compact collections without a note when non-empty', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse({ page: 1, collections: [{ id: 'abc123', title: 'Nature' }] }),
    )
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_list_my_collections', arguments: {} })
    const body = parseResult(res as never) as { collections: unknown[]; note?: string }
    expect(body.collections).toHaveLength(1)
    expect(body.note).toBeUndefined()

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/collections')

    await client.close()
  })

  it('includes an explanatory note when the account has no collections', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ page: 1, collections: [] }))
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_list_my_collections', arguments: {} })
    const body = parseResult(res as never) as { collections: unknown[]; note?: string }
    expect(body.collections).toEqual([])
    expect(body.note).toContain('No collections found')

    await client.close()
  })
})

describe('pexels_get_collection_media', () => {
  it('discriminates photo vs video items via a capitalized type field', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse({
        page: 1,
        media: [
          { ...photoItem, type: 'Photo' },
          { ...videoItem, type: 'Video' },
        ],
      }),
    )
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_get_collection_media',
      arguments: { id: 'abc123' },
    })
    const body = parseResult(res as never) as {
      media: Array<{ media_type: string; id: number }>
    }
    expect(body.media).toHaveLength(2)
    expect(body.media[0]).toMatchObject({ media_type: 'photo', id: 123 })
    expect(body.media[1]).toMatchObject({ media_type: 'video', id: 456 })

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/collections/abc123')

    await client.close()
  })

  it('discriminates via a lowercase type field too', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({
        media: [
          { ...photoItem, type: 'photo' },
          { ...videoItem, type: 'video' },
        ],
      }),
    )
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_get_collection_media',
      arguments: { id: 'abc123' },
    })
    const body = parseResult(res as never) as { media: Array<{ media_type: string }> }
    expect(body.media.map((m) => m.media_type)).toEqual(['photo', 'video'])

    await client.close()
  })

  it('falls back to a structural check when type is missing', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ media: [photoItem, videoItem] }))
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_get_collection_media',
      arguments: { id: 'abc123' },
    })
    const body = parseResult(res as never) as { media: Array<{ media_type: string; id: number }> }
    expect(body.media[0]).toMatchObject({ media_type: 'photo', id: 123 })
    expect(body.media[1]).toMatchObject({ media_type: 'video', id: 456 })

    await client.close()
  })

  it('forwards type and sort filters', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ media: [] }))
    const client = await connect(fn)

    await client.callTool({
      name: 'pexels_get_collection_media',
      arguments: { id: 'abc123', type: 'videos', sort: 'desc' },
    })

    const url = new URL(calls[0]!)
    expect(url.searchParams.get('type')).toBe('videos')
    expect(url.searchParams.get('sort')).toBe('desc')

    await client.close()
  })

  it('surfaces a 404 as a clean isError result', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ error: 'Not found' }, { status: 404 }))
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_get_collection_media',
      arguments: { id: 'missing' },
    })
    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('404')

    await client.close()
  })
})

import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse, parseResult } from '../helpers/mcp.js'

const photoFixture = {
  id: 123,
  width: 4000,
  height: 3000,
  url: 'https://www.pexels.com/photo/123',
  photographer: 'Jane Doe',
  photographer_url: 'https://www.pexels.com/@janedoe',
  photographer_id: 42,
  avg_color: '#0c0c0c',
  src: { original: 'https://images.pexels.com/photos/123/original.jpg' },
  alt: 'A cat on a sofa',
}

describe('photos tools registration', () => {
  it('lists all three photos-domain tools with read-only annotations', async () => {
    const { fn } = fakeFetch(() => jsonResponse({}))
    const client = await connect(fn)

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['pexels_search_photos', 'pexels_curated_photos', 'pexels_get_photo']),
    )
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint).toBe(true)
      expect(tool.annotations?.openWorldHint).toBe(true)
    }

    await client.close()
  })
})

describe('pexels_search_photos', () => {
  it('returns compact photos with pagination and rate-limit info', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse(
        {
          page: 1,
          per_page: 10,
          total_results: 1,
          next_page: null,
          photos: [photoFixture],
        },
        { headers: { 'x-ratelimit-limit': '200', 'x-ratelimit-remaining': '199' } },
      ),
    )
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_search_photos',
      arguments: { query: 'cats' },
    })
    const body = parseResult(res as never) as {
      photos: Array<{ id: number; credit: { text: string } }>
      total_results: number
      has_next_page: boolean
      rate_limit: { remaining: number }
    }

    expect(body.photos).toHaveLength(1)
    expect(body.photos[0]!.id).toBe(123)
    expect(body.photos[0]!.credit.text).toBe('Photo by Jane Doe on Pexels')
    expect(body.total_results).toBe(1)
    expect(body.has_next_page).toBe(false)
    expect(body.rate_limit.remaining).toBe(199)

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/search')
    expect(url.searchParams.get('query')).toBe('cats')

    await client.close()
  })

  it('clamps per_page to the documented max of 80', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ photos: [] }))
    const client = await connect(fn)

    await client.callTool({
      name: 'pexels_search_photos',
      arguments: { query: 'cats', per_page: 500 },
    })

    const url = new URL(calls[0]!)
    expect(url.searchParams.get('per_page')).toBe('80')

    await client.close()
  })

  it('rejects an invalid locale with a helpful isError message before calling the API', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ photos: [] }))
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_search_photos',
      arguments: { query: 'cats', locale: 'xx-XX' },
    })

    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('Invalid locale "xx-XX"')
    expect(text).toContain('en-US')
    // The bad locale is caught before ever hitting the client.
    expect(calls.length).toBe(0)

    await client.close()
  })

  it('surfaces a Pexels 401 as a clean isError result', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ error: 'Invalid API key' }, { status: 401 }))
    const client = await connect(fn)

    const res = await client.callTool({
      name: 'pexels_search_photos',
      arguments: { query: 'cats' },
    })

    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('401')

    await client.close()
  })
})

describe('pexels_curated_photos', () => {
  it('returns compact photos', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ page: 1, photos: [photoFixture] }))
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_curated_photos', arguments: {} })
    const body = parseResult(res as never) as { photos: Array<{ id: number }> }
    expect(body.photos).toHaveLength(1)

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/curated')

    await client.close()
  })
})

describe('pexels_get_photo', () => {
  it('returns a single compact photo, coercing a string id to a number', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse(photoFixture))
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_get_photo', arguments: { id: '123' } })
    const body = parseResult(res as never) as { photo: { id: number } }
    expect(body.photo.id).toBe(123)

    const url = new URL(calls[0]!)
    expect(url.pathname).toBe('/v1/photos/123')

    await client.close()
  })

  it('surfaces a 404 as a clean isError result', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ error: 'Not found' }, { status: 404 }))
    const client = await connect(fn)

    const res = await client.callTool({ name: 'pexels_get_photo', arguments: { id: 999 } })
    expect(res.isError).toBe(true)
    const text = (res.content as Array<{ text: string }>)[0]!.text
    expect(text).toContain('404')

    await client.close()
  })
})

import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse } from './helpers/mcp.js'

// Resources are static, so a never-called fake fetch is fine.
const noFetch = fakeFetch(() => jsonResponse({})).fn

describe('resources', () => {
  it('exposes and reads the usage-guide resource', async () => {
    const client = await connect(noFetch)
    const { resources } = await client.listResources()
    expect(resources.some((r) => r.uri === 'pexels://guides/usage')).toBe(true)

    const res = await client.readResource({ uri: 'pexels://guides/usage' })
    const text = (res.contents[0] as { text: string }).text
    expect(text).toContain('credit')
    expect(text).toContain('not required')
    expect(text).toContain('pexels_list_my_collections')

    await client.close()
  })
})

describe('prompts', () => {
  it('templates find_photo from the subject argument', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'find_photo')).toBe(true)

    const got = await client.getPrompt({
      name: 'find_photo',
      arguments: { subject: 'a foggy pine forest', orientation: 'landscape' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('a foggy pine forest')
    expect(text).toContain('landscape orientation')
    expect(text).toContain('pexels_search_photos')
    expect(text).toContain('credit')

    await client.close()
  })

  it('tolerates an empty optional orientation (clients send "" not undefined)', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'find_photo',
      arguments: { subject: 'mountains', orientation: '' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('mountains')
    expect(text).not.toContain('orientation')

    await client.close()
  })

  it('ignores an unrecognized orientation rather than rejecting the call', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'find_photo',
      arguments: { subject: 'oceans', orientation: 'sideways' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('oceans')
    expect(text).not.toContain('sideways')

    await client.close()
  })

  it('templates photo_gallery with theme, count, orientation, and a hex color', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'photo_gallery')).toBe(true)

    const got = await client.getPrompt({
      name: 'photo_gallery',
      arguments: {
        theme: 'autumn forests',
        count: '8',
        orientation: 'landscape',
        color: '#ff8800',
      },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('autumn forests')
    expect(text).toContain('per_page: 8')
    expect(text).toContain('orientation: "landscape"')
    expect(text).toContain('color: "#ff8800"')
    expect(text).toContain('pexels_search_photos')

    await client.close()
  })

  it('photo_gallery falls back to a default count and ignores an invalid orientation', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'photo_gallery',
      arguments: { theme: 'city skylines', count: '', orientation: 'sideways' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('per_page: 5')
    expect(text).not.toContain('orientation:')
  })

  it('photo_gallery clamps an oversized count to the max of 10', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'photo_gallery',
      arguments: { theme: 'oceans', count: '100' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('per_page: 10')
  })

  it('templates find_video with subject and orientation', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'find_video')).toBe(true)

    const got = await client.getPrompt({
      name: 'find_video',
      arguments: { subject: 'waves crashing on rocks', orientation: 'landscape' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('waves crashing on rocks')
    expect(text).toContain('landscape orientation')
    expect(text).toContain('pexels_search_videos')
    expect(text).toContain('video_files')

    await client.close()
  })

  it('templates collection_tour with theme and count', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'collection_tour')).toBe(true)

    const got = await client.getPrompt({
      name: 'collection_tour',
      arguments: { theme: 'urban architecture', count: '7' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('urban architecture')
    expect(text).toContain('per_page: 7')
    expect(text).toContain('pexels_list_featured_collections')
    expect(text).toContain('pexels_get_collection_media')
    expect(text).toContain('media_type')

    await client.close()
  })

  it('collection_tour falls back to the default count of 5', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'collection_tour',
      arguments: { theme: 'nature' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('per_page: 5')
  })

  it('templates media_brief with independent photo and video counts', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'media_brief')).toBe(true)

    const got = await client.getPrompt({
      name: 'media_brief',
      arguments: { theme: 'cozy autumn mornings', photo_count: '5', video_count: '1' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('cozy autumn mornings')
    expect(text).toContain('pexels_search_photos` (per_page: 5)')
    expect(text).toContain('pexels_search_videos` (per_page: 1)')

    await client.close()
  })

  it('media_brief falls back to independent default counts', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'media_brief',
      arguments: { theme: 'oceans' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('pexels_search_photos` (per_page: 3)')
    expect(text).toContain('pexels_search_videos` (per_page: 2)')
  })
})

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
})

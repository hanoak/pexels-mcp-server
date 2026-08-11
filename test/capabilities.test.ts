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

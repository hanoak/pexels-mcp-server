import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse } from './helpers/mcp.js'

describe('server instructions', () => {
  it('sends usage/license guidance to the client on initialize', async () => {
    const { fn } = fakeFetch(() => jsonResponse({}))
    const client = await connect(fn)
    const instructions = client.getInstructions()
    expect(instructions).toBeDefined()
    // The load-bearing guidance.
    expect(instructions).toContain('credit')
    expect(instructions).toContain('do not rehost')
    expect(instructions).toContain('pexels_list_my_collections')
    expect(instructions).toContain('untrusted data')
    expect(instructions).toContain('safe-search')

    await client.close()
  })
})

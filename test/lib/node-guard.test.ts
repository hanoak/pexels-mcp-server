import { createRequire } from 'node:module'

import { describe, expect, it } from 'vitest'

import { MIN_NODE_MAJOR, nodeVersionError } from '../../src/lib/node-guard.js'

describe('nodeVersionError', () => {
  it('accepts the running Node.js runtime', () => {
    expect(nodeVersionError()).toBeNull()
  })

  it('accepts the exact minimum major', () => {
    expect(nodeVersionError(`${MIN_NODE_MAJOR}.0.0`)).toBeNull()
  })

  it('accepts a newer major', () => {
    expect(nodeVersionError(`${MIN_NODE_MAJOR + 4}.1.0`)).toBeNull()
  })

  it('rejects an older major with an actionable message', () => {
    const message = nodeVersionError('18.19.0')
    expect(message).not.toBeNull()
    expect(message).toContain(`>= ${MIN_NODE_MAJOR}`)
    expect(message).toContain('18.19.0')
  })

  it('rejects the major just below the minimum', () => {
    expect(nodeVersionError(`${MIN_NODE_MAJOR - 1}.9.9`)).not.toBeNull()
  })

  it('does not block on an unrecognised version string', () => {
    expect(nodeVersionError('not-a-version')).toBeNull()
  })
})

describe('MIN_NODE_MAJOR', () => {
  it('stays in sync with package.json engines.node', () => {
    // package.json is the documented source of truth (and the range npm
    // enforces at install). The guard mirrors it; this asserts the mirror is
    // accurate so the two can never drift silently.
    const pkg = createRequire(import.meta.url)('../../package.json') as {
      engines?: { node?: string }
    }
    const declaredMajor = Number.parseInt(pkg.engines?.node?.match(/\d+/)?.[0] ?? '', 10)
    expect(declaredMajor).toBe(MIN_NODE_MAJOR)
  })
})

/**
 * Minimum supported Node.js major version. Mirrors `engines.node` (">=20") in
 * package.json — keep the two in sync.
 */
export const MIN_NODE_MAJOR = 20

/**
 * Returns a friendly, actionable message when the running Node.js is older than
 * we support, or `null` when it is fine. Pure and parameterised so it can be
 * unit-tested without spawning old runtimes. An unrecognised version string is
 * treated as acceptable — we never block on a format we don't understand.
 */
export function nodeVersionError(
  version: string = process.versions.node,
  min: number = MIN_NODE_MAJOR,
): string | null {
  const major = Number.parseInt(version.split('.')[0] ?? '', 10)
  if (Number.isNaN(major)) return null
  if (major >= min) return null
  return (
    `pexels-mcp-server requires Node.js >= ${min}, but the current version is ${version}. ` +
    `Please upgrade Node.js (https://nodejs.org) and try again.`
  )
}

import { execSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeAll, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))
const distEntry = path.join(repoRoot, 'dist', 'index.js')

beforeAll(() => {
  // This test drives the *built* bin over real stdio. In CI the test job runs
  // before the build step, so build on demand when dist/ is absent (tsup ~1s).
  if (!existsSync(distEntry)) {
    execSync('npm run build', { cwd: repoRoot, stdio: 'ignore' })
  }
}, 120_000)

it('emits only newline-delimited JSON-RPC on stdout (all logs go to stderr)', async () => {
  const child = spawn(process.execPath, [distEntry], {
    cwd: repoRoot,
    // LOG_LEVEL=debug maximises log output — if any of it leaks to stdout the
    // JSON.parse assertion below fails, which is exactly what we want to catch.
    env: { ...process.env, PEXELS_API_KEY: 'test-key', LOG_LEVEL: 'debug' },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (!child.stdin || !child.stdout || !child.stderr) {
    throw new Error('child process pipes are unavailable')
  }

  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => (stdout += chunk))
  child.stderr.on('data', (chunk: string) => (stderr += chunk))

  const send = (message: Record<string, unknown>): void => {
    child.stdin!.write(`${JSON.stringify(message)}\n`)
  }

  // A minimal handshake + tools/list. None of these touch the Pexels API.
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'stdout-purity-test', version: '0.0.0' },
    },
  })
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })

  // Wait until the tools/list response (id 2) arrives, or give up after 5s.
  const deadline = Date.now() + 5000
  while (Date.now() < deadline && !stdout.includes('"id":2')) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // Close stdin so the server shuts down cleanly; kill as a safety net.
  child.stdin.end()
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill()
      resolve()
    }, 3000)
    child.on('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })

  const lines = stdout.split('\n').filter((line) => line.trim() !== '')
  expect(lines.length).toBeGreaterThan(0)
  for (const line of lines) {
    // Throws (failing the test) the moment the server writes non-JSON to stdout.
    const parsed = JSON.parse(line) as { jsonrpc?: unknown }
    expect(parsed.jsonrpc).toBe('2.0')
  }

  // Sanity: the server *did* log at debug, and every byte of it went to stderr.
  expect(stderr).toContain('started on stdio')
}, 30_000)

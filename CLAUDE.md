# pexels-mcp-server — project instructions

Production-ready, open-source npm package: an MCP (Model Context Protocol) server exposing the Pexels stock photo/video API as tools for LLM clients (Claude Desktop, Cursor, etc.), distributed via `npx`. Same quality bar as the author's prior `@hanoak/unsplash-mcp-server` (shipped v1→v3, 2026-07-22 to 2026-08-08): production-ready, legally sound, robust, easy to maintain, expected to get real community traction.

This file absorbs the one-time bootstrap doc that seeded this project (originally `docs/PEXELS_MCP_BOOTSTRAP.md`, transplanted from lessons learned building `unsplash-mcp-server`) as living, ongoing instructions rather than a disposable kickoff note. The current build plan lives at `docs/ROADMAP.md`.

## Tech stack (settled, don't relitigate)

- TypeScript + Node, **ESM-only** (MCP SDK is ESM), **Node 20+** target.
- Build: **tsup** (ESM output + `.d.ts` + shebang banner).
- Validation: **zod**, lenient/passthrough on API responses — only validate fields actually consumed, so an unknown/renamed upstream field degrades gracefully instead of breaking a tool.
- Transport: **stdio**.
- SDK: `@modelcontextprotocol/sdk` (currently `1.30.0` — re-check current version periodically).
- Distributed via npm, run via `npx`. Package: `@hanoak/pexels-mcp-server` (scoped — unscoped `pexels-mcp-server` is taken by an unrelated low-effort package), bin `pexels-mcp-server`.

## Folder & architecture conventions

- `src/index.ts` — bin entry + crash guards (SIGINT/SIGTERM/uncaughtException/unhandledRejection → stderr, never stdout).
- `src/server.ts` — `createServer(ctx)` + `runServer()` composition root; holds `SERVER_INSTRUCTIONS`.
- `src/config.ts`, `src/version.ts` — app-level, stay at root. `version.ts` reads from `package.json` via `createRequire`.
- `src/lib/` — generic infra: `logger.ts` (stderr-only leveled logger), `redact.ts` (secret redaction), `node-guard.ts` (Node-version guard).
- `src/pexels/` — domain layer: HTTP client, typed errors. Keep the client's `get()` generic; no typed endpoint methods (`searchPhotos()`) until real duplication appears. No `post`/`put`/`delete` — Pexels' API is entirely read-only, there is nothing to write.
- `src/schemas/` — response/wire schemas only, one file per resource type (`photo.ts`, `video.ts`, `collection.ts`, `pagination.ts`). Never put tool-input schemas here.
- `src/tools/` — MCP interface layer, one file per resource domain (`photos.ts`, `videos.ts`, `collections.ts` — no `search.ts`; Pexels splits search per media type at the endpoint level, so search lives inside each domain file). Each domain file holds that domain's input schemas + handlers + a `register<Domain>Tools(server, ctx)` registrar. `src/tools/index.ts` just calls each domain registrar. `src/tools/result.ts` holds one shared `toToolError(err, redact)`. `src/tools/format.ts` holds shared compact-output mappers.
- `src/resources.ts`, `src/prompts.ts`.
- Tests mirror `src/` 1:1 under `test/`.

**Do not**: move `config.ts`/`version.ts`, relocate `schemas/`, rename `lib/`→`utils/`, add barrels everywhere, pre-create empty tool files, or centralize errors prematurely.

## Pexels API facts (verified live 2026-08-11 — re-verify if stale)

- **Single auth tier**: one API key sent as `Authorization: YOUR_API_KEY` header (no prefix). No OAuth, no user-login flow, no write endpoints — every documented endpoint is GET-only.
- Endpoints: Photos — `/v1/search`, `/v1/curated`, `/v1/photos/:id`. Videos — `/v1/videos/search`, `/v1/videos/popular`, `/v1/videos/videos/:id`. Collections — `/v1/collections/featured`, `/v1/collections` (caller's own, same API key), `/v1/collections/:id` (media).
- Pagination: `page` (default 1), `per_page` (default 15, **max 80**).
- Rate limits: 200 req/hour, 20,000 req/month via `X-Ratelimit-Limit/Remaining/Reset` headers (present on 2xx only). **On exceed: standard `429`** (not Unsplash's 403-for-hourly-quota quirk) — headers are reportedly absent on the 429 itself, so cache the last-seen `X-Ratelimit-Reset` and report from that cache on a 429.
- License: attribution **not required** ("appreciated, not necessary"). No download-tracking endpoint exists. Real restrictions: no reselling unaltered content as a physical product, no redistributing to other stock/wallpaper platforms, no use in trademarks/logos, no implying endorsement, no depicting identifiable people negatively, no cloning the "core Pexels experience."
- No safe-search/content-filter parameter exists on any endpoint — document the absence, don't invent one.

## Git & commit workflow (explicit user preferences — not defaults)

- **Never auto-commit — always ask the user first.** Never add a `Co-Authored-By` trailer.
- **Single persistent `feature` branch** off `main`, no per-topic branches. Never commit directly to `main`. Merge `feature` → `main` only when asked.
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `chore:`…), enforced by commitlint.
- Do not enable GitHub's "Automatically delete head branches" setting — it would delete the persistent `feature` branch on a merge, not just bot branches.
- **No CI watcher after pushing** — the user checks GitHub Actions manually.
- When a plan has multiple logical units, commit **one unit at a time and stop for review after each**.
- After a rebase-and-merge PR, re-sync `feature` with `git reset --hard origin/main && git push --force-with-lease` rather than a plain pull.

## CI/CD & release automation

- **Changesets** for version + changelog + npm publish, via `.github/workflows/release.yml` (`changesets/action`, `--provenance`, top-level `permissions: contents: read`, job-level `pull-requests: write`). `HUSKY: 0` in `release.yml` so husky doesn't block the changesets bot's own commit.
- `.github/workflows/ci.yml`: a `quality` job (typecheck/lint/format:check + coverage + license-check) and a build/test matrix across Node 20/22 × Linux/macOS/Windows. SHA-pin all actions.
- A `secret-scan.yml` running gitleaks across full history.
- `.github/dependabot.yml`: group dev-deps by minor/patch only, majors open as individual PRs.
- **First-release gotcha**: enable Settings → Actions → General → Workflow permissions → "Allow GitHub Actions to create and approve pull requests," or `changesets/action` 403s on PR creation.
- **CHANGELOG.md**: start as just `# Changelog` + `##` entries from day one — Changesets inserts new version sections immediately after the H1 and does not preserve prose between the H1 and first `##`.
- **NPM_TOKEN**: short-expiry granular token + npm 2FA right before first publish; revoke on npm itself right after; move to npm Trusted Publishing (OIDC) for subsequent releases.

## MCP-SDK-level facts

- Never write to **stdout** in a stdio MCP server — all logging to stderr, enforced via ESLint `no-console` (allow `error` only) plus a test that drives a real handshake and asserts stdout is pure JSON-RPC.
- Declare tool annotations (`readOnlyHint`, `openWorldHint`, `title`), namespace tool names (`pexels_search_photos`, not `search_photos`), populate the `instructions` field on `initialize`, honor `notifications/cancelled` via `AbortSignal`, return recoverable API failures as `isError: true` tool results (not JSON-RPC protocol errors) — only real transport faults should throw.
- Tool `inputSchema`s should stay flat and JSON-Schema-safe — no top-level unions/`anyOf`, no deep refinements (cross-field checks go in the handler).
- MCP prompt `argsSchema` fields should be plain `z.string()`/`.optional()`, never `z.enum`/non-string types — some clients (Claude Desktop) send `""` for an unfilled optional arg, which a strict/enum schema rejects with `-32602`.
- `completable()` prompt-argument completions were confirmed broken for any `.optional()` Zod field on SDK `1.29.0`/`1.30.0` — re-test against whatever SDK version is current before relying on it.

## Reference implementation

The author's `unsplash-mcp-server` project (a sibling repo on the maintainer's machine, not part of this repository) is the architectural reference this project's conventions were derived from — when unsure of a pattern (error handling shape, test structure, CI YAML, package.json script names), its equivalent file was consulted before inventing a new one. This project's `docs/ROADMAP.md` was adapted from that project's own checklist-turned-roadmap doc.

# pexels-mcp-server — status & roadmap

What has shipped and what's planned next. The **roadmap** below covers upcoming releases; the detailed **v1 implementation checklist** — everything built and verified for the first release — is preserved beneath it as the record of what shipped.

## Roadmap

### ✅ v1 — shipped

The entire documented Pexels API surface in one release: **9 tools** across photos (`search`, `curated`, `get`), videos (`search`, `popular`, `get`), and collections (`featured`, `mine`, `media`); a `pexels://guides/usage` resource; a 5-prompt library (`find_photo`, `photo_gallery`, `find_video`, `collection_tour`, `media_brief`); a robust retrying HTTP client with Pexels-specific rate-limit-quota caching; and CI quality gates (coverage, dependency-license, package validation). Full detail in the checklist below.

Unlike Unsplash's v1/v2/v3 split, there is no v2-equivalent phase here: Pexels has a single API-key auth tier and no write endpoints, so there was no auth boundary to hold work behind. v1 is the whole surface, built to full production-readiness from the start.

### Future scope (speculative — not committed, revisit if a real need appears)

- **Structured tool output** (`outputSchema`/`structuredContent`) — worth reconsidering fresh rather than assuming Unsplash's "not needed" call applies here too. Video results (`video_files[]` with `quality`/`fps`/dimensions/`link`) are a stronger case for it than anything in the photo-only Unsplash project — a programmatic consumer would genuinely benefit from picking a rendition by typed fields. Gate on a real consumer asking before building it.
- **Short-TTL in-memory response cache** — deferred for the same reason it was skipped in the reference project: the client's quota short-circuit (refuses further calls once `remaining` hits 0, rather than firing a doomed request) already mitigates the tighter 200 req/hour budget cheaply. Revisit if real quota pressure appears in practice.
- **More prompts/resources** — e.g. a "picking a video rendition" guide resource, or prompts oriented around specific use cases (b-roll sourcing, social-clip sizing) as real usage patterns emerge.
- **Unscheduled**: HTTP/streamable transport; a `.mcpb` Desktop Extension bundle (same deferral logic as most `npx`-based MCP servers — it already works across every supported client, and the concrete win, a Smithery listing, needs a hosted URL or `.mcpb` bundle either way); a scheduled live schema-drift canary against the real Pexels API.

Changes are tracked in [CHANGELOG.md](../CHANGELOG.md); the project follows [Semantic Versioning](https://semver.org).

---

## v1 implementation checklist

Everything below was built and verified for the first release; the few remaining `[ ]`/`[~]` items are release-time steps or deferred to the roadmap above.

**Status legend:** `[ ]` not started · `[~]` in progress (release-time) · `[x]` done
**Tags:** `[v1]` in the first release · `[post-v1]` deferred (see Roadmap).

---

## 0. Core stack decisions (foundational)

- [x] `[v1]` Language/runtime: **TypeScript + Node** ✅ decided
- [x] `[v1]` Runtime validation with **zod** (tool inputs _and_ Pexels API responses) ✅ response schemas in `src/schemas/`; tool-input schemas on all 9 tools
- [x] `[v1]` Transport: **stdio** first (HTTP/SSE possible later) ✅ decided
- [x] `[v1]` Module format: **ESM-only** ✅ decided (MCP SDK is ESM; simplest for a bin package)
- [x] `[v1]` Node version target: **Node 20+** ✅ decided (Node 18 is EOL)
- [x] `[v1]` Use **lenient/passthrough zod on API responses** — validate only fields we consume, so an upstream field add/rename/reorder degrades gracefully instead of breaking every tool ✅ (`src/schemas/`: only `id` required, rest optional/nullable, unknown fields stripped; `parseResponse` warns-then-surfaces)

## 1. Pexels license & API compliance (legal — non-negotiable)

- [x] `[v1]` Attribution is **not required** — still return a ready-to-use courtesy credit (photographer name + Pexels link) ✅ `credit` field on every photo (`src/tools/format.ts`)
- [x] `[v1]` Serve image/video URLs directly from Pexels (no hotlink/rehost) ✅ return Pexels URLs, never rehosted
- [x] `[v1]` No "core Pexels experience" clone; no automated bulk downloading ✅ README compliance statement, per-item tool design (not a bulk export)
- [x] `[v1]` Rate-limit handling + clear docs (200 req/hour, 20,000 req/month) ✅ client surfaces `rate_limit`; README documents the budget + troubleshooting
- [x] `[v1]` Send the required header: `Authorization: <API key>` (header, never a query param) ✅ (`src/pexels/client.ts`)
- [x] `[v1]` "Unofficial — not affiliated with or endorsed by Pexels" disclaimer (README + package.json) + brand/trademark compliance ✅
- [x] `[v1]` Document the free API-key registration flow ✅ README Quick start
- [x] `[v1]` State that each user operates under their own Pexels API/License Terms — sets the liability boundary ✅ README License & compliance section
- [x] `[v1]` Document the license restrictions that do apply even without mandatory attribution ✅ README + `pexels://guides/usage` resource + `SERVER_INSTRUCTIONS`

## 2. Security & secrets

- [x] `[v1]` API key via env var only (`PEXELS_API_KEY`); never logged/committed ✅ (`src/config.ts` reads env only; never logged)
- [x] `[v1]` `.env.example` committed; real `.env` gitignored ✅ (`.gitignore` covers `.env*`)
- [x] `[v1]` Secret scanning (pre-commit hook / CI, e.g. gitleaks) ✅ local `gitleaks protect --staged` pre-commit hook (skip-if-absent + warn) + CI gitleaks Action full-history scan
- [x] `[v1]` Dependency security: `npm audit`, Dependabot, minimal deps ✅ Dependabot + `npm audit --omit=dev --audit-level=high` step in CI
- [x] `[v1]` Input sanitization before hitting the API ✅ zod input schemas + clamping + path-segment handling
- [x] `[v1]` Supply-chain: `npm publish --provenance`, committed lockfile, pinned CI actions (by SHA) ✅
- [x] `[v1]` **Fail-fast startup validation** of `PEXELS_API_KEY` — actionable stderr message + non-zero exit ✅ (`loadConfig` in `runServer`; verified live)
- [x] `[v1]` **Redact** the API key from all error messages and debug logs ✅ wired into the HTTP client and the tool layer's `isError` results via `ctx.redact`
- [~] `[v1]` Protect the publish path: npm account 2FA + OIDC trusted publishing (or a scoped least-privilege automation token) — release.yml wired for token + provenance publish; user must add the `NPM_TOKEN` secret and enable npm 2FA/trusted publishing before first release
- [x] `[v1]` Least-privilege GitHub Actions permissions (top-level `permissions: contents: read`) ✅ (all three workflows)
- [x] `[v1]` Dependency license-compliance check in CI ✅ `npm run license:check` (permissive-SPDX allowlist) in the CI quality job

**N/A — no SSRF-guard item**: unlike Unsplash's `track_download`, no Pexels tool follows a URL taken from a prior API response; every call targets a fixed, known endpoint.

## 3. Reliability & robustness

- [x] `[v1]` Error mapping: Pexels 401/403/404/429/5xx → clean MCP errors w/ actionable messages ✅ (`src/pexels/client.ts`)
- [x] `[v1]` Retries & backoff for 429/5xx (respect `Retry-After`) ✅
- [x] `[v1]` Network timeouts (never hang forever) ✅ (`AbortSignal.timeout`, 10s default, combined with caller signal)
- [x] `[v1]` Rate-limit awareness: read `X-Ratelimit-Remaining`, surface it ✅
- [x] `[v1]` **Handle 429 = rate limit exceeded** — Pexels omits the rate-limit headers on the 429 itself, so the client caches the last-seen values from a prior 2xx and reports an accurate reset time ✅
- [x] `[v1]` **Quota short-circuit**: once `remaining` hits 0 with a known future reset time, fail fast instead of firing a doomed request ✅ verified fetch is never called again until the reset time passes
- [x] `[post-v1]` Short-TTL in-memory metadata cache — **Closed / skipped for v1**: the quota short-circuit above is the cheaper first mitigation for the 200 req/hour budget. Revisit if real quota pressure appears.

## 4. Testing & quality

- [x] `[v1]` Unit tests (Vitest) with the Pexels API mocked via dependency injection (fake `fetch`) — no real calls in CI ✅
- [x] `[v1]` Type-checking in CI, lint, format checks ✅
- [x] `[v1]` Coverage thresholds ✅ v8 coverage with a regression floor (85/83/79/86), enforced in CI via `npm run test:coverage`
- [x] `[v1]` Smoke/integration test for the MCP server handshake ✅ in-memory Client↔Server integration tests across every domain
- [x] `[v1]` **Enforce stdout purity**: ESLint `no-console` (allow `error` only) + a test asserting stdout carries only valid JSON-RPC ✅ out-of-process child-process test drives a real handshake with `LOG_LEVEL=debug`
- [x] `[v1]` E2E test that invokes a real tool over the transport ✅ in-memory tool-call tests across all 9 tools
- [x] `[v1]` Validate zod schemas against real Pexels response shapes ✅ hand-verified live via MCP Inspector, Claude Code, and Claude Desktop across all 9 tools, including the collection-media `type`-field discrimination
- [x] `[v1]` CI test matrix: Node 20/22 × Linux/macOS/Windows (+ `.nvmrc`) ✅
- [x] `[v1]` Document MCP Inspector in the dev/contributor workflow ✅ CONTRIBUTING.md

## 5. CI/CD & release automation ("easy to update in future")

- [x] `[v1]` GitHub Actions: test/lint/build on PR ✅
- [x] `[v1]` Automated releases (Changesets): version + changelog + npm publish ✅
- [x] `[v1]` Conventional commits (pairs with automated releases) ✅ enforced via commitlint on the `commit-msg` hook
- [x] `[v1]` npm publish provenance ✅

## 6. Developer & contributor experience ("community traction")

- [x] `[v1]` README: quick start, `npx` one-liner, Claude Desktop/Cursor/VS Code config, tool reference ✅
- [x] `[v1]` CONTRIBUTING.md ✅
- [x] `[v1]` CODE_OF_CONDUCT.md ✅ Contributor Covenant 2.1
- [x] `[v1]` Issue/PR templates ✅
- [x] `[v1]` LICENSE confirmed permissive (MIT) ✅
- [x] `[v1]` SECURITY.md ✅
- [x] `[v1]` Badges: npm version, build status, license ✅
- [x] `[v1]` Semantic versioning commitment ✅
- [x] `[v1]` Explicit **no-telemetry / privacy statement** ✅
- [x] `[v1]` README troubleshooting section ✅

## 7. API surface / DX of the server

- [x] `[v1]` Decide tool set ✅ 9 tools: photos (search/curated/get), videos (search/popular/get), collections (featured/mine/media)
- [x] `[v1]` Consistent, well-described tool schemas ✅
- [x] `[v1]` Token-efficient output shape ✅ `toCompactPhoto`/`toCompactVideo`/`toCompactCollection`, `video_files` trimmed in list contexts
- [x] `[v1]` Pagination support ✅
- [x] `[v1]` **Clamp/normalize params to Pexels bounds**: `per_page` ≤80, `page` ≥1, zod enums for `orientation`/`size`, lenient strings for `color`/`locale` ✅
- [x] `[v1]` Return **hotlinkable image/video URLs + metadata as text, never base64 blobs** ✅
- [x] `[v1]` Surface Pexels' own pre-sized URLs (`src.*` for photos, `video_files[]` renditions for videos) ✅

## 8. Distribution & runtime

- [x] `[v1]` `bin` entry for `npx` + shebang ✅
- [x] `[v1]` `files` field ships only `dist/` ✅ (`npm pack --dry-run`: 6 files, no source leak)
- [x] `[v1]` Build tooling: **tsup** ✅
- [x] `[v1]` Cross-platform (macOS/Linux/Windows) ✅ (CI matrix)
- [x] `[v1]` **Pre-publish package validation** in CI: `publint` + `attw` + `npm pack --dry-run` + bin smoke test ✅
- [x] `[v1]` Declare `engines.node` + a runtime Node-version guard ✅
- [x] `[v1]` Support `--version` / `--help` and detect a TTY on the bin ✅
- [x] `[v1]` Populate package.json discoverability metadata ✅
- [x] `[v1]` npm name: **`@hanoak/pexels-mcp-server`** ✅ decided (unscoped `pexels-mcp-server` taken by an unrelated package)
- [x] `[post-v1]` Ship a Desktop Extension (`.mcpb`) bundle — **unscheduled future scope**, same rationale as the reference project (see Roadmap above)

## 9. Observability (lightweight)

- [x] `[v1]` Optional debug logging to **stderr only** ✅ (`src/lib/logger.ts`, `LOG_LEVEL`)
- [x] `[v1]` Version/health info ✅ `--version` bin flag + version in the MCP `initialize` response

## 10. Docs & maintenance

- [x] `[v1]` CHANGELOG (auto-generated) ✅ Changesets manages it via `changeset version`
- [x] `[v1]` Compatibility matrix (MCP SDK / Node versions supported) ✅ README Compatibility table
- [x] `[v1]` Deprecation policy for future breaking changes ✅ CONTRIBUTING.md

## 11. MCP protocol correctness (most-flagged gap)

- [x] `[v1]` Return recoverable failures as tool results with `isError: true`, **not** JSON-RPC protocol errors ✅
- [x] `[v1]` Graceful shutdown + crash safety ✅
- [x] `[v1]` Declare MCP tool annotations (`readOnlyHint: true`, `openWorldHint: true`, `title`) on all 9 tools ✅
- [x] `[v1]` Namespace tool names (`pexels_search_photos`, not `search_photos`) ✅
- [x] `[v1]` Populate the server `instructions` field on initialize ✅
- [x] `[v1]` Keep tool `inputSchema`s flat and JSON-Schema-safe ✅ cross-field checks (`min_duration <= max_duration`) live in handlers, never zod `.refine()`
- [x] `[post-v1]` Structured tool output via `outputSchema` + `structuredContent` — **deferred**, see Roadmap above
- [x] `[v1]` Honor MCP request cancellation (`notifications/cancelled` → `AbortController`) ✅ `extra.signal` threaded through every `client.get` call
- [x] `[v1]` MCP Resources / Prompts ✅ `pexels://guides/usage` resource (`src/resources.ts`) + 5-prompt library (`src/prompts.ts`)

## 12. Content safety & responsible use

- [x] `[v1]` Document the **absence** of a safe-search/content-filter parameter on the Pexels API ✅ README + `SERVER_INSTRUCTIONS`
- [x] `[v1]` Treat Pexels text fields as untrusted data / indirect prompt-injection surface ✅ `SERVER_INSTRUCTIONS` directive + README "Handling of Pexels text"

## 13. Discovery & ecosystem

- [ ] `[v1]` List on the official MCP registry (`server.json` manifest) + community catalogs — **pending**, planned for immediately after v1 ships (see the build plan's discovery phase)

## 14. Governance

- [x] `[v1]` Add CODEOWNERS (clear review owner; addresses bus-factor) ✅ `.github/CODEOWNERS` (`* @hanoak`)
- [x] `[v1]` `FUNDING.yml` sustainability signal — **Closed / skipped**: the project is non-profit and not seeking sponsorship.

---

### ⚠️ Top gotcha

Never write logs to **stdout** in a stdio MCP server — it corrupts the JSON-RPC stream. All logging → **stderr**. (Enforced mechanically in §4.)

# pexels-mcp-server — v1 production checklist

> Living reference for building `pexels-mcp-server` into a real, production-ready,
> open-source npm package. We work through these **one by one**. Update the status
> box (`[ ]` → `[x]`) as each item lands. Nothing here is "done" until it's tested.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done
**Scope:** every item is `[v1]`. Unlike a typical staged rollout, this is the *entire*
documented Pexels API in one release — Pexels has a single auth tier (one API key,
no OAuth, no write endpoints), so there's no auth-boundary split to defer work behind.
This file will be repurposed into a permanent status + roadmap doc once v1 ships
(see the full build plan for the sequencing this checklist maps onto).

---

## 0. Core stack decisions (foundational)

- [x] `[v1]` Language/runtime: **TypeScript + Node** ✅ decided
- [ ] `[v1]` Runtime validation with **zod** (tool inputs *and* Pexels API responses)
- [x] `[v1]` Transport: **stdio** first (HTTP/SSE possible later) ✅ decided
- [x] `[v1]` Module format: **ESM-only** ✅ decided (MCP SDK is ESM; simplest for a bin package)
- [x] `[v1]` Node version target: **Node 20+** ✅ decided (Node 18 is EOL)
- [ ] `[v1]` Use **lenient/passthrough zod on API responses** — validate only fields we consume, so an upstream field add/rename/reorder degrades gracefully instead of breaking every tool

## 1. Pexels license & API compliance (legal — non-negotiable)

Pexels' terms are meaningfully lighter than Unsplash's — verify all of the below against
live docs before relying on them; don't assume they stay this way forever.

- [ ] `[v1]` Attribution is **not required** ("appreciated, not necessary") — still return a ready-to-use courtesy credit (photographer name + Pexels link) so a caller who wants to credit can, without pretending it's mandatory
- [ ] `[v1]` Serve image/video URLs directly from Pexels (no hotlink/rehost)
- [ ] `[v1]` No "core Pexels experience" clone; no automated bulk downloading
- [ ] `[v1]` Rate-limit handling + clear docs (200 req/hour, 20,000 req/month; higher limits on request)
- [ ] `[v1]` Send the required header: `Authorization: <API key>` (**header, never a query param** — keeps the key out of loggable URLs)
- [ ] `[v1]` "Unofficial — not affiliated with or endorsed by Pexels" disclaimer (README + package.json) + brand/trademark compliance
- [ ] `[v1]` Document the free API-key registration flow (the #1 onboarding step) and the "request higher limits" path
- [ ] `[v1]` State that each user operates under their own Pexels API/License Terms — sets the liability boundary
- [ ] `[v1]` Document the license restrictions that **do** apply even without mandatory attribution: no reselling unaltered content as a physical product without modification, no redistributing on other stock-photo/wallpaper platforms, no use in trademarks/logos/business names, no implying endorsement, no depicting identifiable people in a bad or offensive light

**Explicitly does not apply — do not build:** a `download_location`-style tracking call (no such endpoint exists), UTM-tagged attribution params, mandatory-attribution enforcement.

## 2. Security & secrets

- [ ] `[v1]` API key via env var only (`PEXELS_API_KEY`); never logged/committed
- [ ] `[v1]` `.env.example` committed; real `.env` gitignored
- [ ] `[v1]` Secret scanning (pre-commit hook / CI, e.g. gitleaks)
- [ ] `[v1]` Dependency security: `npm audit`, Dependabot, minimal deps
- [ ] `[v1]` Input sanitization before hitting the API
- [ ] `[v1]` Supply-chain: `npm publish --provenance`, committed lockfile, pinned CI actions (by SHA)
- [ ] `[v1]` **Fail-fast startup validation** of `PEXELS_API_KEY` — actionable stderr message + non-zero exit, not a cryptic 401 mid-conversation
- [ ] `[v1]` **Redact** the API key / Authorization header from all error messages and debug logs
- [ ] `[v1]` Protect the publish path: npm account 2FA + OIDC trusted publishing (or a scoped least-privilege automation token)
- [ ] `[v1]` Least-privilege GitHub Actions permissions (top-level `permissions: contents: read`)
- [ ] `[v1]` Dependency license-compliance check in CI (prevent a copyleft transitive dep contaminating the permissive license)

**N/A — no SSRF-guard item**: unlike Unsplash's `track_download`, no Pexels tool follows a URL taken from a prior API response; every call targets a fixed, known endpoint.

## 3. Reliability & robustness

- [ ] `[v1]` Error mapping: Pexels 401/403/404/429/5xx → clean MCP errors w/ actionable messages
- [ ] `[v1]` Retries & backoff for 429/5xx (respect `Retry-After`)
- [ ] `[v1]` Network timeouts (never hang forever)
- [ ] `[v1]` Rate-limit awareness: read `X-Ratelimit-Remaining`, surface it
- [ ] `[v1]` **Handle 429 = rate limit exceeded** (standard, unlike Unsplash's 403-for-quota quirk) — the rate-limit headers are reportedly *absent* on the 429 response itself, so cache the last-seen `X-Ratelimit-Reset` from a prior 2xx and report from that cache
- [ ] `[v1]` **Quota short-circuit**: once `remaining` hits 0, fail fast with a clear "quota exhausted until `<reset time>`" error instead of firing a doomed request — the 200 req/hour ceiling is tight and has no documented free-tier upgrade path
- [ ] `[v1]` Short-TTL in-memory metadata cache — **defer unless real quota pressure appears**; the quota short-circuit above is the cheaper first mitigation

## 4. Testing & quality

- [ ] `[v1]` Unit tests (Vitest) with the Pexels API mocked via dependency injection (fake `fetch`) — no real calls in CI
- [ ] `[v1]` Type-checking in CI, lint, format checks
- [ ] `[v1]` Coverage thresholds
- [ ] `[v1]` Smoke/integration test for the MCP server handshake
- [ ] `[v1]` **Enforce stdout purity**: ESLint `no-console` (allow `console.error` only) + a test asserting stdout carries only valid JSON-RPC
- [ ] `[v1]` E2E test that invokes a real tool over the transport
- [ ] `[v1]` Validate zod schemas against real Pexels response shapes (hand-verified via MCP Inspector against a live key)
- [ ] `[v1]` CI test matrix: Node 20/22 × Linux/macOS/Windows (+ `.nvmrc`)
- [ ] `[v1]` Document MCP Inspector (`npx @modelcontextprotocol/inspector`) in the dev/contributor workflow

## 5. CI/CD & release automation ("easy to update in future")

- [ ] `[v1]` GitHub Actions: test/lint/build on PR
- [ ] `[v1]` Automated releases (Changesets): version + changelog + npm publish
- [ ] `[v1]` Conventional commits (pairs with automated releases)
- [ ] `[v1]` npm publish provenance

## 6. Developer & contributor experience ("community traction")

- [ ] `[v1]` README: quick start, `npx` one-liner, Claude Desktop/Cursor config, tool reference
- [ ] `[v1]` CONTRIBUTING.md
- [ ] `[v1]` CODE_OF_CONDUCT.md
- [ ] `[v1]` Issue/PR templates
- [ ] `[v1]` LICENSE confirmed permissive (MIT)
- [ ] `[v1]` SECURITY.md (vulnerability reporting)
- [ ] `[v1]` Badges: npm version, build status, license
- [ ] `[v1]` Semantic versioning commitment
- [ ] `[v1]` Explicit **no-telemetry / privacy statement** ("collects nothing, only contacts api.pexels.com")
- [ ] `[v1]` README troubleshooting section (key not set, Node too old, stale npx cache, wrong client config path)

## 7. API surface / DX of the server

- [ ] `[v1]` Decide tool set — search/curated/get for photos, search/popular/get for videos, featured/media/mine for collections (9 tools total; see the build plan for the full table)
- [ ] `[v1]` Consistent, well-described tool schemas (descriptions matter — LLM reads them)
- [ ] `[v1]` Token-efficient output shape (trim huge Pexels responses, especially `video_files`/`video_pictures`)
- [ ] `[v1]` Pagination support
- [ ] `[v1]` **Clamp/normalize params to Pexels bounds**: `per_page` ≤80, `page` ≥1, zod enums for `orientation`/`size` (note: `square`, not Unsplash's `squarish`), lenient strings (not enums) for `color`/`locale`, URL-encode path params
- [ ] `[v1]` Return **hotlinkable image/video URLs + metadata as text, never base64 blobs**
- [ ] `[v1]` Surface Pexels' own pre-sized URLs (`src.original/large2x/large/medium/small/portrait/landscape/tiny` for photos; multiple `video_files` renditions for videos) rather than inventing custom resizing params — Pexels doesn't offer imgix-style query params like Unsplash does

## 8. Distribution & runtime

- [ ] `[v1]` `bin` entry for `npx` + shebang
- [ ] `[v1]` `files` field ships only `dist/`
- [x] `[v1]` Build tooling: **tsup** ✅ decided (ESM-only output; handles shebang + .d.ts)
- [ ] `[v1]` Cross-platform (macOS/Linux/Windows)
- [ ] `[v1]` **Pre-publish package validation** in CI: `publint` + `@arethetypeswrong/cli` + `npm pack --dry-run`, then run the bin via npx (handshake)
- [ ] `[v1]` Declare `engines.node` + a runtime Node-version guard (friendly message, not a cryptic crash)
- [ ] `[v1]` Support `--version` / `--help` and detect a TTY on the bin
- [ ] `[v1]` Populate package.json discoverability metadata (keywords: mcp/modelcontextprotocol/pexels/videos/stock-photos, description, repository, homepage, bugs)
- [x] `[v1]` npm name: **`@hanoak/pexels-mcp-server`** ✅ decided (unscoped `pexels-mcp-server` is taken by an unrelated package; scoped name confirmed free). Bin command: `pexels-mcp-server`.
- [ ] `[v1]` Ship a Desktop Extension (`.mcpb`) bundle for one-click Claude Desktop install — revisit priority once the tool surface is built and a real need (e.g. a Smithery listing) appears

## 9. Observability (lightweight)

- [ ] `[v1]` Optional debug logging to **stderr only** (stdout is the MCP transport — never log there)
- [ ] `[v1]` Version/health info

## 10. Docs & maintenance

- [ ] `[v1]` CHANGELOG (auto-generated via Changesets — start the file as just `# Changelog`, no intro prose)
- [ ] `[v1]` Compatibility matrix (MCP SDK / Node versions supported)
- [ ] `[v1]` Deprecation policy for future breaking changes

## 11. MCP protocol correctness (most-flagged gap)

- [ ] `[v1]` Return recoverable failures as tool results with `isError: true`, **not** JSON-RPC protocol errors
- [ ] `[v1]` Graceful shutdown + crash safety: exit on stdin EOF / SIGINT / SIGTERM; `uncaughtException`/`unhandledRejection` handlers logging to stderr
- [ ] `[v1]` Declare MCP tool annotations (`readOnlyHint: true`, `openWorldHint: true`, `title`) on all 9 tools — every tool is read-only, so a client can auto-approve the entire server
- [ ] `[v1]` Namespace tool names (`pexels_search_photos`, not `search_photos`)
- [ ] `[v1]` Populate the server `instructions` field on initialize (license/usage guidance, not download-tracking — that doesn't apply here)
- [ ] `[v1]` Keep tool `inputSchema`s flat and JSON-Schema-safe (no top-level unions/`anyOf`, no deep refinements — cross-field checks like `min_duration <= max_duration` go in the handler)
- [ ] `[v1]` Structured tool output (`outputSchema`/`structuredContent`) — reconsider fresh rather than inheriting Unsplash's "no"; video results (`video_files[]` with quality/fps/dimensions) are a stronger case for it than anything Unsplash had. Gate on a real consumer need.
- [ ] `[v1]` Honor MCP request cancellation (`notifications/cancelled` → `AbortController`)
- [ ] `[v1]` MCP Resources / Prompts (a license & usage guide resource, a prompt library covering both photo and video domains)

## 12. Content safety & responsible use

- [ ] `[v1]` Document the **absence** of any safe-search/content-filter parameter on the Pexels API (no equivalent to Unsplash's `content_filter=high`) in the README and server instructions, rather than inventing one that doesn't exist
- [ ] `[v1]` Treat Pexels text fields (`alt`, photographer/user names, collection titles/descriptions) as untrusted data / indirect prompt-injection surface — label clearly as data; never interpolate into privileged/system prompts

## 13. Discovery & ecosystem

- [ ] `[v1]` List on the official MCP registry (`server.json` manifest) + community catalogs (Glama, awesome-mcp-servers, mcp.so, PulseMCP; Smithery likely deferred — stdio-only npx vs. its hosted-URL/`.mcpb` expectation)

## 14. Governance

- [ ] `[v1]` Add CODEOWNERS (clear review owner; addresses bus-factor)
- [ ] `[v1]` `FUNDING.yml` sustainability signal — only if the project actually seeks sponsorship

---

### ⚠️ Top gotcha

Never write logs to **stdout** in a stdio MCP server — it corrupts the JSON-RPC stream. All logging → **stderr**. (Enforced mechanically in §4.)

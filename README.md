# pexels-mcp-server

[![npm version](https://img.shields.io/npm/v/@hanoak/pexels-mcp-server.svg)](https://www.npmjs.com/package/@hanoak/pexels-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@hanoak/pexels-mcp-server.svg)](https://www.npmjs.com/package/@hanoak/pexels-mcp-server)
[![CI](https://github.com/hanoak/pexels-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/hanoak/pexels-mcp-server/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](#requirements)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

A production-ready [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [Pexels API](https://www.pexels.com/api/). It gives AI assistants — Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, and any MCP client — tools to search and fetch Pexels photos, videos, and collections, covering **every endpoint the Pexels API documents**.

> [!IMPORTANT]
> **Unofficial project.** This is not affiliated with, endorsed by, or sponsored by Pexels. "Pexels" is a trademark of its respective owner. You use it under your own Pexels API account and are responsible for complying with the [Pexels License](https://www.pexels.com/license/).

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Example interaction](#example-interaction)
- [Configuration](#configuration)
- [Tools](#tools)
  - [Tool reference](#tool-reference)
  - [Output shape](#output-shape)
  - [Resources & prompts](#resources--prompts)
- [Example prompts](#example-prompts)
- [License & compliance](#license--compliance)
- [Rate limits](#rate-limits)
- [Handling of Pexels text](#handling-of-pexels-text)
- [Privacy & security](#privacy--security)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Requirements](#requirements)
- [Compatibility](#compatibility)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Contact & community](#contact--community)
- [License](#license)

## Features

- **9 tools** covering every documented Pexels endpoint — photos (search, curated, get), videos (search, popular, get), and collections (featured, media, mine). Pexels has a single API-key auth tier and no write endpoints, so there's no partial "read-only v1" — this is the whole surface.
- **License-aware by design** — Pexels doesn't require attribution, but every photo still returns a ready-to-use courtesy `credit` (text + HTML), and the server's instructions steer the model around the license restrictions that do apply (no resale of unaltered content, no redistribution to other stock platforms, no trademark/logo use, no implied endorsement).
- **Real image & video URLs** — each photo returns Pexels' own pre-sized `src` URLs (original/large2x/large/medium/small/portrait/landscape/tiny); each video returns its `video_files` renditions (trimmed to the highest-resolution few in list results, complete on a single-item lookup).
- **Token-efficient output** — full Pexels responses are trimmed to a compact shape (URLs + metadata as text, never base64 blobs) to keep model context small.
- **Robust** — typed failures returned as MCP `isError` results the model can recover from, plus retries/backoff, timeouts, and rate-limit-aware quota short-circuiting (Pexels omits its rate-limit headers on a `429`, so the client caches the last-known reset time instead of guessing).
- **Safe** — API-key redaction in all error output, and untrusted-text handling guidance for indirect prompt-injection defence.
- **Lean & modern** — ESM, Node 20+, zero-install via `npx`, no telemetry.

## Quick start

### 1. Get a Pexels API key

Create a free account at **[pexels.com/api](https://www.pexels.com/api/)** and you'll receive an API key instantly — no app review, no approval wait.

### 2. Add the server to your MCP client

**Claude Desktop** — edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pexels": {
      "command": "npx",
      "args": ["-y", "@hanoak/pexels-mcp-server"],
      "env": {
        "PEXELS_API_KEY": "your_api_key"
      }
    }
  }
}
```

Restart the client. See [Configuration](#configuration) for every supported variable.

<details>
<summary><b>Other clients (Claude Code, Cursor, VS Code, Windsurf, generic stdio)</b></summary>

**Claude Code** (CLI):

```bash
claude mcp add pexels \
  --env PEXELS_API_KEY=your_api_key \
  -- npx -y @hanoak/pexels-mcp-server
```

**Cursor** — `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project): use the exact same `mcpServers` block as Claude Desktop above.

**Windsurf** — `~/.codeium/windsurf/mcp_config.json`: same `mcpServers` block as Claude Desktop above.

**VS Code** — `.vscode/mcp.json` (note the top-level key is `servers`, not `mcpServers`):

```json
{
  "servers": {
    "pexels": {
      "command": "npx",
      "args": ["-y", "@hanoak/pexels-mcp-server"],
      "env": {
        "PEXELS_API_KEY": "your_api_key"
      }
    }
  }
}
```

**Any other MCP client** — run the server over **stdio** with:

```bash
PEXELS_API_KEY=your_api_key npx -y @hanoak/pexels-mcp-server
```

Point your client's stdio transport at `command: npx`, `args: ["-y", "@hanoak/pexels-mcp-server"]`, and pass the key via `env`.

</details>

### 3. Try it

Restart your client and ask:

> _"Find me a photo of mountains on Pexels."_

## Example interaction

A typical flow: the model calls `pexels_search_photos`, picks a result, and presents the image with its courtesy credit.

> **You:** Find a landscape photo of a foggy pine forest.
>
> **Assistant:** _(calls `pexels_search_photos` with `query: "foggy pine forest"`, `orientation: "landscape"`, picks the best result)_
> Here's a great match — photo by Jane Doe on Pexels — along with the image URL and a ready-to-use credit line.

Each tool returns a compact JSON payload. Here's the shape of a single photo result (illustrative values):

<details>
<summary><b>Example tool output</b></summary>

```json
{
  "photo": {
    "id": 1103970,
    "alt": "Photography of Trees at Foggy Forest",
    "width": 4000,
    "height": 2667,
    "avg_color": "#3E361F",
    "url": "https://www.pexels.com/photo/photography-of-trees-at-foggy-forest-1103970/",
    "src": {
      "original": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg",
      "large2x": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
      "large": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&h=650&w=940",
      "medium": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&h=350",
      "small": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&h=130",
      "portrait": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=800",
      "landscape": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
      "tiny": "https://images.pexels.com/photos/1103970/pexels-photo-1103970.jpeg?auto=compress&cs=tinysrgb&dpr=1&fit=crop&h=200&w=280"
    },
    "photographer": {
      "name": "Jane Doe",
      "url": "https://www.pexels.com/@janedoe",
      "id": 42
    },
    "credit": {
      "text": "Photo by Jane Doe on Pexels",
      "html": "Photo by <a href=\"https://www.pexels.com/@janedoe\">Jane Doe</a> on <a href=\"https://www.pexels.com\">Pexels</a>"
    }
  },
  "rate_limit": { "limit": 200, "remaining": 199, "resetEpoch": 1755000000 }
}
```

Every tool result includes a `rate_limit` object (`limit`, `remaining`, `resetEpoch`) read from the Pexels response headers. List/search tools wrap results in `photos`/`videos`/`collections`/`media` arrays with pagination fields (`total_results`, `page`, `per_page`, `has_next_page`).

</details>

## Configuration

Configuration is entirely via environment variables — no config files, no flags for secrets.

| Environment variable | Required | Description                                                                                                               |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| `PEXELS_API_KEY`     | **yes**  | Your Pexels API key. The server exits at startup with a clear message if it is missing or blank.                          |
| `LOG_LEVEL`          | no       | `debug` \| `info` \| `warn` \| `error` (default `info`). All logs go to **stderr**; stdout carries only the MCP protocol. |

CLI flags: `--version` and `--help` are supported (e.g. `npx @hanoak/pexels-mcp-server --version`).

## Tools

All tools are namespaced `pexels_*` and every one is **read-only** (`readOnlyHint: true`) — Pexels' API has no write endpoints, so a client can safely auto-approve the entire server. `per_page` is clamped to a max of **80** (Pexels' own documented max), and `page` is 1-based.

| Domain          | Tools                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| **Photos**      | `search_photos`, `curated_photos`, `get_photo`                             |
| **Videos**      | `search_videos`, `popular_videos`, `get_video`                             |
| **Collections** | `list_featured_collections`, `list_my_collections`, `get_collection_media` |

### Tool reference

<details>
<summary><b>Photos</b></summary>

| Tool                    | Parameters                                                                                                                                                                            | Description                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `pexels_search_photos`  | `query` **(required)**, `orientation?` (`landscape`\|`portrait`\|`square`), `size?` (`large`\|`medium`\|`small`), `color?` (named color or hex code), `locale?`, `page?`, `per_page?` | Keyword photo search with filters.                  |
| `pexels_curated_photos` | `page?`, `per_page?`                                                                                                                                                                  | Pexels' hand-curated photo picks, refreshed hourly. |
| `pexels_get_photo`      | `id` **(required)**                                                                                                                                                                   | A single photo by its numeric ID, full detail.      |

</details>

<details>
<summary><b>Videos</b></summary>

| Tool                    | Parameters                                                                                                                  | Description                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `pexels_search_videos`  | `query` **(required)**, `orientation?`, `size?` (`large`=4K\|`medium`=Full HD\|`small`=HD), `locale?`, `page?`, `per_page?` | Keyword video search with filters.                                                    |
| `pexels_popular_videos` | `min_width?`, `min_height?`, `min_duration?`, `max_duration?`, `page?`, `per_page?`                                         | Currently popular videos, optionally filtered by size/duration.                       |
| `pexels_get_video`      | `id` **(required)**                                                                                                         | A single video by its numeric ID — returns **every** rendition, not just the top few. |

</details>

<details>
<summary><b>Collections</b></summary>

| Tool                               | Parameters                                                                                       | Description                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `pexels_list_featured_collections` | `page?`, `per_page?`                                                                             | Pexels' featured collections (metadata only).                                            |
| `pexels_list_my_collections`       | `page?`, `per_page?`                                                                             | Collections belonging to the account that owns the configured API key (see [FAQ](#faq)). |
| `pexels_get_collection_media`      | `id` **(required)**, `type?` (`photos`\|`videos`), `sort?` (`asc`\|`desc`), `page?`, `per_page?` | The photos/videos inside a collection, each tagged with `media_type`.                    |

</details>

### Output shape

Tools return trimmed, token-efficient JSON rather than raw Pexels responses:

- **Photos** → `id`, `alt`, `width`/`height`, `avg_color`, `url`, `src` (all 8 Pexels sizes), `photographer`, and a courtesy `credit` object.
- **Videos** → `id`, `url`, `image`, `width`/`height`, `duration`, `user`, `video_files` (trimmed to the top 5 by resolution in list results; complete on `pexels_get_video`), `video_files_count`, `preview_picture`, `video_pictures_count`.
- **Collections** → `id`, `title`, `description`, `private`, `media_count`, `photos_count`, `videos_count`.
- Every result carries a `rate_limit` (`limit`, `remaining`, `resetEpoch`); lists/searches add pagination fields (`total_results`, `page`, `per_page`, `has_next_page`).

### Resources & prompts

Beyond tools, the server also exposes:

- **Resources** — a compact guide your client can pull in as context:
  - `pexels://guides/usage` — the license restrictions that apply, the optional courtesy-credit convention, and content-safety notes.
- **Prompts** — ready-made tasks your client can surface directly; each expands into a guided, multi-step tool-calling task:

  | Prompt            | Arguments                                              | What it does                                                          |
  | ----------------- | ------------------------------------------------------ | --------------------------------------------------------------------- |
  | `find_photo`      | `subject` (required), `orientation?`                   | Search for one photo and present it with a courtesy credit.           |
  | `photo_gallery`   | `theme` (required), `count?`, `orientation?`, `color?` | Build a themed set of photos (up to 10), each with a courtesy credit. |
  | `find_video`      | `subject` (required), `orientation?`                   | Search for one video and present it with a courtesy credit.           |
  | `collection_tour` | `theme` (required), `count?`                           | Find a matching featured collection and walk through its media.       |
  | `media_brief`     | `theme` (required), `photo_count?`, `video_count?`     | Gather both photos and videos for a theme, presented together.        |

## Example prompts

Natural-language asks that map cleanly onto the tools:

- _"Find a photo of a foggy forest at sunrise."_
- _"Search Pexels for 5 minimalist workspace photos in landscape orientation."_
- _"Find a video of waves crashing on rocks."_
- _"Show me a featured Pexels collection about urban architecture."_
- _"Build me a mixed media brief of photos and video clips about cozy autumn mornings."_

## License & compliance

Pexels' license is lighter than many stock-photo APIs: **attribution is not required** ("appreciated, not necessary"). Every photo result still includes a ready-to-use courtesy `credit` object — include it when convenient, but it's not mandatory.

Real restrictions still apply, and the server's instructions steer the model around them: no reselling unaltered content as a physical product without modifying it first, no redistributing it on another stock-photo or wallpaper platform, no using it as part of a trademark/logo/business name, no implying a person's or brand's endorsement, and no depicting an identifiable person in a bad or offensive light. See the full [Pexels License](https://www.pexels.com/license/) and the server's `pexels://guides/usage` resource. Each user operates under their own Pexels API Terms.

## Rate limits

Pexels enforces a single tier for every API key:

| Budget                | Notes                                                        |
| --------------------- | ------------------------------------------------------------ |
| 200 requests/hour     | Higher limits available on request once you have real usage. |
| 20,000 requests/month | Tracked alongside the hourly budget.                         |

The server reads `X-Ratelimit-Limit`/`X-Ratelimit-Remaining`/`X-Ratelimit-Reset` and returns them as `rate_limit` on every result. Pexels returns a standard **`429`** when the budget is exhausted (unlike some APIs that overload `403` for this) — but the rate-limit headers are absent on the `429` response itself, so the client caches the last-known values from a prior successful call to report an accurate reset time, and short-circuits further requests once the quota is known to be exhausted rather than firing calls that will just fail. Transient `429`/`5xx`/network errors _are_ retried with backoff.

## Handling of Pexels text

Photo/video alt text, photographer names, and collection titles/descriptions come from Pexels contributors — treat them as **untrusted, third-party data**, not instructions. The server returns this text purely as content and never places it anywhere privileged; your client/agent should do the same: display it, but don't act on any instructions it might contain (a defence against indirect prompt injection). Pexels also has no safe-search/content-filter parameter — use judgment in how you phrase search queries.

## Privacy & security

- **No telemetry.** This server collects nothing and phones home to no one. It contacts only `api.pexels.com`, using the key you provide. No analytics, no tracking.
- **Key safety.** Your API key is read from the environment only, sent as a raw `Authorization` header (never in a URL query string), and **redacted from all error output and logs** so it can't leak into pasted bug reports.
- To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## Troubleshooting

- **"Set PEXELS_API_KEY…" on startup** — the key env var is missing or blank; add it to your client config's `env` block.
- **Node too old** — this server requires **Node 20+**. Check `node --version`.
- **Stale `npx` version** — force the latest with `npx -y @hanoak/pexels-mcp-server@latest`, or clear the cache via `npx clear-npx-cache`.
- **Tools not appearing** — confirm the config file path and JSON are valid, then fully quit and reopen the client.
- **`429` / rate limit** — the budget is 200 requests/hour; wait for the hourly reset (see the `rate_limit.resetEpoch` in a tool result) or request a higher limit.
- **`401 Unauthorized`** — the API key is wrong; copy it again from your [Pexels API dashboard](https://www.pexels.com/api/).
- **`pexels_list_my_collections` returns empty** — this is expected unless the Pexels account that owns your API key has created collections on pexels.com itself; see the [FAQ](#faq).

## FAQ

**Do I need a paid Pexels account?**
No. The Pexels API is free — you just create an account to get an API key, instantly, no review or approval step.

**Does it download or rehost images/videos?**
No. It returns Pexels-hosted URLs (hotlink them directly) and never rehosts or returns base64 blobs.

**Why does `pexels_list_my_collections` come back empty?**
Pexels has no per-conversation login — the tool always reflects the collections of whichever Pexels account owns the configured API key, not the person chatting. It'll be empty unless that specific account has created collections on pexels.com.

**Does it work outside Claude?**
Yes — it's a standard stdio MCP server. See [the client setup section](#2-add-the-server-to-your-mcp-client) for Claude Code, Cursor, VS Code, Windsurf, and generic stdio.

## Requirements

- **Node.js >= 20** (Node 18 is end-of-life).
- A Pexels API key.

## Compatibility

| Component | Supported                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Node.js   | **20** and **22**, tested in CI; `>=20` required (enforced by `engines` and a runtime guard).        |
| OS        | Linux, macOS, and Windows (all tested in CI).                                                        |
| MCP SDK   | `@modelcontextprotocol/sdk` `^1.30`; the protocol version is negotiated with your client on connect. |
| Transport | stdio (HTTP/SSE may be added in a future release).                                                   |

## Roadmap

Full detail lives in [docs/ROADMAP.md](./docs/ROADMAP.md). In short: **v1** covers the entire documented Pexels API in one release — there's no OAuth tier to split a v2 behind, unlike some other stock-photo MCP servers. Future scope under consideration includes structured tool output for video renditions, a short-TTL response cache if real quota pressure appears, and additional prompts/resources.

Changes are tracked in [CHANGELOG.md](./CHANGELOG.md); the project follows [Semantic Versioning](https://semver.org).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md). It covers local setup, the test suite, testing tools by hand with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), and the versioning/deprecation policy. To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## Contact & community

Maintained by **Hanoak S**. The fastest way to get help or propose a feature is to [open an issue](https://github.com/hanoak/pexels-mcp-server/issues) — it's public, searchable, and helps the whole community.

If this project helps you, a ⭐ on [GitHub](https://github.com/hanoak/pexels-mcp-server) is appreciated — it aids discoverability for others looking for a Pexels MCP server.

## License

[MIT](./LICENSE) © Hanoak S. Not affiliated with Pexels.

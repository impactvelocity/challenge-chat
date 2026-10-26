# Challenge.chat documentation

Use these guides to run a show, self-host the app, or build on its APIs and React surfaces. Product names are **Board → Round → Challenge**; code often uses `Channel → Session → Challenge`. A generic framework run is a separate metric-based execution.

## Run the app

| Guide | What it covers |
| --- | --- |
| [App screens and show workflow](./app.md) | Sign-in, boards, control room stages, challenge editing, Inbox, results, and public pages |
| [Settings reference](./settings.md) | Every settings tab, save behavior, defaults, permissions, and destructive actions |
| [Twitch setup](./twitch-setup.md) | Register the Twitch application, connect a broadcaster, test commands, and recover EventSub listeners |
| [OBS setup](./obs-setup.md) | Add the transparent browser source, choose widgets, preview safely, and troubleshoot |
| [AI behavior and cost](./ai.md) | Parsing, titles, manual fallback, gateway configuration, and billing/privacy boundaries |

For your first show, deploy → create a board → review AI settings → connect Twitch → configure OBS → rehearse a complete round on a test board.

## Host and operate

| Guide | What it covers |
| --- | --- |
| [Cloudflare deployment](./deployment.md) | Account/resources, secure first upload, migrations, updates, and production troubleshooting |
| [Security and permissions](./security.md) | Owner/mod roles, credentials, public data, revocation, and current security limitations |
| [Testing and release checklist](./testing.md) | Automated checks, end-to-end scenarios, real AI/Twitch checks, and release verification |
| [Known limitations](../GAPS.md) | Unsupported or locally scoped behavior; read before relying on automation |

## Integrate and extend

| Guide | What it covers |
| --- | --- |
| [HTTP API](./api.md) | Authentication, board operations, request/response examples, event intake, and errors |
| [MCP and WebMCP](./mcp.md) | Remote MCP connection, tool discovery/calls, catalog, and browser registration |
| [React overlay SDK](./react-sdk.md) | Live mounting, hook selection, snapshots/events, and the full SDK reference |
| [Custom overlay themes](./custom-themes.md) | Extend a theme, register it, add settings/elements, brand assets, and test scenes |
| [Game and service integrations](./integrations.md) | Normalized metric events, reporter usage, stable IDs, and adapter trust boundaries |
| [Development](./development.md) | Local setup, repository map, scripts, and contribution boundaries |

## Understand the runtime

- [System overview](./system-overview.md): storage ownership, show versus metric engine, and surface boundaries.
- [Durable Object flow](./durable-objects.md): coordinator addressing, storage keys, alarms, projections, rollover, and recovery.
- [Framework reference](./framework.md): endpoint inventory and versioned contracts.
- [Overlay renderer map](./overlay-renderer-system.md): source → store → renderer summary.
- [Product plan](../PRODUCT_PLAN.md): design intent and roadmap, not a guarantee of implemented behavior.

The diagrams use Mermaid and render on GitHub. A local Markdown viewer needs Mermaid support. Commands and examples are for this repository's current implementation; they do not imply that all external clients or game providers are supported.

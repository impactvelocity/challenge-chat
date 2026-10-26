# Development

Set up a local Worker-backed environment and change a surface or adapter without breaking framework boundaries. Read [`AGENTS.md`](../AGENTS.md) before implementation work.

## Local setup

Use Node.js 24+ and the committed npm lockfile:

```bash
npm ci
npm run db:migrate:local
npm run dev
```

Vite binds to `http://127.0.0.1:5174` with a strict port. Local D1, R2, and Durable Objects use Wrangler's development state; remote production migrations do not prepare the local database. Stop a conflicting server instead of assuming Vite selected another port.

First-run local setup creates the owner profile. For a managed password, create `.dev.vars` from [the example](../.dev.vars.example) and configure `OWNER_PASSWORD`. Keep secrets out of Git. Do not read/copy another user's actual local secret file into docs or test fixtures.

The AI binding is remote, so AI-enabled local intake can spend real credits. Turn parsing and automatic round naming off for no-AI manual tests. Ordinary product/engine unit tests do not need a paid request; real inference is an explicit integration check.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/creator.tsx`, `src/App.tsx` | Creator composition, route shell, authentication entry |
| `src/pages/main/` | Product screens, sheets, setup, public board, Studio |
| `src/pages/app/ChannelSettings.tsx` | Shared settings body |
| `src/framework/use-challenge-chat.ts` | Live creator state, recovery, mutation feedback |
| `src/framework/client.ts` | Cookie-authenticated generic-run client |
| `src/framework/channel.ts` | Preserve board scope in URLs/requests |
| `src/framework/theme.ts` | Creator token mapping |
| `src/overlay/sdk/` | Public rendering contract/store/hooks/themes |
| `src/overlay/sources/live.ts` | Production public transport adapter |
| `src/overlay/mock/` | Isolated Studio/test state, never production `/overlay` |
| `shared/contracts.ts`, `shared/scoring.ts` | Reference show drafts/state and scoring rules |
| `shared/framework.ts`, `shared/engine.ts` | Versioned generic metrics/events/rules and pure reducer |
| `shared/board-tools.ts` | Shared REST tool/MCP/WebMCP catalog |
| `worker/` | Routing, D1 operations, auth, DO coordinator, Twitch, AI |
| `migrations/` | Ordered D1 schema changes |
| `integrations/` | Trusted reporter and provider adapters |

## Useful scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Run the Vitest suite, including real-schema SQLite integration tests |
| `npm run test:watch` | Watch tests during development |
| `npm run build` | Type-check/build using top-level demo configuration |
| `npm run build:production` | Type-check/build using production bindings/variables |
| `npm run cf-typegen` | Generate Cloudflare binding types; generated output is ignored |
| `npm run db:migrate:local` | Apply D1 migrations to local development state |
| `npm run deploy:production` | Build, migrate remote production D1, deploy; **changes live resources** |

`npm run deploy` is the older demo path, not the production release command. `db:migrate:remote` uses the top-level configuration; use the generated production config explicitly for a production migration. See [deployment](./deployment.md) before any remote command.

## Change a surface

Build creator screens under `src/pages/main/`, composed from `src/creator.tsx`. Consume `useChallengeChatController()` for authorized operations and pending feedback instead of reproducing request/socket code. Treat `busy`, pending action name, and error notice as UI state; server validation still decides the outcome.

For overlays, use SDK data hooks and theme registry. Register a theme once; do not scatter hard-coded theme lists across Setup, Settings, and Studio. Keep the real `/overlay` public/transparent and Studio authenticated with simulation isolated. See [React SDK](./react-sdk.md) and [custom themes](./custom-themes.md).

## Extend the framework

Keep provider adapters outside the engine. Normalize and verify incoming facts, then call the typed reporter/API. Do not update an overlay from a game adapter or put authoritative success logic in a React component.

If adding a new metric/event/rule capability, change the versioned shared contract, pure reducer/projection, Worker validation, and engine tests together. Check role restrictions, idempotency, terminal states, pause/resume, deadlines, and public metric filtering. Preserve ChannelScope resolution; a caller's IDs must not bypass board membership.

Add D1 schema changes as new migration files rather than rewriting already-applied history. Preserve Durable Object migration tags and the single-Worker deployment. Generic run storage and D1 product state are not interchangeable stores.

## Before handing off

Run `npm test` and `npm run build`; use `build:production` before a release. For a changed screen/theme, inspect the relevant states in a real browser, including narrow widths and pending/error feedback. A successful build does not prove Twitch delivery, AI billing, OBS transparency, or browser WebMCP availability. Follow [testing](./testing.md) for those checks.

Update the guide for any changed field, route, default, credential boundary, or lifecycle behavior. Keep the [documentation index](./README.md) and [known limitations](../GAPS.md) aligned with implemented behavior rather than the roadmap.

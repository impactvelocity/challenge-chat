# Challenge.chat framework map

## Runtime flow

```text
adapter -> POST normalized event -> Worker -> LiveSessionCoordinator
        -> pure reducer/rules -> persisted live run -> WebSocket projection
        -> control panel + OBS overlay
```

`LiveSessionCoordinator` is addressed by the active stream session resolved from the selected Channel in D1. Each Channel has an independent coordinator. It serializes run events, stores the current run, schedules countdown/deadline alarms, rejects duplicate event envelopes, and broadcasts projections to connected surfaces. The Worker never uses an arbitrary client-supplied session ID as a coordinator address.

The browser-source overlay loads `/api/public/state?channel=ID` and connects to `/api/v1/live/socket?scope=overlay&channel=ID`. It receives public show state, active leaderboard projections, and the generic live-run projection. The control panel uses the admin scope; the Worker checks the owner/mod session, Channel membership, and same-origin WebSocket handshake before forwarding that socket. Server-side adapters use a separate Channel integration token only for normalized metric events.

## Contracts

- `shared/framework.ts`: versioned definitions, metrics, rules, event envelopes, runs, and public projections.
- `shared/engine.ts`: deterministic run creation, event reduction, rule evaluation, and projection generation.
- `shared/contracts.ts`: the original Challenge.chat proposal/voting model and creator theme contract.

## Headless clients

- `src/framework/client.ts`: typed framework API client for adapters and custom clients.
- `src/framework/use-challenge-chat.ts`: connection, recovery, state, and control hooks for React surfaces.
- `src/framework/theme.ts`: default token-to-CSS mapping. Custom renderers do not have to use it.
- `src/creator.tsx`: creator-owned composition entrypoint.

## API v1

```text
GET  /api/v1/capabilities
POST /api/v1/runs
GET  /api/v1/runs/live
POST /api/v1/runs/:runId/events
GET  /api/v1/live/socket?scope=overlay|admin  (WebSocket upgrade)
GET  /api/public/state
GET  /api/auth/session
POST /api/auth/setup           (one-time owner password setup)
POST /api/auth/owner/login
DELETE /api/auth/session       (sign out)
POST /api/auth/invites/consume (one-time moderator link)
GET  /api/auth/mods            (owner only)
POST /api/auth/mods            (owner creates mod and link)
POST /api/auth/mods/:id/invite (owner regenerates link)
DELETE /api/auth/mods/:id      (owner revokes mod)
GET  /api/channels             (accessible Channels)
POST /api/channels             (owner creates Channel + initial session)
PATCH /api/channel             (owner edits selected Channel name/slug)
DELETE /api/channel            (owner deletes selected Channel and its data)
PATCH /api/scoring-rules       (owner edits versioned Channel defaults)
POST /api/session/complete     (owner/mod finalizes the active session)
POST /api/sessions             (owner/mod rotates a completed session)
PATCH /api/session/submissions (owner/mod opens or pauses challenge intake)
POST /api/channel/mods         (owner grants existing mod access)
GET  /api/channel/integration  (owner reads token metadata only)
POST /api/channel/integration  (owner generates/replaces token, shown once)
GET  /api/public/leaderboard   (single public Challenger ranking)
PATCH /api/overlay-config      (owner-only theme/settings/elements)
PATCH /api/session-settings    (owner-only channel UI/session preferences)
```

Channel-specific endpoints use `?channel=ID`; omission selects the original `demo-channel`. New Channels receive an opaque eight-character lowercase alphanumeric ID; existing UUID IDs remain valid. `/api/channels` and deployment login/logout are global. `GET /api/auth/mods?all=1&channel=ID` lists deployment moderator identities with Channel assignments so the owner can grant an existing identity access. All challenge, ballot, leaderboard, and live-run mutations resolve IDs within the selected Channel's active session. Channel creation atomically stores the board identity, Twitch login, initial colours, and a new collecting session, so a newly created board is immediately usable without a second setup route. Completed sessions can be rotated from the control panel and remain visible in history.

The reference lifecycle is `collecting → voting → ready → live → complete`. Challenge intake has a separate D1-backed open/paused flag: suggestions received while intake is paused or the session is in another phase are stored with `inbox` status instead of being rejected. Opening a ballot moves unshortlisted ideas to that Channel's Inbox, and closing it moves non-winning finalists there too. Inbox ideas remain Channel-scoped across session rotation and can be reassigned to a later collecting session. A ballot snapshots its winner count and per-viewer vote limit from the session rules, accepts distinct selections up to that limit, rejects late votes, and advances the top N with shortlist order as the deterministic tie-break. Selected authors receive the session's Challenger award. A Chat challenge win creates a separate defeated-streamer award. Completion requires every selected challenge to resolve, decides the session from challenge wins, recognizes a strict sweep only when every selected challenge has a scored result for one side, applies configured bonuses, and freezes the result.

Creator/mod control-panel votes use the authenticated control route. A trusted chat bot or extension backend can call `POST /api/ballots/:id/vote` with the Channel integration bearer token and a Twitch-verified viewer ID; the token must remain server-side. The core deliberately does not trust a browser-supplied identity. A direct video-player extension should verify its Twitch authorization token in its own adapter/backend and forward only the normalized viewer ID through this route.

Scoring rules are validated declarative data rather than executable code. Classic, Arcade, and Custom use one schema. Channel defaults update a safely collecting session before its first ballot or round; otherwise they are copied into the next session. Challenge, session, and consecutive-sweep streaks are derived from authoritative round and session history and expose current, best, and sweep-total projections to both reference surfaces.

`shared/channels.ts` defines Channel inputs and scope. `worker/channel-store.ts` resolves membership and Channel settings. Every legacy database action requires a `ChannelScope`; do not reintroduce fixed IDs outside the compatibility bootstrap. `src/framework/channel.ts` composes scoped links and requests; a custom surface can pass an explicit Channel ID. Integrations pass `channelId` to the reporter SDK.

Each Channel has one Challenger leaderboard. It sums the snapshotted `selected` and `defeated_streamer` awards from the contribution ledger across that Channel's sessions, so historical scores retain the rules used when each award was earned. Award values are configured with the Channel's versioned session rules. Approved ideas, voting finalists, played challenges, votes, and generic game metrics do not add leaderboard points.

Event submissions require `source` and `idempotencyKey`. Retrying an accepted event is safe and returns `duplicate: true`.

Only one countdown/active/paused run may exist per session. The engine, not integrations, emits `run.started` and `timer.expired`; late events cannot overtake a deadline. Pause freezes the displayed timer and resumes by extending the deadline. Runs currently live in Durable Object storage; event history and archived runs have not yet been promoted into D1.

## Surface customization

`src/creator.tsx` mounts the route shell in `src/App.tsx`; product screens live under `src/pages/main/`. They consume the same headless connection layer, so a deployment can replace the creator composition without changing the Worker, engine, or adapters.

The production OBS route is `/overlay?channel=ID`. `src/overlay/sources/live.ts` combines the public D1 projection and generic live-run projection into the normalized SDK snapshot documented in [`src/overlay/README.md`](../src/overlay/README.md). `/overlay/studio` uses the SDK's mock source for Game and Events while persisting only the selected theme, settings, and element switches.

Built-in themes live under `src/overlay/themes/` and are registered in `src/overlay/themes/index.ts`. Setup, Settings, Studio, and OBS discover themes from that registry. Channel-owned overlay configuration is validated generically in the Worker and projected publicly; the React-side theme schema resolves exact defaults and control values. Unknown stored theme IDs fall back to Broadcast.

The control-panel accent is a per-browser preference. Broadcast colors and theme configuration are channel-owned server data, keeping operator preferences out of OBS. Full component replacement remains available when tokens are insufficient.

## Deploy and security state

`wrangler.jsonc` intentionally omits an account-specific D1 ID so Cloudflare can provision a database for each creator deployment. The deploy script builds, deploys, then applies D1 migrations. A freshly deployed Worker may briefly return database errors before migration completes.

Auth has one deployment owner and channel-assigned moderators. On first visit, the owner chooses a control-room name and password; both the name and the unique-salt PBKDF2-HMAC-SHA256 password hash (600,000 iterations) live in D1. The same-origin setup endpoint cannot overwrite an existing profile. `OWNER_PASSWORD` remains available as an optional Worker-secret alternative and takes precedence over a stored password. `ADMIN_TOKEN` is retired.

The owner creates named mod accounts and receives a one-use link with a random token in the URL fragment, so the token is not sent in the initial HTTP request. The link expires in 15 minutes; D1 stores only its SHA-256 hash. Redemption atomically marks it used and issues a random 12-hour session token. D1 also stores only session-token hashes. Cookies are HTTP-only, SameSite=Strict, and Secure on HTTPS; unsafe cookie-authenticated writes require a same-origin request. Login failures are rate-limited per Cloudflare client IP. Removing access deletes that Channel membership and its outstanding invitations and closes the moderator’s sockets in that Channel. Other Channel memberships and the shared sign-in session remain valid; every subsequent control request rechecks membership. Signing out closes the session’s sockets in every accessible Channel.

Both roles can review challenges, run rounds, manage votes, and use the generic live-run controls. Only the owner can manage mods, change the theme or assets, and reset demo data. Channel integration tokens are random bearer credentials stored as hashes and accepted only by the normalized metric event endpoint. The optional `INTEGRATION_TOKEN` environment secret is a compatibility fallback for the default Channel only, overridden when a Channel token is generated. It must stay in a server or local helper, not a browser bundle. The optional OpenAI key also stays in the Worker.

## Example game adapter

`integrations/reporter.ts` is a server/local-helper reporter. It accepts the creator deployment URL, a source name, and the optional integration token, then sends normalized metric events with stable provider-derived idempotency keys. `integrations/examples/horror-kills.ts` validates a hypothetical `enemy_defeated` payload and maps it to `kills += 1`. It deliberately does not claim support for a real game's API: a creator replaces the schema and mapping for their provider, verifies any incoming webhook signature, and calls the reporter only after validation. The reporter never decides success or updates the overlay directly.

# Challenge.chat

A streamer-vs-chat challenge engine built for the TwitchCon + Codex hackathon. Viewers submit messy ideas, the app turns them into structured challenges, the streamer or moderators approve them, chat votes, and the broadcast overlay turns the attempt into a show moment.

The project is evolving into a self-hosted framework: game and service adapters emit normalized events, a headless rules engine owns live challenge state, and independently replaceable control-panel and OBS surfaces consume versioned APIs and WebSocket projections. See [the framework map](./docs/framework.md).

## What works now

- Structured challenge intake with an optional OpenAI parser and deterministic fallback
- Moderator review/edit/approve/reject flow
- Session lifecycle from open suggestions through configurable shortlists, multi-select votes, final challenge decks, live rounds, and recaps
- Classic (1 point), Arcade (100 points), and Custom scoring with optional session bonuses and named clean-sweep multipliers
- Attempt tracking, adjudication, Streamer/Chat session history and streaks, plus contributor and Challenger rankings
- OBS-friendly `/overlay?channel=…` route driven by the public projection and live WebSocket updates
- Nine registered overlay themes with per-theme settings, element switches, previews, and a full mock-data studio
- Creator control room, first-board setup, public scoreboards, channel settings, and moderator-safe surface controls from one responsive design system
- D1 persistence behind a Cloudflare Worker API
- Generic counter/gauge/flag metrics, declarative rules, countdown/deadline alarms, idempotent event intake, and a live-run API
- One Durable Object per session for serialized run updates and WebSocket fan-out
- A public, read-only overlay projection separate from the creator control-plane state
- Independent overlay and control-panel theme tokens, plus replaceable React surface composition
- Owner password sign-in, owner-managed moderators, one-time moderator links, and role-checked sessions

## Run locally

Requirements: Node 24+ and a Cloudflare account for eventual deployment. Integration tests exercise the actual schema using Node's built-in SQLite driver.

```bash
npm install
npm run db:migrate:local
npm run dev
```

Before starting Vite, copy `.dev.vars.example` to `.dev.vars` and replace `OWNER_SETUP_TOKEN` with a unique code (for example, from `openssl rand -hex 32`). Open the local URL printed by Vite, then name the control room and choose the owner password on the first visit. The name and salted password hash are stored in D1. Alternatively, set `OWNER_PASSWORD` in `.dev.vars` to use that Worker secret directly and bypass first-run setup. The control room is `/`; the browser-source overlay is `/overlay?channel=CHANNEL_ID` and needs no login.

## Surface routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` and `/inbox` | Live creator control room and challenge inbox | Owner or assigned moderator |
| `/settings/:tab?` | General, scoring, voting, theme, mods, OBS, and AI settings | Signed in; owner-only sections are also enforced by the Worker |
| `/setup?channel=…` | New-board onboarding and overlay theme selection | Signed in |
| `/overlay?channel=…` | Transparent OBS browser source using real public state | Public |
| `/overlay/studio?channel=…` | Theme studio with mock game/events and channel-owned appearance settings | Signed in; moderator appearance controls are read-only |
| `/c/:channelId` | Public scoreboard and history | Public when enabled for the Channel |
| `/invite` | One-use moderator invite redemption | Public magic link |

The overlay registry and source contract are documented in [`src/overlay/README.md`](./src/overlay/README.md). UI/backend limitations that remain intentionally empty or disabled are tracked in [`GAPS.md`](./GAPS.md).

The parser works without a key. To enable OpenAI Structured Outputs locally, add this to `.dev.vars`:

```dotenv
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-6-astra
```

Never expose this key to the browser; parsing happens inside the Worker.

## Deploy to Cloudflare

This repo is prepared for Cloudflare's Deploy to Cloudflare flow: Wrangler defines D1, R2, and Durable Object bindings, and the deploy command applies D1 migrations. Once the project is published as a **public GitHub or GitLab repository**, replace `YOUR_PUBLIC_REPO_URL` in this button snippet with its URL:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=YOUR_PUBLIC_REPO_URL)
```

The public repository URL is not known in this workspace, so there is no live button yet. Cloudflare's deploy flow provisions supported resources from the Wrangler config. Choose either `OWNER_SETUP_TOKEN` for first-visit password setup, or `OWNER_PASSWORD` for an environment-managed password. Until one is configured, the control panel remains locked. `INTEGRATION_TOKEN` and `OPENAI_API_KEY` are optional, separate secrets.

For a direct CLI deployment:

```bash
npx wrangler login
npm run deploy
npx wrangler secret put OWNER_SETUP_TOKEN
# alternatively: npx wrangler secret put OWNER_PASSWORD
# optional: npx wrangler secret put INTEGRATION_TOKEN
# optional: npx wrangler secret put OPENAI_API_KEY
```

After setting `OWNER_SETUP_TOKEN`, visit `/`, name the control room, and choose a password of at least 12 characters. The control-room name and salted password hash are stored in D1; the setup code cannot replace them later. If `OWNER_PASSWORD` is set, it takes precedence and is not copied into D1. The old `ADMIN_TOKEN` setting no longer grants access; existing deployments must configure one of the new owner secrets.

The owner can create named moderators from the control panel and copy a 15-minute, one-use magic link for each. A mod can review suggestions, manage votes, and run challenges in assigned Channels, but cannot manage access, branding, integration tokens, or scoring rules. Removing channel access invalidates that Channel's invitations and closes its admin sockets; the moderator can still operate other assigned Channels. There is no Twitch OAuth or email provider. Authenticated sessions use opaque HTTP-only cookies; overlays remain public.

## Channels and leaderboard

Use the Channel selector at the top of the control panel to switch Channels. Owners can use **+ New** or **Channel settings** to create a Channel and edit its name and slug. Existing NightShift data is preserved as the default Channel. A new Channel starts empty with its own live session and Challenger leaderboard. The deployment owner can manage every Channel; moderators see only those assigned to them. An existing moderator can be granted access to another Channel without creating another account.

Every control API, WebSocket, integration event, and OBS URL accepts `?channel=CHANNEL_ID`. Omitting it selects the original `demo-channel` for compatibility. OBS URLs include the Channel ID so switching the control panel never switches the broadcast. Branding, scores, proposals, ballots, runs, and integration tokens are isolated by Channel. Slugs are display identifiers; stable IDs keep saved URLs working after a rename.

Each Channel has one all-time Challenger leaderboard. A viewer earns the award configured in the session rules when their challenge is selected, plus another award if that challenge defeats the streamer. Those amounts are recorded when earned, so later rule changes do not rewrite historical scores. Approved ideas, voting finalists, played challenges, votes, and generic game telemetry do not add leaderboard points. The public ranking is available through `/api/public/leaderboard?channel=CHANNEL_ID`; it is not a separate OBS source.

Each Channel also owns versioned session rules. Classic awards 1 point per challenge, Arcade awards 100, and Custom exposes integer team and Challenger values, shortlist size, final challenge count, votes per viewer, voting duration, session-win bonus, and an optional clean-sweep multiplier. The clean-sweep broadcast label is creator-defined. Rules are copied onto a session before its first ballot or challenge, so later changes cannot rewrite an active or historical contest. Completed sessions preserve exact scores, winners, sweep results, and history while Channel totals, the Challenger leaderboard, and streaks continue across sessions.

Generate a Channel's integration token in **Channel settings** and give it only to the server/local helper reporting events. It is shown once; replacing it immediately invalidates the old token. In the reporter SDK, pass `channelId` together with `integrationToken`. The legacy `INTEGRATION_TOKEN` Worker secret applies only to the default Channel until it has a generated Channel token. Framework run access remains limited to metric events; the ballot endpoint additionally accepts a Twitch-verified viewer ID from a trusted chat or extension backend.

## Architecture

```text
adapter → normalized event → Worker → session Durable Object
                                     │ rules + alarm + WebSocket
               ┌─────────────────────┴─────────────────────┐
        creator control panel                      public OBS overlay
               │                                           │
              D1                                          R2
       proposals / voting                            brand assets
```

The live framework adds one `LiveSessionCoordinator` Durable Object per active session for serialized rules, deadline alarms, idempotent integration events, and WebSocket fan-out. D1 remains the product data store and R2 holds creator assets.

## Creator customization

- Start composition changes in `src/creator.tsx`.
- Build custom React surfaces on `useChallengeChatState` or `useChallengeChatController` from `src/framework/use-challenge-chat.ts`.
- Use `useChallengeChatState("overlay")` for public-only output; the default admin scope requires creator access.
- Compose the creator experience under `src/pages/main/`; use `src/pages/app/ChannelSettings.tsx` for the shared settings body.
- Add an overlay theme as a folder under `src/overlay/themes/`, then register it in `src/overlay/themes/index.ts`. Setup, Settings, Studio, and OBS all read that registry.
- Keep overlay theme IDs, settings, and elements declarative. The Worker accepts only bounded primitive configuration values and never evaluates runtime JavaScript.
- Add game telemetry through normalized `/api/v1/runs/:runId/events` envelopes.
- Start from `integrations/reporter.ts` and the hypothetical `integrations/examples/horror-kills.ts` adapter when wiring a real game's server API or local helper.
- Repository skills under `.agents/skills` guide Codex through surface customization and integration work.

Product scope and rollout decisions live in [PRODUCT_PLAN.md](./PRODUCT_PLAN.md).

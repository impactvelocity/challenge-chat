# Challenge.chat system overview

Challenge.chat is a self-hosted framework for running interactive, streamer-versus-chat challenges during a live broadcast. It handles the full show workflow: collecting challenge ideas, preparing them for broadcast, letting chat choose what happens next, tracking the live attempt, resolving the outcome, and presenting the action through OBS-ready overlays.

The project is built around a headless engine with replaceable user interfaces. The server owns challenge state, timing, rules, permissions, and persistence. The included creator control panel and broadcast overlays are reference surfaces that can be restyled or replaced without rebuilding the underlying system.

## Challenge workflow

A typical challenge moves through several stages:

1. A viewer challenge is submitted as free-form text.
2. Challenge.chat converts the suggestion into a structured challenge draft.
3. A moderator reviews and edits the title, objective, difficulty, time limit, attempt limit, and other details.
4. The approved challenge enters the ready queue.
5. The creator either starts it directly or includes it in a chat vote.
6. When the challenge goes live, the overlay displays its countdown, objective, timer, attempts, and point value.
7. The creator or moderator records the result.
8. The system updates the streamer-versus-chat score and the viewer's contribution history.

Challenge suggestions are parsed through the Worker's Cloudflare AI binding, routed through AI Gateway with structured JSON output. The same server-only path generates a short round name from the winning lineup when voting closes. Both features are independently configurable per board. Deterministic cleanup and naming remain available when AI is disabled or unavailable, and every challenge retains its original text plus the parser source used.

Structured challenge data can include:

- Title and broadcast objective
- Game and gameplay context
- Numeric targets and streak requirements
- Loadout, movement, location, input, or technique constraints
- Time and attempt limits
- Failure conditions
- Difficulty
- Verification method
- Parser warnings that require moderator attention

## Headless challenge engine

The headless system is the authoritative runtime behind the control panel and overlays. It exposes versioned API contracts and manages challenge runs independently of any particular visual design.

A generic challenge definition can contain counter, gauge, and boolean flag metrics. Rules can compare metric values, respond to timer expiration, or combine conditions using `all` and `any` groups. Presentation hints tell a compatible overlay whether a metric should appear as a progress bar, counter, flag, countdown, or attempt display.

A live run moves through a controlled lifecycle:

- Countdown
- Active
- Paused
- Succeeded
- Failed
- Voided

The engine initializes metrics, validates every incoming event, clamps numeric values to configured limits, evaluates success and failure rules, and prevents changes after a run has ended. Pausing a timed challenge freezes the displayed timer; resuming it extends the deadline by the amount of time spent paused.

Only one countdown, active, or paused generic run can exist in a session at a time. The server also owns deadline handling, which prevents a delayed integration event from overtaking an expired timer.

## Events and integrations

Games and services connect to Challenge.chat by reporting normalized facts. For example, an adapter might translate a game-specific event into a standard metric increment:

```text
enemy_defeated -> kills increased by 1
```

The adapter does not decide whether the challenge succeeded and does not update the overlay directly. The headless engine applies the event, evaluates the configured rules, stores the new run state, and broadcasts the resulting public projection.

Each event includes a source and an idempotency key. If an integration retries an event that was already accepted, the server recognizes the duplicate instead of applying it twice.

The included reporter SDK is intended for game servers, verified webhooks, and trusted local helpers. Integration tokens are channel-specific and must remain outside browser and overlay code. A sample adapter demonstrates how to validate a provider payload and translate it into a normalized event, but it is intentionally provider-neutral rather than claiming support for a specific game API.

## Creator control panel

The creator control panel is the main operating surface for running the show. It provides a live summary of the selected channel, including:

- Challenges waiting for review
- Challenges ready to run
- Items selected for voting
- Current program state
- Streamer-versus-chat score
- WebSocket connection status and state revision

### Challenge intake and moderation

The reference panel includes a form for entering a viewer suggestion, viewer name, and game. New suggestions appear in the review queue.

Moderators can inspect and edit each challenge before approving it. The editor exposes the show title, objective, time limit, attempt limit, and difficulty. A challenge can then be approved or rejected. Approved ideas contribute to the viewer's community score according to the active leaderboard rules.

### Ready queue and chat voting

Approved challenges enter the ready deck. From there, the operator can start a challenge immediately or select up to three challenges for a timed vote.

While a vote is open, the panel shows each option's vote count and percentage. Closing the ballot locks the result and moves the winning challenge into the next stage of the show workflow.

### Live challenge controls

When a challenge is on air, the control panel displays its title, objective, submitting viewer, attempts used, attempt limit, and round value.

Operators can:

- Increase or decrease the attempt counter
- Award the round to the streamer
- Award the round to chat
- Skip or void the round

These actions update the authoritative server state, the session score, and every connected overlay.

### Generic run console

The control panel also includes a reference console for the newer headless framework. It can start a metric-based challenge, display its progress and current revision, publish a test metric event, and open the framework-specific OBS overlay.

This demonstrates how a creator-facing interface can control the generic engine without depending on the original proposal-and-voting experience.

## OBS overlays

Challenge.chat provides public, read-only browser sources for Open Broadcaster Software (OBS). The standard overlay automatically switches between show states:

- Idle branding
- Chat voting
- Pre-challenge countdown
- Active challenge
- Remaining time
- Attempt and point information
- Streamer victory
- Chat victory

The generic framework overlay can also render metric-driven runs, including countdowns, live progress, paused states, success, failure, and voided results.

A separate leaderboard overlay displays the top ten contributors for a selected board. It can include the leaderboard name, game filter, sponsor label, ranking, and point totals.

Each overlay URL contains its channel identifier. This keeps the browser source attached to the correct channel even if an owner switches to another channel in the control panel.

### Overlay studio

The overlay studio provides a safe 1920 x 1080 preview environment. Creators can inspect idle, countdown, active, voting, and result states without changing the real live session. Preview states can be restarted and opened at full size for testing before they are added to OBS.

## Branding and visual customization

The owner can configure broadcast appearance from the control panel. The reference implementation includes:

- Arcade, broadcast, and neon presets
- Custom primary and accent colors
- Separate success and failure colors
- Motion styles
- Compact or cinematic density
- Channel logo uploads
- Independent control-panel and broadcast tokens

Uploaded assets are stored in Cloudflare R2. Theme data is stored with the channel and included in the public overlay projection.

For deeper customization, `src/creator.tsx` is the creator-owned application entry point. A custom React control panel or overlay can consume the framework hooks and API client while leaving the engine, persistence, integrations, and authorization model unchanged.

## Channels

One Challenge.chat deployment can host multiple channels. Each channel has its own:

- Display name and stable identifier
- Live session
- Challenge queue
- Ballots and scores
- Branding
- Moderators
- Integration token
- Named board API/MCP tokens
- Challenger leaderboard
- OBS links

Owners can create channels and switch between them from the control panel. Moderators only see channels assigned to them. Renaming a channel or changing its display slug does not invalidate saved links because the system uses a stable channel ID internally.

Every data request is resolved within a server-verified channel scope. Client-provided challenge, ballot, run, or session identifiers cannot be used to cross channel boundaries.

## Challenger leaderboard

Each Channel has one all-time viewer ranking. It awards the author when:

- Their challenge is selected for the session
- Their challenge defeats the streamer

Award amounts come from the session's snapshotted scoring rules and are written to the contribution ledger when earned. Historical scores therefore retain their original value when Channel defaults change.

Approved ideas, voting finalists, played challenges, votes, and generic game telemetry do not add leaderboard points. The ranking is exposed in the public projection for viewer extensions, but it does not have a dedicated OBS overlay mode.

## Authentication and permissions

A deployment has one owner and any number of channel-assigned moderators.

The owner signs in with a password configured through a Worker secret or a one-time setup process. Moderators join through private, single-use links that expire after 15 minutes. Successful authentication creates an opaque HTTP-only session cookie.

Moderators can review suggestions, manage ballots, run challenges, and resolve outcomes in their assigned channels. Owners retain control over:

- Channel creation and settings
- Moderator membership
- Branding and themes
- Integration tokens
- Board API/MCP tokens
- Challenger award configuration
- Other deployment-level settings

Authorization is enforced inside the Worker. Hiding an owner-only button in React is never treated as a security boundary.

The public overlays do not require authentication, but they receive only a restricted projection of the state. Passwords, session data, invite tokens, integration credentials, and administrative fields are never included.

The owner creates and revokes named board tokens from Settings. Each token is scoped to one Channel and can operate only the bounded board API; it cannot manage owners, moderators, appearance, scoring, AI settings, or credentials. The same credential is accepted by the REST Board API and the remote MCP endpoint. WebMCP uses the signed-in owner's cookie-authenticated API path instead, so a bearer credential is never embedded in the browser bundle.

## Realtime architecture

Challenge.chat runs as one deployable Cloudflare Worker with several supporting services:

- Cloudflare D1 stores channels, users, challenges, ballots, Challenger contribution history, themes, and authentication records.
- A Durable Object coordinates each live session, serializes run updates, schedules alarms, rejects duplicate integration events, and distributes WebSocket messages.
- Cloudflare R2 stores uploaded branding assets.
- WebSockets push administrative state to the control panel and public projections to overlays.
- Recovery polling allows a client to refresh its state if a socket connection is interrupted.

The control panel receives the full administrative state after the server checks the user's role and channel membership. Overlays connect with a public scope and receive only information required for broadcast rendering.

## Replaceable surfaces

The control panel and overlays are clients of the headless framework rather than inseparable parts of the engine. Custom surfaces can use:

- The typed framework API client for run creation and event publishing
- React hooks for live state, reconnection, recovery, and control actions
- Default theme-to-CSS mappings
- Public overlay state for broadcast-only rendering
- Administrative state for authenticated creator tools

This separation allows a creator to redesign the control room, build a game-specific overlay, add a mobile moderation surface, or connect another broadcast system while preserving the same server-side rules and security model.

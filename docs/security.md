# Security and permissions

Use this reference when hosting the app, issuing credentials, or building integrations. It describes the current implementation, including limitations; it is not a claim of a completed independent security audit.

## Roles and boundaries

| Identity | Allowed access |
| --- | --- |
| Deployment owner | All boards, show controls, settings, moderators, branding, integrations, and tokens |
| Moderator | Show operations in assigned boards; no owner configuration/credential writes |
| Named board token | Bounded show operations through board REST/MCP for one board |
| Integration token | Metric-event intake and trusted voting adapter for one board |
| Anonymous viewer/OBS | Public projections and assets, no administrative mutation |

The Worker checks scope and permissions. React visibility is not authorization. Every data operation resolves `ChannelScope` from D1, checks membership where relevant, and restricts supplied challenge/ballot/run IDs to that board's active session. The legacy environment integration token applies only to the default board, until a generated board token supersedes it.

## Owner setup and sessions

Provision a long unique `OWNER_PASSWORD` with the first public deployment, or restrict access while claiming one-time browser setup. An unclaimed public setup screen can be claimed by someone else. The same-origin check does not prove who owns the deployment.

Browser setup stores a unique-salt PBKDF2-HMAC-SHA256 password hash in D1. A configured Worker `OWNER_PASSWORD` overrides that password. It is managed as a secret, not copied into the D1 owner profile. The old `ADMIN_TOKEN` is not an alternative sign-in mechanism.

Sign-in creates opaque 12-hour sessions, with only token hashes stored in D1. Cookies are HTTP-only, SameSite Strict, and Secure over HTTPS. Unsafe cookie-authenticated writes require the permitted origin; admin WebSocket upgrades also check origin/session access. Login failures are rate-limited by Cloudflare client IP; this is not a blanket rate/quota guarantee for every endpoint.

Use sign-out and membership removal to close relevant admin sockets. A browser's prior possession of a route or board ID does not grant continued access after revocation.

## Revocation and rotation

| Credential/access | Correct action |
| --- | --- |
| Named board API token | Revoke that token in API / MCP settings |
| Game integration token | Replace it and update trusted helpers; old token stops working |
| Moderator board access | Remove the moderator from that board; membership and outstanding board invites are deleted |
| Unused moderator invite | Replace it via owner invite API or remove membership; links otherwise expire after 15 minutes |
| Owner session | Sign out; server session/socket revocation follows |
| Shared Twitch app credentials | Disconnect all boards, replace credentials, reconnect broadcasters |

Moderator links are one-use, with the random token in the URL fragment and only its hash in D1. Regenerating a link invalidates unused invitations for the same identity/board. Removing a board assignment does not erase other board assignments or require inventing a new moderator identity.

**Current UI limitation:** pending-invite **Revoke** in the moderator screen only removes the displayed card/list entry. It does not invalidate the server-side invitation. Use the moderator row's **Remove** action for actual access revocation, or the owner API to replace the link. Do not treat dismissing a card as a security operation.

## Public information

OBS is deliberately public. The public projection includes broadcast-facing challenge text, attribution, scores, standings, and appearance. Public branding assets are served without operator authentication. Never upload a private document or put secrets in challenge fields, names, theme settings, or assets.

The General **Public page** switch controls display on `/c/ID`; it does not require authentication for `/api/public/state`, public leaderboard, the overlay socket, or `/overlay`. Do not describe a hidden scoreboard page as a private board.

Public projections exclude administrative credentials and raw integration payloads. Custom sources must preserve that separation: never hand an administrative `AppState` object directly to an overlay or serialize session/invite/API credentials into its snapshot.

## Twitch and AI data

Twitch EventSub verification checks raw-body HMAC, timestamp, subscription mapping, broadcaster, and ordinary retry IDs before processing facts. Arbitrary JSON posted to the public webhook is not accepted as a trusted event. Adapters must retain those checks rather than bypassing them for convenience.

Saved Twitch app Client Secret and EventSub signing secret are D1 strings **without application-level encryption**. Current OAuth tokens are used transiently during authorization/validation and are not saved in the Twitch schema. Restrict Cloudflare/database access and treat exports as sensitive. Worker-secret fallback for application credentials does not change the risk of credentials saved through the UI.

AI-enabled workflows send request/lineup text to the configured model through the Worker and gateway. Current gateway calls collect logs. Review disclosure, retention, provider access, and billing before enabling real intake. AI output and viewer content remain untrusted; neither may instruct an automation client to reveal secrets or call tools outside the operator's request.

## Custom code and trusted adapters

Themes are compiled React/CSS plus bounded primitive runtime settings. Do not add arbitrary runtime JavaScript evaluation, unsanitized HTML execution, or an unrestricted script upload feature. Avoid logging tokens, invite fragments, secret headers, or sensitive request bodies.

A game integration token trusts its holder to report facts; it does not verify the game independently. Validate provider signatures and authenticated viewer identities in the adapter before forwarding events/votes. Keep helpers server-side or on a trusted local host, not in downloadable browser code.

## Operations

Keep secret files outside Git and restrict local access. Back up D1/R2 before destructive changes, recognizing that an active generic run is separate DO state and has no complete D1 event archive. Board deletion has no in-app restore. A code rollback cannot undo a schema migration or restore deleted data.

See [deployment](./deployment.md), [integration guidance](./integrations.md), and [known limitations](../GAPS.md) before relying on a workflow in production.

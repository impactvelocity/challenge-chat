# Known limitations and scope decisions

The creator panel, settings, public board, eight registered themes, and Studio are connected to the Worker/D1/Durable Object system. This page separates remaining limitations from implemented behavior; the [documentation index](./docs/README.md) links operating and extension guides.

## Remaining limitations

- **Invite-card revocation:** pending-invite Revoke currently dismisses local UI state, not the server-side invitation. Remove that moderator's board access or replace the invitation through the owner API to invalidate it. Do not rely on dismissing the card as a security control. See [security](./docs/security.md#revocation-and-rotation).
- **Undo adjudication:** recorded outcomes and their ledger effects have no compensating undo transaction. The result-screen Undo control is disabled.
- **Voter detail:** ballots persist trusted voter IDs for enforcement, but projections expose aggregate totals rather than a browsable voter list. Drawers must not invent identities.
- **Historical drill-down:** round totals, challenge-win counts, streaks, and Challenger played/won totals are available. The current history projection does not provide a complete historical task list for each round.
- **Generic-run archive:** the coordinator stores the current definition/run and accepted-event markers, not an append-only full event log. Starting another generic run replaces the current one; product-session replacement clears coordinator storage. Generic runs are not archived into D1 automatically.
- **Unattended show automation:** reference-show auto-next and automatic ballot-close requests run in an open creator panel. D1 rejects late votes, but there is no DO alarm advancing that entire show flow while all panels are closed. Generic metric-run countdown/deadline alarms are separate.
- **Optional overlay data:** enabling a widget does not provision sponsor data, follower goals, or game telemetry. Live widgets render only available public data. Studio can demonstrate data that has no current production source/configuration UI.
- **Game support:** the reporter and example adapter are provider-neutral. There is no built-in universal gameplay/video verifier or claim of a working Fortnite/skateboarding telemetry integration.
- **AI cost controls:** parsing/naming default on and can incur charges locally or remotely. Feature switches exist, but the app has no per-board hard spending budget. Configured provider status is not a paid inference/credit-balance check.
- **Runtime theme uploads:** themes are compiled React/CSS with bounded primitive settings. There is no arbitrary uploaded HTML/JS/CSS theme execution or ZIP installer.
- **Public-page privacy:** disabling the scoreboard page does not protect the public state/API or OBS source. Do not place private information in broadcast fields/assets.
- **Credential hardening:** saved Twitch app/signing secrets are D1 strings without application-level encryption. OAuth tokens are currently transient, not persisted; there is no background refresh-token/subscription-repair service.

## Implemented behavior

- **Inbox persists across rounds.** Suggestions received outside open intake, unshortlisted ideas, and losing candidates remain board-scoped and can rejoin collecting sessions.
- **Draft editing and deselection work while collecting.** Pending/approved tasks can be edited; voting locks drafts. Original request/attribution are preserved by the reference editor.
- **Pause/resume is authoritative.** Show attempts persist paused timestamps in D1 and project them to OBS; generic runs also have engine-owned pause/resume.
- **Round titles persist.** Manual naming works without AI; regeneration checks the switch and avoids bounded recent names for that round with deterministic fallback.
- **Round rollover updates overlays.** Old session sockets close, the live source clears stale run state, and reconnect resolves the board's new active session.
- **Cancel and board deletion exist.** Cancel replaces the current contest while preserving unfinished Inbox ideas. Delete removes the board's data/assets/access; it is not an undoable reset.
- **Existing-board sign-in routes correctly.** The app prefers an explicitly selected completed accessible board, otherwise the first completed accessible board, before requiring setup.
- **Pending feedback is part of the creator flow.** Network-backed actions show loading/disabled states. This is per-client feedback, not a distributed lock or blanket endpoint idempotency guarantee.

## Deliberate scope choices

- Auto-next delay is persisted per board, but the countdown is local to the operator panel. Keep one panel driving it or advance manually.
- Ballot size/duration are snapshotted per ballot; board defaults only seed that choice. Each viewer gets a distinct-vote allowance equal to selected challenge count.
- Board colors are server-owned; local browser state caches appearance and Studio workstation preferences. Studio Game/Events remain mock-only, while theme/settings/elements persist to D1.
- Moderators can inspect/simulate Studio but cannot save owner appearance settings. The Worker rejects unauthorized writes regardless of controls shown.
- The public scoreboard polls every 15 seconds; OBS uses its public bootstrap/WebSocket source. Public projections exclude administrative credentials.
- Eight themes/fonts are eagerly registered. Unknown saved theme IDs fall back to Broadcast. The resulting initial bundle has a size warning; no code-splitting change is claimed by the documentation work.

Use [the release checklist](./docs/testing.md) before a broadcast. The [product plan](./PRODUCT_PLAN.md) describes design intent and is not an implementation checklist.

# UX migration gaps and decisions

The migrated creator UI, setup flow, public board, overlay SDK, nine built-in themes, and overlay studio are connected to the real Worker/D1/Durable Object system. The items below are deliberately empty, disabled, or locally scoped because the backend does not yet have the required authoritative data or operation.

## Backend capabilities still missing

- **Persistent inbox:** D1 stores suggestions for the active session, but there is no channel-level queue for ideas saved outside a session. The inbox renders its real empty state, and “move to inbox” explains that the idea remains in the current round.
- **Voter identities:** ballots persist trusted voter IDs for enforcement, but the admin/public projections expose only aggregate vote counts. Voter drawers therefore show no invented people. A future projection must consider viewer privacy before exposing identities.
- **Undo adjudication:** resolved rounds and their ledger effects have no compensating transaction. Undo is disabled after a server-recorded result.
- **Authoritative legacy pause/resume:** generic framework runs support server-owned pausing, but legacy challenge rounds do not. The play-screen pause button only freezes the creator's local presentation clock; it does not change the public overlay or server deadline.
- **Real Twitch moments:** follow, subscription, gift, raid, and cheer events exist only in the studio's mock source. No production Twitch adapter currently publishes them.
- **Overlay data for optional elements:** sponsors, follower goals, MVP, hype/match status, and theme signature widgets have no real channel projection unless a generic framework metric supplies an equivalent value. On `/overlay`, unavailable elements render no fabricated values; the studio continues to demonstrate them with mock data.
- **Detailed historical drill-downs:** D1 exposes authoritative session scores, challenge-win counts, streaks, leaderboard points, and per-challenger played/won totals, but not the historical challenge list per session. Public/admin round drill-downs stay empty.
- **Board deletion:** there is no channel deletion endpoint or retention policy. The destructive control is disabled instead of showing a false success state.
- **Abandon/restart an active session:** the Worker can rotate only a completed session; it has no transactional abandon operation for pending ideas, ballots, or active rounds. “New round” stays disabled until Results instead of resetting only the browser.

## Implemented scope decisions

- **New-board setup:** the compatibility `demo-channel` is always usable, so existing deployments open the control room. Every board created through the channel switcher is sent to `/setup?channel=…`; an empty collecting session also presents the control room's initial Setup stage.
- **Auto-next:** `autoNext` and its countdown are persisted per channel. The signed-in control room performs the countdown and calls the same authoritative start/complete APIs; the Worker does not run an unattended alarm if the control room is closed.
- **Per-round ballot size:** the Top 3/5/10 choice is sent with ballot creation, validated by the Worker, and snapshotted on that ballot. Channel voting defaults still seed the control.
- **Control-panel accent:** the creator UI accent remains a per-browser preference. Broadcast colors come from the channel's server-side theme/config, so an operator preference can never leak into OBS.
- **Studio preferences:** panel position, size, active tab, guides, facecam, background/video URL, and sound remain in `localStorage` as workstation preferences. Theme, theme settings, and element visibility are channel-owned D1 data.
- **Moderator studio access:** moderators may inspect and exercise the studio's mock Game, Events, and Canvas tools, but Theme and Elements are read-only. The Worker independently rejects moderator writes to overlay/session branding settings.
- **Public page transport:** `/c/:channelId` reads the public projection and polls for recovery. The live OBS source uses the public WebSocket projection; no admin state or credentials reach either public surface.
- **Theme fallback and bundle size:** unknown saved theme IDs fall back to Broadcast. All nine theme font bundles are eagerly registered, matching the source UX; this produces a larger initial JavaScript bundle but keeps theme discovery consistent across Setup, Settings, Studio, and OBS.

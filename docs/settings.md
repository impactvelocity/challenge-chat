# Settings reference

Settings apply to the board selected by `?channel=BOARD_ID`, except the Twitch developer application and deployment AI gateway/model, which are shared deployment configuration. Owners manage configuration; moderators operate assigned shows. The Worker enforces those permissions even if a client displays a control.

## Saving changes

General, Scoring, Voting, and Theme use a draft and **Save changes**. **Discard** restores the saved draft; previewing a color is not a server save. AI switches save immediately. Token, moderator, and Twitch buttons perform their labeled action immediately or after confirmation.

Wait for pending feedback to finish. A failed save reports an error; for multi-part settings, refresh before assuming every requested field was rolled back. Separate configuration writes are not one global transaction.

## General — `/settings/general`

| Setting | Behavior |
| --- | --- |
| Board name | Display name; does not change the stable board ID or existing OBS URL |
| Twitch channel | Login used for public-page links; entering it does **not** authorize EventSub |
| Public page | Shows/hides scoreboard content on `/c/BOARD_ID`; not an access restriction on public APIs or OBS |
| Appearance | Board primary and Chat colors; Chat can follow a complementary color |
| Auto-start next challenge | Creator-panel countdown after a called result; default on |
| Countdown | Delay between challenges, 5–300 seconds; default 45 seconds |
| Delete board | Permanently removes its data, membership, uploaded branding, and tokens; OBS links stop working |

Auto-next requires an open creator panel and is separate from the fixed 10-second pre-start countdown. Cancel its current countdown on the result screen when you want to hold a moment. Avoid multiple panels independently auto-advancing.

Use the board deletion confirmation only when you intend to remove the namespace, not end a round. Back up first if its history matters. Deletion has no in-app restore.

## Scoring — `/settings/scoring`

Classic uses 1 point per challenge and 1 for each selected/defeated-streamer Challenger award. Arcade uses 100 for each. Both start with round-win bonus 0 and sweep multiplier off. Editing values makes the configuration Custom; switching presets can replace custom values after confirmation.

| Field | Meaning |
| --- | --- |
| Points per challenge | Awarded to the side that wins a scored challenge |
| Round-win bonus | Added to the round winner; none for a tie |
| Clean-sweep multiplier | Multiplies the sweeping side's challenge score before the round-win bonus |
| Multiplier / sweep label | Percentage and on-screen name for that bonus |
| Challenge selected | Challenger points for an author whose task enters the selected lineup |
| Beats the streamer | Additional Challenger points if that task wins for Chat |

For example, at 100 points/challenge, five wins and a 150% sweep yield 750 team points before a round-win bonus. Skips/voids do not count as scored wins and prevent a strict all-challenges sweep.

Changes can update a collecting round only before its first ballot/attempt; otherwise they become defaults for the next round. Earned awards and completed results keep their original amounts. The UI's examples describe the current draft; server snapshots decide the active contest's actual rules.

## Voting — `/settings/voting`

| Field | Range / behavior |
| --- | --- |
| Shortlist size | 2–10 |
| Challenges selected | At least 1 and fewer than the shortlist size |
| Votes per viewer | Follows the number selected; not a separate independent allowance |
| Default voting length | Seeds the duration when opening a ballot; API accepts 10–900 seconds |

Defaults are shortlist 10, selected 5, duration 600 seconds. The actual ballot snapshots its own duration/count; the operator can choose a per-vote duration. Ties use shortlist order and cast votes are not removable.

## Theme — `/settings/theme`

Choose from the compiled theme registry and adjust its schema-driven controls. Theme settings are independent of control-panel layout. The preview uses mock data; **Save changes** persists the selected theme and per-theme values to D1.

Each theme declares its own colors, layout, motion, density, and other controls, so the fields vary. Changing theme does not automatically enable widgets. Use the header's overlay-elements sheet or Studio's Elements tab to select those.

Stored per-theme settings can survive switching away and back. Unknown theme IDs fall back to Broadcast. See [custom themes](./custom-themes.md) for code-level changes and [OBS setup](./obs-setup.md) for broadcast placement.

## Moderators — `/settings/mods`

Create a named moderator and privately send its one-use link. Links expire in 15 minutes; redemption creates a 12-hour sign-in session. Do not post invite URLs in chat or put them in OBS.

**Remove** revokes that board's membership, invalidates its invitations, and closes affected admin sockets. Other board assignments can remain. The backend supports granting an existing identity another board and regenerating an invite; not all of those operations have dedicated controls in this screen.

Current limitation: the pending-invite card's **Revoke** only dismisses local UI state. To actually invalidate access, remove that moderator from the board (or replace the invitation through the owner API). See [security and revocation](./security.md#revocation-and-rotation).

## OBS — `/settings/obs`

Copy the board ID and live Challenge Overlay URL. Browser Source settings are 1920 × 1080, **Shutdown source when not visible: Off**, and **Refresh browser when scene becomes active: Off**. No owner login/token belongs in the source URL. Follow the [OBS guide](./obs-setup.md).

## Twitch — `/settings/twitch`

This tab provides registration URLs, application-credential status, broadcaster authorization, listener status, and last activity/error information. One Twitch application serves the deployment; each board connects its broadcaster separately. A broadcaster can currently connect to only one board per deployment.

Changing General's Twitch login does not switch the authorized broadcaster. Use disconnect/connect here. Disconnect every connected board before replacing the shared application credentials. Follow the [Twitch setup guide](./twitch-setup.md).

## AI — `/settings/ai`

| Control | Saved setting | Default |
| --- | --- | --- |
| Use AI parsing | `aiParsing` | On |
| Write challenge titles | `aiChallengeTitles` | On; shown when parsing is enabled |
| Name rounds automatically | `aiTitles` | On |
| Tone | `aiRoundNameTone` | `playful`; also `hype` / `straight` |

Switches save immediately and independently. Turning off title writing does not turn off the parsing request; turn off parsing to stop that request path. Turn off automatic round naming too for a no-AI workflow. Manual titles, limits, and challenge edits remain available.

Provider status reports configured binding/gateway/model values, not a successful paid health check or remaining credits. The model and gateway are configured in Wrangler, not entered as per-board tokens. See [AI behavior and cost](./ai.md).

## API / MCP — `/settings/api`

Create a named board API token for each automation client. Copy the full token before leaving; it is shown once. Later, the list shows its name, last four characters, creation time, and last-use time. **Revoke** invalidates that token without replacing other clients' tokens.

This tab also exposes REST/MCP endpoints, OpenAPI, browser WebMCP information, and the narrower **Game event token**. Creating/replacing a game token invalidates the previous reporter credential immediately. These credentials are not interchangeable. See [HTTP API](./api.md), [MCP](./mcp.md), and [integrations](./integrations.md).

## Dev — `/settings/dev`

**These tools mutate the selected board's real state.** Use a test board.

- Mock Chat sends `!challenge` and `!vote` through authenticated product APIs. Closed intake routes suggestions to the real Inbox. AI-enabled submissions can incur real charges.
- Custom Game API starts the example `kills` framework run, can enable its overlay element, and sends normalized enemy-defeat metric increments. Only one nonterminal generic run can occupy the session.
- The game tester proves the engine/transport path, not support for a particular game's live telemetry.

For harmless local scene/event simulation use **Overlay Studio**, not Settings → Dev.

## Scope reference

Schema defaults and bounds live in [`shared/surface-config.ts`](../shared/surface-config.ts) and [`shared/scoring.ts`](../shared/scoring.ts). Some UI steppers intentionally have narrower bounds than API schemas. Source screens are composed under [`src/pages/main/`](../src/pages/main/); the shared settings body is [`ChannelSettings.tsx`](../src/pages/app/ChannelSettings.tsx).

# OBS setup

Add the public live overlay as a transparent browser source, then choose a theme and optional widgets. Do not add the control panel or Studio as your production source.

## Add the browser source

1. Open the intended board in Challenge.chat and go to **Settings → OBS**.
2. Copy **Challenge Overlay URL**, including `?channel=BOARD_ID`.
3. In OBS, add a **Browser** source above your gameplay capture.
4. Turn Local file off, paste the URL, and set **Width: 1920**, **Height: 1080**.
5. Leave **Shutdown source when not visible** and **Refresh browser when scene becomes active** off.
6. Fit the 16:9 source to the scene and confirm it is not cropped.

OBS documents these fields and its default transparent Browser Source CSS in the [Browser Source reference](https://obsproject.com/kb/browser-source). Challenge.chat also keeps the real `/overlay` page transparent.

The source is public and read-only. Do not include a password, session cookie, board API token, integration token, or moderator invite in its URL. The board ID is a routing identifier, not a secret credential.

## Choose what appears

Select the theme in **Settings → Theme**, adjust its controls, and save. Open the header's overlay-elements sheet or Studio's **Elements** tab to enable widgets. Optional elements start off; a clean or empty canvas is not necessarily a connection failure.

Scene cards follow the real show: ideas, vote, locked lineup, pre-start countdown, active challenge, individual result, and round results. The pre-start countdown is part of the live scene and lasts 10 seconds for the reference show. Built-ins reduce the active card after the introduction to leave more gameplay visible. Exact layout depends on the theme.

Widgets appear only when enabled **and** their required data exists. For example, `kills` needs a public `kills` metric from a framework run; turning on a sponsor or follower-goal widget does not create that data. Challenger rankings are an element/public projection, not a separate leaderboard-overlay URL.

## Preview without running the show

Open authenticated **Overlay Studio** at `/overlay/studio?channel=BOARD_ID`.

| Tab | Effect |
| --- | --- |
| Theme | Choose theme/settings; changes persist to the board |
| Elements | Toggle widgets; changes persist to the board |
| Game | Simulate show stages, attempts, pause/resume, winners, and metrics locally |
| Events | Simulate presentation/community alerts locally and inspect event activity |
| Canvas | Gameplay/still/video background, facecam, safe-area guides, and workstation preferences |

Theme/element editing is owner-only; moderators can inspect and operate the mock simulation. The Game/Events simulation does not publish to the real board. Canvas backgrounds are preview context, not part of the transparent live source. Browser-local Studio preferences do not become another operator's board settings.

Useful preview URL parameters include `scene=live`, `winner=chat`, `bg=clear`, and `ui=0` to hide controls. Example: `/overlay/studio?channel=BOARD_ID&scene=result&winner=chat&bg=clear`. The old `/overlay-demo` route redirects here.

Before broadcasting, inspect all scenes, both winners, long objectives/usernames, countdown/paused/untimed states, and each enabled widget over representative gameplay. Preview success does not prove live data is connected—check `/overlay` too.

## Keep the source across rounds

Keep the same board-specific live URL in OBS. A new round replaces the session coordinator; the overlay reconnects using that board's current session and refreshes public state. Changing boards in the creator panel does not retarget OBS. Create another browser source when you need another board.

Persistent scores/state recover after reconnect. Transient alerts and snapshot-diff animations are not a replay queue, so activity during disconnection may not animate later. Leave hidden-source shutdown off when you want the connection to remain active while switching scenes.

Auto-next is a creator-panel feature: OBS does not advance the show for you. Keep one operator panel open when relying on its countdown, or advance manually.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Entire game covered | Source URL must be `/overlay`, not `/`, Studio, or a public scoreboard |
| Empty source | Correct board ID, current scene/data, enabled elements, and public bootstrap response |
| Wrong board | Compare the exact `channel` in OBS and the creator panel |
| Large active card | Check the chosen theme/layout and distinguish countdown from active play |
| Widget enabled but missing | Confirm its public data/metric exists; mock data is not production data |
| Old state after switching scenes | Disable shutdown/automatic refresh, check connectivity, then use OBS refresh if needed |
| Cropped/misaligned graphics | Browser viewport 1920 × 1080, source transforms, scene scaling, and theme safe areas |
| No Twitch alert animation | Twitch listeners enabled, correct element on, no disconnect during the event |

For custom graphics, use the [React SDK](./react-sdk.md) and [theme authoring guide](./custom-themes.md). Keep animation and rendering in the theme; keep outcome logic on the server.

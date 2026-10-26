# Overlay SDK

Everything the stream overlay shows, as React hooks over one live snapshot, plus a registry of themes that draw it.

```
src/overlay/
  sdk/        the SDK: data contract, store, provider, hooks, theme registry (no app UI imports)
  themes/     registered themes: `broadcast/` is the base, `kit/` lets the styled themes reuse it
  mock/       a stand-in source: the session game loop and a busy chat, with autoplay
  controls/   app-side UI: the scaled canvas, a live preview, and a compact settings form from a theme's schema
```

The board's overlay config (theme, settings per theme, which elements are on) lives in `src/data/overlayConfig.ts`. The control room's Overlay Elements sheet and Settings → Theme write it; `/overlay` reads it, live across tabs. In production it belongs with the board and reaches overlays as the snapshot's `display`.

## Using it

```tsx
import { OverlayProvider, OverlayRenderer } from '@/overlay/sdk';
import '@/overlay/themes'; // registers the built-in themes

<OverlayProvider source={source}>
  <OverlayRenderer /> {/* the theme, settings and elements the snapshot's `display` picks */}
</OverlayProvider>;
```

`/overlay` runs against `createLiveSource()`: it bootstraps from the Worker's public D1 projection, then receives board and framework-run updates over the channel-scoped Durable Object socket. `/overlay/studio` uses `createMockSource()` for local scene and theme work. `<OverlayPreview display scene />` (in `controls/`) is the same overlay held at one scene for settings pages.

## Hooks

| Hook | Gives you | Ticks with the clock |
| --- | --- | --- |
| `useRound()` | The whole game loop: stage, scene, ideas, ballot, lineup, live challenge, phase, clock, countdown, attempts, call, auto-next, tonight's score, streak, momentum, winner, sweep, MVP | yes |
| `useBoard()` | The whole board: season totals with tonight folded in, record, session/challenge streaks, sweeps, history, leaderboard, metrics, sponsors | no |
| `useChallenge()` | The live challenge with its phase, clock, countdown, attempts, call, up next | yes |
| `useClock('round' \| 'ballot' \| 'submissions' \| 'next')` | One clock: `text`, `remaining`, `elapsed`, `progress`, `pending`, `paused`, `expired` | yes |
| `useBallot()`, `useSubmissions()` | The vote and the ideas, with their clocks | yes |
| `useScore()`, `useStreak()`, `useLineup()`, `useAttempts()` | Narrow slices of `useRound()` | no |
| `useLeaderboard(n)`, `useSeason()`, `useMetric(id)`, `useMetrics()`, `useSponsors()` | Narrow slices of `useBoard()` | no |
| `useStage()`, `useScene()`, `useSides()`, `useChannel()`, `useDisplay()`, `useConnection()` | Single values | no |
| `useOverlaySelector(fn, { time })` | Anything else, re-rendering only when your selection changes | optional |
| `useOverlayEvent(type, fn)` | Moments to animate: `round.call`, `round.attempt`, `lead`, `streak`, `idea`, `votes`, `goal`, `session.end`… (or `'*'`) | — |

Source-specific transient moments travel through `sink.event({ type: 'custom', ... })`; Broadcast's Alerts element understands `follow`, `sub`, `gift`, `raid`, and `cheer`. The production Twitch adapter validates and normalizes EventSub payloads in the Worker, then the Channel coordinator sends a bounded `integration.moment` projection to overlay sockets. Game integrations should normally report normalized framework facts such as `metric.incremented`. Those are validated and stored by the Worker, projected over the socket, exposed by `useMetric()`, and rendered by elements such as the kill counter.

Clock hooks re-render once a second at most, whatever the tick rate. Events are derived by diffing snapshots, so a source only has to send state; nothing fires for the first snapshot.

## Themes

```tsx
export const myTheme = defineTheme({
  id: 'my-theme',
  name: 'My Theme',
  settings: {
    glow: { type: 'number', label: 'Glow', default: 40, min: 0, max: 100, unit: '%', group: 'Look' },
    corner: { type: 'select', label: 'Corner', default: 'left', options: [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
  },
  Layout,                                   // places <SceneOutlet /> and <ElementOutlet region="…" />
  scenes: { live: LiveCard, result: Winner }, // idle · open · vote · lock · live · result · done
  elements: { scoreboard: { label: 'Scoreboard', region: 'stack', Component: Scoreboard } },
});
registerTheme(myTheme);

// in its components: fully typed from the schema
const { glow, corner } = myTheme.useSettings();
```

- Setting types: `boolean`, `number` (min/max/step/unit), `select` (options), `color` (`null` follows the board), `text`. Values are checked against the schema before a theme sees them, and the control room builds its form from the same schema (`controls/ThemeSettingsForm`).
- Regions are the theme's own names; its Layout decides where each goes. New boards begin with every element off, and off elements are still passed to `ElementOutlet` so they can animate out.
- `extendTheme(base, { id, name, … })` makes a variant: add settings, swap any scene, element or the layout, keep the rest.
- The control room lists a theme's elements by their `group` (ungrouped first) and builds Settings → Theme from its schema, so a new theme needs no control-room changes. Reuse the conventional ids (`scoreboard`, `leaderboard`, `goal`, `kills`, `sponsor`) and a streamer's switches carry over when they change theme.

### Built-in themes

Broadcast is the base. The other seven share its scenes and elements through `themes/kit/` and restyle them from their own stylesheet under `.sk[data-skin='…']`, swapping in their own components where the idea needs different markup (and wherever a light surface would fight Broadcast's white text). Each carries the kit's `CORE` settings (both side colours, stack side, size) plus two of its own, and one signature element.

| Theme | Own settings | Signature element |
| --- | --- | --- |
| Arena | Finish (gloss/matte), Score in | TV score bug as the scoreboard; Replay Sting (`fx`) |
| Arcade Clash | Pixel numbers, Sticker tilt | VS health bars as the scoreboard (`banner`); Combo Pops (`fx`) |
| Creator Neon | Glow, Scan lines | Hype Meter (`stack`) |
| Esports Command | HUD colour, Tactical grid | Match Status (`banner`) |
| Cozy Corner | Paper (cream/cocoa), Handwritten notes | To-Do Note (`stack`) |
| Dark Relic | Distress, Flicker | Doom Clock (`corner`) |
| Comic Chaos | Paper (pop/pulp), Wonky panels | Impact Words (`fx`) |

`styledLayout(id)` adds two regions to Broadcast's: `banner` (top centre, above alerts) and `fx` (the whole frame, above everything; its elements mount only while on). A theme's own select and boolean settings reach its stylesheet as `data-*` attributes on the root, numbers as `--sk-*` variables (percentages as 0–1).

## Sources

A source is `{ connect(sink) => stop }`. It calls `sink.snapshot()` with full state, `sink.patch()` with top-level parts (e.g. `{ session }` from the Durable Object socket and `{ history, challengers }` from D1), `sink.status()` for the connection, and `sink.event()` for anything a snapshot can't say. Stale revisions are dropped.

The snapshot (`sdk/types.ts`) uses server epoch milliseconds throughout. Clocks are `{ startsAt, endsAt, pausedAt }`; resuming shifts both ends by the pause, so every client derives the same time with no ticking from the server. A future `startsAt` is a pre-start countdown.

`sources/live.ts` maps the Worker's `PublicOverlayState` into the SDK contract: ISO strings to milliseconds, `phase` to `stage` (collecting → open, voting → vote, ready → lock, live → live, complete → done), `activeRound` to `session.round`, and the live framework run's public metrics to `metrics`.

Settings → Dev includes a Custom Game API harness. Starting the kill tracker creates the example framework run, enables the `kills` element, and sending an enemy defeat publishes the same idempotent `metric.incremented` event a server-side game adapter would send. The open OBS page updates without a reload.

The SDK contract test renders every public data hook, theme/scene/element hooks, custom events, and the real kill-counter component. The live-session test covers the Cloudflare Durable Object broadcast and duplicate-event protection; the adapter and live-source tests cover normalization and public projection mapping.

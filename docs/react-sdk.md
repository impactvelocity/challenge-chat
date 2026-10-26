# React overlay SDK

Use the overlay SDK to render public show state without copying game rules or transport code into your graphics. This guide is the entry point; the [full SDK reference](../src/overlay/README.md) contains the hook table, complete theme starter, source contract, and event payload links.

The SDK lives in this repository, not a published npm package. Imports use this project's `@/` → `src/` alias. If extracting it into another app, carry over its types/store/derived-model code and supply a source appropriate to your deployment; do not assume the same-origin browser source factory is an arbitrary remote API client.

## Mount the live source

```tsx
import { useState } from 'react';
import { OverlayProvider, OverlayRenderer } from '@/overlay/sdk';
import { createLiveSource } from '@/overlay/sources/live';
import '@/overlay/themes';

export function LiveBroadcast() {
  const [source] = useState(() => createLiveSource());
  return (
    <OverlayProvider source={source}>
      <OverlayRenderer />
    </OverlayProvider>
  );
}
```

Mount on a URL with `?channel=BOARD_ID`. Keep the source stable across renders; changing its identity disconnects/reconnects the provider. The source loads the public bootstrap, connects the public session socket, and refreshes after reconnect. It has no bearer credential and must not receive administrative state.

`OverlayRenderer` uses the snapshot's theme/settings/element switches. Optional prop overrides are preview-only and do not save settings. The registered theme owns layout; the production route supplies the transparent full-screen surface.

## Choose the narrowest hook

| Graphic | Hook |
| --- | --- |
| Title, phase, attempts, and task timer | `useChallenge()` |
| Timer alone | `useClock('round')` |
| Vote entries/shares | `useBallot()` |
| Idea feed | `useSubmissions()` |
| Streamer-versus-Chat score | `useScore()` |
| Challenger ranking | `useLeaderboard(limit)` |
| Specific game metric | `useMetric(id)` |
| Channel name/colors | `useChannel()`, `useSides()` |
| Current presentation scene | `useScene()` |
| Broader show/season model | `useRound()`, `useBoard()` |
| Custom derived slice | `useOverlaySelector()` |

For example, a widget can show a metric while remaining absent when the live game adapter has not supplied it:

```tsx
import { useMetric } from '@/overlay/sdk';

export function KillCounter() {
  const metric = useMetric('kills');
  if (!metric) return null;
  return <div>{metric.label}: {String(metric.value)}</div>;
}
```

Subscribe only to what the widget needs. A static logo does not need the entire clock-driven round model. Custom selectors use shallow equality by default; prefer stable primitives/references and replace nested source objects immutably. `useNow()` ticks four times per second; normal display clocks are a better choice for timer text.

## Understand scenes and clocks

Server show phases map to SDK stages: collecting → `open`, voting → `vote`, ready → `lock`, live → `live`, complete → `done`. Empty closed intake can become `idle`. A called winner produces the separate `result` scene during live play.

The `live` scene contains countdown, playing, paused, and time-up phases. Use `useChallenge().phase` to make the introduction larger and active HUD smaller; adding a separate `countdown` scene key will not work because it is not a supported scene.

Snapshot clocks use epoch milliseconds; challenge duration fields use seconds. A future `startsAt` indicates pre-start countdown, `endsAt: null` is untimed, and `pausedAt` freezes the displayed reading. The store derives text/progress locally from those values. Rendering a timer never resolves a challenge or writes to the server.

## Events, sources, and tests

`useOverlayEvent()` is for presentation: winner stings, goal celebrations, and normalized community alerts. Initial hydration does not replay old derived events. These hints are not a durable queue and must not drive accounting or state transitions.

Use `createMockSource()` only for Studio/tests. Custom replay/still sources implement `connect(sink)` and return cleanup. `snapshot` replaces complete state; `patch` merges only top-level fields. Keep revisions monotonic and mark whether supplied Challenger standings already include the current session's awards to prevent double counting.

Continue with these focused references:

- [Provider/source mounting](../src/overlay/README.md#mount-a-live-overlay)
- [All public hooks and clock fields](../src/overlay/README.md#read-state-with-hooks)
- [Presentation events](../src/overlay/README.md#presentation-events)
- [Snapshots and custom sources](../src/overlay/README.md#sources-and-snapshots)
- [Mock scene example](../src/overlay/README.md#mock-a-scene)
- [Custom theme authoring](./custom-themes.md)
- [Real transport and round replacement](./durable-objects.md)

Run `npm test` and `npm run build` after SDK changes. Test both the mock scene and real public source; a theme can render correctly while its live data adapter is wrong.

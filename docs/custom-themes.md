# Custom overlay themes

Create a branded broadcast appearance without changing the challenge engine, transport, or permissions. Runtime appearance is bounded data; custom React/CSS is compiled into the deployment.

## Choose the level of customization

| Need | Approach |
| --- | --- |
| Different colors, sizes, motion, or widget selection | Existing Theme settings and Elements controls |
| A branded variant with a few different components | `extendTheme()` from a built-in |
| A different layout and scene composition | `defineTheme()` with a layout, scenes, and elements |
| A redesigned operator app | Creator composition under `src/creator.tsx`, not the overlay theme |

There is no runtime theme ZIP/HTML/JavaScript installer or unrestricted uploaded CSS editor. Uploading an image does not install a new renderer. Keep stored settings declarative and do not add `eval`, arbitrary script URLs, or executable rule strings.

## Extend Broadcast

Create `src/overlay/themes/my-show/index.tsx`. This example keeps Broadcast's scenes/layout and replaces its scoreboard while adding one setting:

```tsx
import { extendTheme, useScore, useSides } from '@/overlay/sdk';
import { broadcast } from '@/overlay/themes/broadcast';

function BrandedScoreboard() {
  const { score } = useScore();
  const sides = useSides();
  const { scoreSize } = myShow.useSettings();
  return (
    <div style={{ background: '#15151d', padding: 16, fontSize: scoreSize }}>
      {sides.streamer.name} {score.streamer.points}
      {' — '}
      {score.chat.points} {sides.chat.name}
    </div>
  );
}

export const myShow = extendTheme(broadcast, {
  id: 'my-show',
  name: 'My Show',
  settings: {
    scoreSize: {
      type: 'number', label: 'Score size', default: 24, min: 16, max: 48,
      unit: 'px', group: 'Scoreboard',
    },
  },
  elements: {
    scoreboard: { label: 'Scoreboard', region: 'stack', Component: BrandedScoreboard },
  },
});
```

Inherited components continue using the merged base settings. The replacement element's region is `stack` because the inherited Broadcast layout has that outlet. Choosing a region the layout does not render makes the component invisible.

In [`src/overlay/themes/index.ts`](../src/overlay/themes/index.ts), import `myShow` and append it to `BUILT_IN`. That file already loops over the array and registers each theme. Do not also register it inside the module or add its ID to separate Setup/Settings/Studio lists.

Run tests/build, select **My Show** in Theme settings, save, and enable **Scoreboard**. Optional widgets default off even when declared by a theme.

## Define a complete renderer

Use the [complete `defineTheme` starter](../src/overlay/README.md#create-a-theme) when extending a base is insufficient. A theme consists of:

- A stable slug `id`, human-readable `name`, and optional description.
- A `settings` schema for primitive controls.
- A `Layout` component that places `SceneOutlet` and `ElementOutlet` regions on a transparent 1920 × 1080 canvas.
- Scene components for `idle`, `open`, `vote`, `lock`, `live`, `result`, and `done` as needed.
- An element map with labels, regions, optional groups/descriptions, and React components.

Missing scenes render nothing. `SceneOutlet` remounts when the scene/challenge/result key changes so entrance animations can replay. Countdown is a phase inside `live`, not another scene. Use a large countdown introduction and a smaller active card to preserve gameplay visibility.

`ElementOutlet` passes off elements too, letting a theme control exit animations. Only mount them when on if no exit behavior is needed. Keep event subscriptions and timers cleaned up so remounting does not duplicate effects.

## Settings and persistence

Setting types are boolean, bounded number, select, hex color/null, and text. `theme.useSettings()` infers the values. Theme hooks require `OverlayRenderer`'s context; ordinary data hooks require `OverlayProvider`.

The Worker stores board configuration as theme ID, settings grouped by theme ID, and element switches. It validates bounded primitive payloads; React schema resolution fills defaults, clamps numeric ranges, rejects invalid selections/colors, and truncates text. Changing a schema does not run a migration automatically—keep IDs/settings compatible or define explicit fallback behavior.

Reuse conventional element IDs only when semantics match (`scoreboard`, `leaderboard`, `goal`, `kills`, `sponsor`). This lets user switches carry across themes. A new setting has no visible effect until a component consumes it.

## Brand assets

You can bundle approved fonts/images with your theme and import them from its compiled source. Scope CSS to the theme root to avoid leaking into other themes or the creator app. Keep the live page background transparent.

The Worker also has an owner-only asset upload endpoint, `POST /api/assets?channel=ID`, accepting multipart `file` images of PNG/JPEG/WebP up to 3,000,000 bytes. It stores R2 branding objects and returns a public `/api/assets/brand/…` URL. A custom surface/theme must explicitly save and consume an asset reference; upload alone does not place a logo on air. Do not confuse Studio's local background upload with deployed R2 branding.

Treat uploaded branding as public. Stored theme values do not authorize arbitrary HTML/JS execution. Validate URL/media behavior if adding a new asset-setting capability.

## Test before broadcasting

Run `npm test` and `npm run build`, then inspect Studio with every scene, both sides winning, long text, high scores, empty/missing metrics, and all widgets off/on. Check countdown, playing, pause, time-up, and untimed states. Verify safe areas over real-looking gameplay at 1920 × 1080 and scaled preview sizes.

Finally open the real `/overlay?channel=ID`, change saved settings, run a test challenge, and rotate the round. Confirm it follows real public data without needing a reload. Studio Game/Events is mock state; its success alone is not transport verification.

See [the SDK reference](../src/overlay/README.md) for exact types and [OBS setup](./obs-setup.md) for the production source configuration.

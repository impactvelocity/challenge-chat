# Overlay renderer system proposal

Status: design note for later implementation. The registry, presentation hook, and custom-renderer contracts described here do not exist yet.

This document describes how Challenge.chat can support built-in overlay styles and developer-authored React overlays without changing the engine or requiring creators to manage multiple Open Broadcaster Software (OBS) browser sources.

## Product model

Each Channel has one program-overlay URL:

```text
/overlay?channel=CHANNEL_ID
```

The selected renderer and its validated configuration belong to the Channel. Changing the renderer or its colors does not change the OBS URL.

An overlay has two layers:

- The renderer controls React composition, animation, placement, and the layout for each show moment.
- The configuration contains safe runtime values such as colors, labels, motion level, density, placement, and approved assets.

The program overlay remains transparent when there is nothing to show. Persistent and interactive viewer features, including voting controls and the Challenger leaderboard, belong in viewer extensions rather than separate OBS overlay modes.

## Built-in renderers

The first release can ship approximately five registered styles. Possible directions include Clean Broadcast, Arcade, Neon, Minimal, and Esports. Names and art direction can change before implementation.

Built-in renderers may have different layouts and animation systems. They still consume the same public data and support the same required show moments:

- Hidden
- Submissions opened
- Voting
- Vote result
- Challenge starting
- Challenge active
- Challenge result
- Session result
- Framework run active, paused, and resolved

Shared configuration should use a small set of validated controls:

- Primary, accent, success, and failure colors
- Streamer and Chat labels
- Motion level
- Compact or cinematic density
- Safe-area placement
- Short result labels
- Approved image assets when supported by the renderer

Configuration must not contain executable JavaScript, arbitrary HTML, or unvalidated CSS.

## Proposed source layout

Keep renderer source under `src/overlays`:

```text
src/overlays/
  registry.ts

  sdk/
    define-overlay.ts
    types.ts
    use-overlay-presentation.ts
    OverlayRoot.tsx

  presets/
    clean/
      manifest.ts
      Overlay.tsx
      styles.css
    arcade/
      manifest.ts
      Overlay.tsx
      styles.css

  custom/
    my-stream-overlay/
      manifest.ts
      Overlay.tsx
      styles.css
      preview.ts
```

The source directory does not become a public route. Preset and custom renderers all run through `/overlay`.

## Renderer registration

Custom React code must be registered at build time so Vite can compile it into the deployment. A JSON file can describe metadata, but it cannot safely load a React component at runtime.

A renderer should export a typed registration:

```tsx
import { defineOverlay } from "../../sdk/define-overlay";
import { MyStreamOverlay } from "./Overlay";

export default defineOverlay({
  id: "my-stream-overlay",
  name: "My Stream Overlay",
  apiVersion: 1,
  component: MyStreamOverlay,
  settings: {
    primary: {
      type: "color",
      label: "Primary color",
      default: "#7c5cff",
    },
    streamerLabel: {
      type: "text",
      label: "Streamer label",
      default: "Streamer",
      maxLength: 24,
    },
    motion: {
      type: "select",
      label: "Motion",
      default: "full",
      options: ["reduced", "full"],
    },
  },
  supportedMoments: [
    "hidden",
    "submissions_opened",
    "voting",
    "vote_result",
    "challenge_starting",
    "challenge_active",
    "challenge_result",
    "session_result",
  ],
});
```

Start with an explicit registry:

```tsx
import arcade from "./presets/arcade";
import clean from "./presets/clean";
import custom from "./custom/my-stream-overlay";

export const overlayRegistry = {
  [arcade.id]: arcade,
  [clean.id]: clean,
  [custom.id]: custom,
};
```

An explicit registry is easier to type-check and validate than runtime discovery. A build script can generate it later if the number of renderers makes manual registration cumbersome.

## Presentation contract

Custom renderers should not independently derive show priority and timing from `PublicOverlayState`. Repeating that logic in every renderer would produce inconsistent result durations, countdowns, and reconnect behavior.

Add a presentation hook above the existing `useChallengeChatState("overlay")` transport hook:

```tsx
const overlay = useOverlayPresentation();
```

The hook should return a discriminated `moment`:

```ts
type OverlayMoment =
  | { type: "hidden" }
  | {
      type: "submissions_opened";
      visibleUntil: string;
    }
  | {
      type: "voting";
      entries: VoteEntry[];
      winnersCount: number;
      endsAt: string;
    }
  | {
      type: "vote_result";
      selected: SelectedChallenge[];
      visibleUntil: string;
    }
  | {
      type: "challenge_starting";
      challenge: PublicChallenge;
      startsAt: string;
    }
  | {
      type: "challenge_active";
      challenge: PublicChallenge;
      endsAt: string | null;
      attemptsUsed: number;
    }
  | {
      type: "challenge_result";
      winner: "streamer" | "chat";
      challenge: PublicChallenge;
      points: number;
      visibleUntil: string;
    }
  | {
      type: "session_result";
      winner: "streamer" | "chat" | null;
      streamerScore: number;
      chatScore: number;
      visibleUntil: string;
    };
```

The final contract should also cover generic framework runs. Keep framework-specific metric and presentation data inside the relevant moment instead of asking a renderer to join several state objects.

The presentation layer owns:

- WebSocket state and recovery polling
- Channel scoping
- Show-moment priority
- Server-time alignment
- Local countdown animation
- Timed result visibility
- Reconnect behavior
- Reduced-motion behavior
- Transparent page setup
- Fallback to the default renderer

Continue to derive timers from server timestamps. Do not add per-second writes to the Worker.

## Renderer component API

A renderer receives only the normalized moment and its validated configuration:

```tsx
export function MyStreamOverlay({
  moment,
  config,
}: OverlayComponentProps) {
  switch (moment.type) {
    case "hidden":
      return null;
    case "voting":
      return <VotingCard moment={moment} config={config} />;
    case "challenge_active":
      return <ChallengeHud moment={moment} config={config} />;
    case "challenge_result":
      return <Result moment={moment} config={config} />;
    default:
      return <DefaultMoment moment={moment} config={config} />;
  }
}
```

The raw overlay state hook can remain available for advanced repository-owned renderers. The normalized presentation hook should be the documented default.

## Channel storage and public projection

Add a renderer selection and configuration to each Channel:

```ts
interface ChannelOverlaySettings {
  rendererId: string;
  config: Record<string, string | number | boolean | null>;
}
```

The Worker validates the configuration against the registered renderer's setting declarations before saving it. Only the owner may change these settings.

The public projection includes the selected renderer and sanitized configuration:

```ts
overlay: {
  rendererId: "my-stream-overlay",
  config: {
    primary: "#7c5cff",
    streamerLabel: "Dylan",
    motion: "full",
  },
}
```

If the renderer is missing or its configuration is invalid, `/overlay` falls back to the default built-in renderer.

The current public projection does not have enough event timing information for transient announcements. A later framework change should add server-owned timestamps or presentation cues for events such as submissions opening, a vote closing, a round resolving, and a session completing. This prevents results from remaining visible indefinitely and lets a renderer recover correctly after reconnecting.

## Branding settings

The Branding page should show:

- A gallery of registered renderers
- A safe preview for every show moment
- A generated settings form based on the selected manifest
- Reset-to-default controls
- Save and preview actions
- A clear fallback warning when a custom renderer is unavailable

Use a fixed set of setting types such as `color`, `text`, `number`, `boolean`, `select`, `asset`, and `placement`. Both the settings interface and the Worker should consume the same declarations.

## Custom-renderer workflow

A developer should be able to:

1. Run a scaffold command such as `npm run overlay:create my-stream-overlay`.
2. Implement the generated React component and styles.
3. Render every required `OverlayMoment`.
4. Preview each state in Overlay Studio without changing live state.
5. Run renderer validation, tests, and the production build.
6. Deploy the updated Worker.
7. Select the registered renderer from Branding settings.

The Channel's OBS URL remains unchanged throughout this process.

## Security boundaries

- Overlay clients receive public projections only.
- Renderers never receive owner passwords, moderator data, session cookies, setup codes, invitation tokens, or integration tokens.
- Runtime configuration cannot evaluate JavaScript or load an arbitrary component URL.
- Developer-authored React and CSS are trusted repository code and require a new deployment.
- Third-party renderers, if supported later, must be reviewed and compiled into the deployment rather than uploaded as executable bundles.
- Assets must continue through the existing validated upload path and size and media-type checks.
- Renderers do not mutate session state. Integrations report facts, and the Worker remains responsible for validation, timers, scoring, idempotency, and resolution.

## Implementation sequence

1. Add server-owned presentation timestamps or cue records to the public projection.
2. Define `OverlayMoment` and implement `useOverlayPresentation` against the existing public state hook.
3. Extract the current OBS renderer from `src/App.tsx` into the first registered preset.
4. Add the registry, default fallback, and Channel renderer selection.
5. Add validated renderer configuration and the generated Branding form.
6. Update Overlay Studio to preview every registered renderer and required moment.
7. Add a custom-renderer scaffold and validation command.
8. Add tests for registry validity, public-data boundaries, every required moment, missing-renderer fallback, desktop output, and narrow-width output.

Keep the repository as one deployable Cloudflare Worker throughout this work.

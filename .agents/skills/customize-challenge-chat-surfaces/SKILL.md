---
name: customize-challenge-chat-surfaces
description: Redesign or rebrand the Challenge.chat creator control panel, OBS overlay, or both while preserving the headless live engine and transport contracts.
---

# Customize Challenge.chat surfaces

Read `AGENTS.md` and `docs/framework.md` before editing.

Determine whether the request is a token/theme change, a layout/component change, or a completely new surface shell.

- For colors and shape, extend or apply the contract in `shared/contracts.ts` and mapping in `src/framework/theme.ts`.
- For a full redesign, compose the app from `src/creator.tsx`. Consume `useChallengeChatState` for a read-only overlay or `useChallengeChatController` for an administrative surface.
- Keep overlay output limited to public display data. Do not expose secrets, integration tokens, moderation notes, or raw provider payloads.
- Preserve `/overlay` as a transparent OBS-compatible page unless the user explicitly requests a different route.
- Keep control-panel and overlay presentation independently replaceable. Shared brand primitives are fine; do not make either surface depend on the other's component tree.
- Reuse server timestamps for timers and animate countdowns locally. Do not add per-second API writes.

Verify `npm test` and `npm run build`. For visual changes, inspect the dashboard and every state in `/overlay-demo` at desktop and narrow widths.

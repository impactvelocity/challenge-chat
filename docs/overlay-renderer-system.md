# Overlay renderer system

Status: implemented. The former proposal in this file has been superseded by the overlay SDK and theme registry in [`src/overlay/README.md`](../src/overlay/README.md).

## Production flow

```text
Worker public projection + live-run projection
                    ↓
        src/overlay/sources/live.ts
                    ↓
 OverlayProvider → normalized snapshot → OverlayRenderer
                    ↓
     registered channel theme at /overlay?channel=ID
```

- `/overlay?channel=ID` is the transparent public OBS browser source.
- `/overlay/studio?channel=ID` is the authenticated design/test surface. Its Game and Events tabs use the mock source and never mutate a real session.
- Theme selection, primitive per-theme settings, and element visibility are stored per Channel in D1 and included in the public projection.
- The Worker validates IDs, value types, entry counts, and payload size. React theme schemas resolve the specific defaults used by a renderer.
- Unknown theme IDs fall back to the first registered theme, Broadcast.
- Public clients never receive owner secrets, session cookies, invite tokens, integration tokens, or administrative challenge state.

## Adding a theme

1. Add the theme folder under `src/overlay/themes/` using the SDK contracts.
2. Register it in `src/overlay/themes/index.ts`.
3. Keep its ID stable and its settings declarative; do not evaluate runtime JavaScript, HTML, or CSS from stored configuration.
4. Exercise its scenes and controls in `/overlay/studio`, then run `npm test` and `npm run build`.

Setup, Settings → Theme, the studio, and the live overlay all discover the same registry, so no route-specific theme list should be added.

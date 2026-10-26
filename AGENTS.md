# Challenge.chat framework boundaries

Challenge.chat is an API-first live challenge framework with two replaceable reference surfaces: the creator control panel and the OBS overlay.

## Safe creator customization

- Use `src/creator.tsx` as the application composition entrypoint.
- Use `src/framework/use-challenge-chat.ts` for live state and control actions.
- Use `src/framework/theme.ts` for the default surface token mapping.
- Add game/service adapters outside the engine and publish normalized events through `src/framework/client.ts` or `/api/v1/runs/:id/events`.
- Treat `shared/framework.ts` and `shared/engine.ts` as versioned framework contracts. Change them only when adding framework capabilities, not when restyling a creator deployment.

## Invariants

- Integrations report facts; they never update an overlay directly.
- The server owns run status, metric validation, timers, idempotency, and resolution.
- Overlay clients receive public projections rather than administrative state.
- Owner and moderator permissions are enforced in the Worker; hiding a control in React is not authorization.
- Every data action requires a ChannelScope resolved from D1 and checked against moderator membership. Client-provided IDs must never bypass Channel/session boundaries.
- Preserve the channel query parameter in API calls, WebSockets, and OBS links. Integration tokens are Channel-specific; the legacy environment token covers only the default Channel.
- Keep owner passwords, setup codes, moderator invite tokens, integration tokens, and session cookies out of overlay projections and client bundles.
- Do not add arbitrary runtime JavaScript evaluation to rules or themes.
- New event kinds and rule types require engine tests.
- Keep the repository as one deployable Cloudflare Worker even when code is organized into logical packages.

Run `npm test` and `npm run build` after framework or surface changes.

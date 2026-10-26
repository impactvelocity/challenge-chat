---
name: add-challenge-chat-integration
description: Add a game, Twitch, webhook, local-helper, or service adapter that reports normalized events to the Challenge.chat engine.
---

# Add a Challenge.chat integration

Read `AGENTS.md`, `docs/framework.md`, and the schemas in `shared/framework.ts`.

An integration reports facts. It must not write database rows, determine the final run result, or communicate with an overlay directly.

Map provider-specific payloads to the smallest existing normalized event, normally `metric.incremented` or `metric.set`. Use `src/framework/client.ts` or `POST /api/v1/runs/:runId/events` and provide:

- a stable `source` name;
- an idempotency key derived from the provider event, match, or sequence identifier;
- the provider occurrence timestamp when available;
- only the normalized fields required by the event contract.

Keep secrets on the server or in a local helper. Do not place provider credentials in client bundles or overlay URLs. Validate webhook authenticity before publishing events.

Add fixtures covering retries, malformed payloads, an inactive run, and the happy path. Add a new core event or rule type only when the provider cannot be represented by the existing vocabulary, and accompany that framework change with engine tests.

Verify `npm test` and `npm run build`.

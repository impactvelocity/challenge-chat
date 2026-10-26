# HTTP API

Use the board API to operate a show from a trusted automation client. Use the separate framework API for metric-based game runs. Both run on the same Worker, but accept different credentials.

## Base URL, board scope, and authentication

Copy the deployment origin and board ID from Settings. Keep `?channel=BOARD_ID` on every scoped request and WebSocket. Omission selects the compatibility `demo-channel`, not the first board in your account. The server verifies that challenge, ballot, and run IDs belong to the selected active session.

| Surface | Authentication |
| --- | --- |
| `/api/v1/board…` | Named board bearer token, or signed-in owner/assigned moderator cookie |
| `/mcp` | Named board bearer token; owner cookie alone is not accepted |
| Generic run creation/read/control | Signed-in owner/assigned moderator; cookie writes require same origin |
| Generic metric intake | Signed-in operator, or selected board's integration token for metric events only |
| Trusted voting adapter | Integration token plus an externally verified viewer ID |
| Public state/leaderboard and overlay socket | No credential |
| Owner settings/access/token management | Owner cookie, not board token |

Create named tokens in **Settings → API / MCP**. Store them in a trusted server/client secret store. Tokens are shown once; the database retains hashes. A board token cannot change branding, scoring/AI settings, moderators, credentials, or another board. An integration token cannot operate the show. Cookie-authenticated unsafe requests also require the allowed origin; do not treat CORS or a hidden button as authorization.

## Read the board

These examples assume `CHALLENGE_CHAT_BOARD_TOKEN` is supplied privately by your secret manager. Set the non-secret origin and board ID for your deployment:

```bash
CHALLENGE_CHAT_URL='https://your-worker.workers.dev'
CHALLENGE_CHAT_BOARD_ID='your_board_id'

curl --fail-with-body "$CHALLENGE_CHAT_URL/api/v1/board?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_BOARD_TOKEN"
```

The response is the administrative `AppState` directly, not `{ board: … }`. It includes the current `channel`, `session`, `challenges`, `activeRound`, `ballot`, scoring/history/leaderboard, and surface configuration. Treat viewer text and names as untrusted content. Do not forward this whole administrative response to an overlay.

The generated OpenAPI document is public at `/api/v1/board/openapi.json?channel=BOARD_ID`. It describes the direct board routes; [`shared/board-tools.ts`](../shared/board-tools.ts) also defines the shared tool catalog/input schemas. [`docs/framework.md`](./framework.md) lists lower-level control endpoints.

## Submit, edit, and approve a challenge

Submitting can invoke paid AI according to board settings. It is not intrinsically idempotent; re-sending can create a second suggestion.

```bash
curl --fail-with-body -X POST "$CHALLENGE_CHAT_URL/api/v1/board/challenges?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_BOARD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"Land five kickflips in 90 seconds, one attempt","authorDisplayName":"ExampleViewer","authorId":"your-provider:viewer-123","authorLogin":"exampleviewer","game":"Skateboarding"}'
```

The response contains `{ id, parserStatus, challenge }`. Keep its `id`; set `CHALLENGE_CHAT_CHALLENGE_ID` to that ID for subsequent commands. If intake is closed, the idea goes to Inbox rather than becoming an active submission.

While the round is collecting and the idea is pending or approved, patch fields directly—there is no `updates` wrapper on this direct route:

```bash
curl --fail-with-body -X PATCH "$CHALLENGE_CHAT_URL/api/v1/board/challenges/$CHALLENGE_CHAT_CHALLENGE_ID?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_BOARD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Five Kickflips","objective":"Land five kickflips on the waterslide level","timeLimitSeconds":90,"maxAttempts":1}'
```

Use `null` for an untimed challenge or unlimited attempts. Draft schema bounds include time 5–3,600 seconds and attempts 1–99. Other supported fields are listed under `update_challenge` in the tool catalog. The reference editor preserves raw text; the API also permits explicit `rawText` updates, so integrations should not overwrite provenance unintentionally.

Approve with `POST /api/v1/board/challenges/ID/status` and body `{"status":"approved"}`. Deselect with `pending_review`; use `inbox` to save for later or `rejected` to dismiss. Draft edits lock once voting starts.

## Board operations

All paths below are relative to the origin and need the board query parameter. Send JSON for bodies shown; use current IDs from a fresh board read.

| Method and path | JSON body / behavior |
| --- | --- |
| `PATCH /api/v1/board/submissions` | `{"open":true}`; pause with false |
| `POST /api/v1/board/challenges` | Submission fields above |
| `PATCH /api/v1/board/challenges/ID` | Partial draft fields |
| `POST /api/v1/board/challenges/ID/status` | `{"status":"approved"}` or allowed status |
| `POST /api/v1/board/challenges/ID/start` | Starts an approved/queued challenge when phase permits; returns `roundId` |
| `POST /api/v1/board/challenges/ID/pause` | `{"paused":true}`; false resumes |
| `POST /api/v1/board/challenges/ID/attempt` | `{"delta":1}` or -1 |
| `POST /api/v1/board/challenges/ID/resolve` | `{"result":"streamer_won"}`; also `chat_won`, `skipped`, `voided` |
| `POST /api/v1/board/ballots` | `{"challengeIds":["idea-a","idea-b","idea-c"],"durationSeconds":60,"winnersCount":2}` |
| `POST /api/v1/board/ballots/ID/close` | Returns `winnerIds`, `roundName`, and `namingStatus` |
| `PATCH /api/v1/board/session/name` | `{"name":"Knives Only"}`; 1–60 characters |
| `POST /api/v1/board/session/name/generate` | Generates/saves a title; requires AI titles enabled and a selected lineup |
| `POST /api/v1/board/session/complete` | Finalize a fully resolved round |
| `POST /api/v1/board/session/cancel` | Discard current contest, keep unfinished ideas in Inbox, replace session |
| `POST /api/v1/board/sessions` | Start the next round after completion |
| `POST /api/v1/board/tools/TOOL_NAME` | Same named tool/input contract as MCP and WebMCP |

For example, reopening voting has a named tool rather than its own direct route:

```bash
curl --fail-with-body -X POST "$CHALLENGE_CHAT_URL/api/v1/board/tools/reopen_vote?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_BOARD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"durationSeconds":60}'
```

On the named `update_challenge` tool, the body **does** use `{"challengeId":"…","updates":{…}}`. Use the tool's schema, not the direct-route body, when calling `/tools/…` or MCP.

Ballots accept 2–10 unique IDs, subject to the board shortlist limit. At least one candidate must lose; selected count is bounded below the actual shortlist length. Duration is 10–900 seconds. The server controls voting allowance, deadline enforcement, and scope. Board automation does not gain a general viewer-impersonation voting endpoint.

## Public reads and WebSockets

| Endpoint | Returns |
| --- | --- |
| `GET /api/health` | Service liveness, not a full database/AI/Twitch readiness test |
| `GET /api/v1/capabilities` | Framework version, supported metrics/rules/transports |
| `GET /api/public/state?channel=ID` | `PublicOverlayState` |
| `GET /api/public/leaderboard?channel=ID` | `{ leaderboard: […] }` |
| `GET /api/v1/live/socket?scope=overlay&channel=ID` | Public WebSocket upgrade |
| `GET /api/v1/live/socket?scope=admin&channel=ID` | Cookie-authenticated administrative WebSocket upgrade |

WebSocket messages include `state.changed` (admin only), `overlay.changed` (public scope), `framework.run.changed`, and `integration.moment` (public Twitch presentation moments). A plain `ping` receives `pong`. These are projections/hints, not a complete durable event log. Use the supplied React transports where possible and re-bootstrap on reconnect. See [Durable Object flow](./durable-objects.md).

## Generic framework runs

Operators create a run with `POST /api/v1/runs` and body `{ "definition": … }`, then read `GET /api/v1/runs/live`. Both require an authenticated operator session; **a board API token is not a generic-run control token**. The browser's [`frameworkClient`](../src/framework/client.ts) wraps these cookie-authenticated calls.

Definitions use versioned schemas, typed metrics, declarative rules, countdown/time limits, and public presentation hints. Start from [`src/examples/kill-challenge.ts`](../src/examples/kill-challenge.ts). Only one countdown/active/paused run may exist per session.

A trusted helper with `CHALLENGE_CHAT_INTEGRATION_TOKEN` can publish metric facts to an existing run:

```bash
curl --fail-with-body -X POST "$CHALLENGE_CHAT_URL/api/v1/runs/$CHALLENGE_CHAT_RUN_ID/events?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_INTEGRATION_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"source":"your-game","idempotencyKey":"your-game:enemy-123","event":{"type":"metric.incremented","metric":"kills","by":1}}'
```

The response includes `{ run, projection, duplicate }`. Retry an accepted provider event with the same source/key: `duplicate: true` means it was not applied again. Keep keys stable; random retry keys defeat duplicate protection. Optional `occurredAt` does not let a late event override a server deadline.

Integration tokens permit only `metric.incremented` and `metric.set`. Operator events can also pause/resume/resolve a generic run; `run.started` and `timer.expired` remain engine-owned. Event idempotency is not a guarantee for unrelated show/settings endpoints. Full adapter guidance is in [integrations](./integrations.md).

A verified chat backend can use `POST /api/ballots/ID/vote?channel=ID` with the integration bearer and `{"challengeId":"…","voterId":"provider:verified-id"}`. Verify viewer identity in that trusted backend first. Never expose this token or trust a browser-provided viewer ID directly.

## Errors, retries, and side effects

Ordinary HTTP failures return `{ "error": "…" }`. Common statuses are 400 for invalid input/operation, 401 for missing credentials, 403 for forbidden scope/action/origin, 404 for absent scoped data, and 409 for some state conflicts. Not every invalid lifecycle operation uses 409; inspect the body. MCP wraps tool failures differently; see [MCP](./mcp.md).

Read-only calls can be retried. Before retrying a consequential write after a network failure, read current state: the server may have committed despite a lost response. Metric intake has explicit envelope idempotency; challenge creation and AI naming do not offer general request-key idempotency. Never blanket-retry every mutation or paid naming request.

Product writes commit in D1 and schedule projection publication with `waitUntil`; their HTTP response and WebSocket fan-out are not one atomic transaction. A successful write may arrive before its overlay update. Recover by reading current state/reconnecting rather than issuing the write again.

# MCP and WebMCP

Operate the board through the same tool catalog from a remote Model Context Protocol (MCP) client or a supporting browser. The server still owns permissions, lifecycle validation, and side effects.

## Connect a remote MCP client

1. Select the board and open **Settings → API / MCP** as the owner.
2. Create a named board token for that client and copy it once into its private credential store.
3. Add a **Streamable HTTP** MCP server using the copied URL, `/mcp?channel=BOARD_ID`.
4. Configure `Authorization: Bearer your_board_token` using the client's secret/header support. Do not put the token in the URL.
5. Discover tools and call `get_board` before attempting changes.

Client configuration formats vary. The required connection fields are the HTTPS MCP URL, Streamable HTTP transport, and bearer header. This implementation does not provide an OAuth registration/login flow for remote MCP clients, an SSE GET stream, or a stdio process. If your client cannot securely send the header, do not work around it with a public token-bearing URL.

Remote MCP requires a board token even when your browser is signed in. It cannot change settings/access or control arbitrary boards. Use a separate token per automation so you can revoke one client independently.

## Inspect the protocol over HTTP

These shell examples use the origin/board variables from the [API guide](./api.md#read-the-board) and a privately supplied `CHALLENGE_CHAT_BOARD_TOKEN`. They only discover/read; do not substitute consequential tools on a live board without intending the action.

Initialize a supported 2025 client session:

```bash
curl --fail-with-body "$CHALLENGE_CHAT_URL/mcp?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_BOARD_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"your-client","version":"1.0.0"}}}'
```

List available tools:

```bash
curl --fail-with-body "$CHALLENGE_CHAT_URL/mcp?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_BOARD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Read the board:

```bash
curl --fail-with-body "$CHALLENGE_CHAT_URL/mcp?channel=$CHALLENGE_CHAT_BOARD_ID" \
  -H "Authorization: Bearer $CHALLENGE_CHAT_BOARD_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_board","arguments":{}}}'
```

The server is stateless: it does not issue/require a persistent `Mcp-Session-Id`. Its implementation accepts `initialize` for versions `2025-03-26`, `2025-06-18`, and `2025-11-25`, and also implements the `2026-07-28` discovery path via `server/discover` / `MCP-Protocol-Version`. These are repository implementation details, not a claim of compatibility with every MCP client/version. See [`worker/mcp.ts`](../worker/mcp.ts).

Requests use HTTP POST with JSON-RPC 2.0 and `Content-Type: application/json`. Notifications without an ID receive 202. Tool success includes text content, `structuredContent`, and `isError: false`; tool failure can be HTTP 200 with `isError: true`. Check the tool result, not only HTTP status. Unknown methods/tools return JSON-RPC errors; authentication failure occurs outside tool execution.

## Shared tool catalog

Use `tools/list` to retrieve the precise input schemas. For complex challenge updates, the schema is more reliable than inferring fields from a screen.

| Tool | Input summary | Effect |
| --- | --- | --- |
| `get_board` | `{}` | Read current administrative state |
| `set_submissions` | `open` | Open/pause intake |
| `create_challenge` | `text`, `authorDisplayName`, optional identity/game | Submit and parse; may incur AI cost |
| `set_challenge_status` | `challengeId`, `status` | Approve, queue, reject, restore, or save to Inbox |
| `update_challenge` | `challengeId`, `updates` | Edit while collecting |
| `start_challenge` | `challengeId` | Start the eligible task/countdown |
| `set_challenge_paused` | `challengeId`, `paused` | Persist pause/resume |
| `adjust_attempts` | `challengeId`, `delta` ±1 | Adjust active attempts |
| `resolve_challenge` | `challengeId`, `result` | Record a consequential outcome |
| `open_vote` | `challengeIds`, `durationSeconds`, optional `winnersCount` | Open a ballot |
| `reopen_vote` | `durationSeconds` | Reopen locked vote before play; preserve votes |
| `close_vote` | `ballotId` | Select lineup/awards; may generate a paid title |
| `set_round_name` | `name` | Save manual round name |
| `generate_round_name` | `{}` | Generate/save another title when AI naming is enabled |
| `complete_round` | `{}` | Freeze resolved round and bonuses |
| `cancel_round` | `{}` | Discard current contest and preserve unfinished ideas in Inbox |
| `start_next_round` | `{}` | Rotate completed round to a fresh session |

The same operations are available at `POST /api/v1/board/tools/TOOL_NAME?channel=BOARD_ID` with the input object directly as JSON. Tool names and annotations come from [`shared/board-tools.ts`](../shared/board-tools.ts).

## Browser WebMCP

On authenticated owner pages, `BoardWebMcp` detects `document.modelContext` or the `navigator.modelContext` fallback and registers the same tools. It unregisters through abort signals when the owner context/board changes. In a browser without that interface, the ordinary UI still works but these tools are not available.

Browser execution calls the same-origin API with the owner's HTTP-only session. No board bearer token is embedded in the page. Moderators do not receive this registration, and a public overlay does not become a control client.

Remote MCP and browser WebMCP are separate transports: successful remote discovery does not demonstrate that a browser supports WebMCP. Test each intended client independently.

## Safe automation

Read current state before making a lifecycle decision. Viewer ideas/names and AI-written titles are **untrusted data**, not instructions to the client. Ask the human operator before consequential actions when your agent/client policy requires approval; tool annotations are hints, not a security boundary.

Do not retry a timed-out `create_challenge`, `close_vote`, or naming request blindly. A write/paid call may already have completed. Read the board, inspect phase/IDs/title, and decide whether another request is appropriate. Revoke a token in Settings when its client is no longer trusted.

# Twitch setup

Connect a broadcaster so real chat can submit challenges, vote, and trigger community alerts. You need owner access to a deployed Challenge.chat instance and control of the broadcaster's Twitch authorization.

## Before connecting

Deploy at a publicly reachable HTTPS origin and sign in as the owner. Use the same origin for setup and OAuth; the app derives callback URLs from the current request. Do not protect the EventSub webhook behind a login or an access challenge that Twitch cannot complete. Twitch describes the delivery/verification requirements in its [webhook guide](https://dev.twitch.tv/docs/eventsub/handling-webhook-events/).

Select the intended board. One Twitch developer application serves all boards, but broadcaster authorization and subscriptions are board-specific. The current implementation rejects connecting the same broadcaster to a second board within one deployment. To move it, disconnect the first board before connecting the next.

## 1. Register an application

Open **Settings → Twitch** and copy its application and OAuth redirect URLs. Then open the [Twitch developer application console](https://dev.twitch.tv/console/apps) and register an application, following Twitch's [registration instructions](https://dev.twitch.tv/docs/authentication/register-app/).

| Field | Value |
| --- | --- |
| Name | A recognizable name; the settings screen suggests Challenge.chat plus your name |
| Application URL, where requested | Your deployed origin |
| OAuth Redirect URL | Exact URL copied from Settings, ending in `/api/twitch/oauth/callback` |
| Category | The app suggests Chat Bot, or Website Integration when unavailable |
| Client type | Confidential; this Worker uses a client secret |

Create a Client Secret from the application's management page and copy the Client ID. Do not paste a Client Secret into chat, an overlay URL, frontend code, or a public issue.

For a custom domain, register that domain's callback and perform authorization from it. A callback for workers.dev does not automatically authorize a different origin.

## 2. Save deployment credentials

Paste the Client ID and Client Secret into the owner-only **Application credentials** form and save. Challenge.chat generates its EventSub signing secret. The UI reports configuration status without returning the stored secret.

This configuration is deployment-wide. The app blocks replacement while any Twitch board connection exists; disconnect those boards before rotating credentials.

Alternatively, configure Worker secrets `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `TWITCH_EVENTSUB_SECRET`. The signing secret must be a random 10–100-character ASCII string. Saved D1 application values take precedence; Worker values are fallbacks, not a way to overwrite saved credentials. See [deployment](./deployment.md).

Current storage: the saved app Client Secret and signing secret are D1 strings without application-level encryption. OAuth access tokens are used during connection/validation, **not persisted by the current Twitch tables**. Do not assume a background refresh-token service exists. See [security](./security.md).

## 3. Authorize the broadcaster

Choose **Connect broadcaster**, sign in to the intended Twitch account, and grant access. The app requests these scopes, defined in [`shared/twitch.ts`](../shared/twitch.ts):

| Scope | Used for |
| --- | --- |
| `user:read:chat` | Chat message/notification intake |
| `user:bot`, `channel:bot` | Twitch bot authorization for the EventSub chat path |
| `moderator:read:followers` | Follower notifications |
| `bits:read` | Cheers |

The app does not request chat-send permission or reply to commands in chat. Changing the login text in General settings does not change this authorized identity.

OAuth state is one-use, board-bound, and expires after ten minutes. If the page is stale or the link has already been used, start Connect again.

## 4. Check the listeners

The Worker registers four webhook subscriptions at `/api/twitch/eventsub`:

| Subscription | Version | App behavior |
| --- | --- | --- |
| `channel.chat.message` | 1 | Normalize `!challenge` and `!vote` commands |
| `channel.chat.notification` | 1 | Normalize supported subscriptions, gifts, and raids |
| `channel.follow` | 2 | Public follow moment |
| `channel.cheer` | 1 | Public cheer moment |

The panel shows connecting until all required listeners are enabled. It also reports the last event/error. Check each listener rather than treating the OAuth return alone as proof of working delivery.

The Worker verifies the raw-body HMAC, timestamp, subscription ID/type, and broadcaster mapping. It rejects stale messages and tracks provider message IDs to avoid processing ordinary retries twice. Only normalized public moments—not raw Twitch payloads or credentials—reach overlay sockets.

## 5. Test real chat

Use a dedicated test board and review its AI switches first.

1. Open submissions in the control room.
2. Send `!challenge Do five kickflips in 90 seconds, one attempt` from real Twitch chat.
3. Confirm the idea appears with viewer attribution. Close intake and send another idea; it should enter Inbox.
4. Approve a shortlist and open a vote.
5. Send `!vote 1`, then another distinct choice up to the allowance. Repeat a choice and confirm it does not add another vote.
6. Close voting and check the selected lineup in the panel and OBS.
7. Enable an Alerts-capable element and test community moments when suitable real activity is available. Do not purchase subscriptions or Bits solely to complete a routine deployment check.

Commands are case-insensitive. `!challenge` requires text and stores at most 500 characters. `!vote` takes one integer position per command, from 1–10, corresponding to an entry in the active ballot. It uses Twitch's stable viewer ID, not an editable display name. Unknown chat is ignored and invalid votes do not receive a chat reply.

## Disconnect, reconnect, and rotate

Use **Disconnect** to remove this board's local connection and attempt to delete its subscriptions at Twitch. If external deletion fails, local removal still takes effect. Reconnect after resolving errors or revocations to recreate listeners; there is no unattended subscription-repair service in this implementation.

To rotate the shared app secret: disconnect every board, save replacement credentials, reconnect each broadcaster, then run a chat smoke test. For an origin/domain change, update Twitch's registered redirect URL and reconnect from the new origin.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Redirect mismatch | Copy the exact callback from Settings at the origin you actually use |
| Invalid/expired connection link | Restart Connect; OAuth state expires and cannot be reused |
| Broadcaster already connected | Disconnect its existing board in this deployment first |
| Connected but no challenge appears | Listener status, last error, correct broadcaster; also check Inbox when intake is closed |
| Vote appears ignored | Correct fixed ballot number, ballot deadline, duplicate choice, and viewer's distinct-vote allowance |
| Follow/sub/raid absent in OBS | Enable the appropriate element; transient alerts are not replayed after disconnect |
| Webhook rejected | Public HTTPS reachability, unmodified raw body, signing secret, timestamp, and stored subscription mapping |
| Credential replacement blocked | Disconnect all boards using the shared Twitch application |

The local Dev chat simulator tests product operations, not real OAuth/HMAC/Twitch delivery. Use [`integrations/twitch/eventsub.test.ts`](../integrations/twitch/eventsub.test.ts) and Worker tests for normalization/verification regressions, and a real deployed connection for the final check.

# Deploying Challenge.chat

This runbook deploys React assets and the API as one Cloudflare Worker. D1, R2, and Durable Objects are bindings of that Worker; there is no separate Node server or Pages deployment.

After publishing, follow [Twitch setup](./twitch-setup.md), [OBS setup](./obs-setup.md), and the [settings reference](./settings.md). See [the documentation index](./README.md) for development and API guides.

## Prerequisites

- Node.js 24+ and `npm ci` completed in the repository.
- A Cloudflare account with Workers, D1, and R2 available. Enable R2 in the account if needed.
- AI Gateway/Workers AI access and billing if using AI. The show remains usable without AI calls.
- A Twitch developer application if connecting real chat; configure it after deployment.

Review your account's current service limits and charges. This guide does not assume the workload will remain free.

## 1. Select the account and create resources

```bash
npx wrangler login
npx wrangler whoami
npx wrangler d1 create YOUR_DATABASE_NAME
npx wrangler r2 bucket create YOUR_BUCKET_NAME
```

Replace uppercase placeholders with your own names. Keep the database ID returned by the D1 command.

Edit [`wrangler.jsonc`](../wrangler.jsonc), especially `env.production`:

| Field | Set it to |
| --- | --- |
| `env.production.name` | Your Worker name; determines the initial workers.dev hostname |
| `env.production.d1_databases[0].database_name` | Your database name |
| `env.production.d1_databases[0].database_id` | Your database ID, not the repository's existing deployment ID |
| `env.production.r2_buckets[0].bucket_name` | Your bucket name |
| `env.production.vars.APP_MODE` | `live` |
| `env.production.vars.AI_GATEWAY_ID` | Your gateway ID if using AI |
| `env.production.vars.AI_MODEL` | A model supported by your gateway/binding setup |

Keep binding names `DB`, `ASSETS_BUCKET`, `LIVE_SESSIONS`, and `AI`, plus Durable Object class `LiveSessionCoordinator`. Preserve the Durable Object migration history. Wrangler creates the Durable Object namespace during deployment; do not create a D1 database for each board or round.

The top-level configuration is for local/demo use and has no fixed D1 ID. Production has explicit resources. If also deploying a separate demo, give it its own Worker name and resources rather than relying on shared defaults.

## 2. Build and migrate production

```bash
npm test
npm run build:production
npx wrangler d1 migrations apply DB --remote -c dist/worker/wrangler.json
```

The Vite plugin selects the environment during the build. `build:production` sets `CLOUDFLARE_ENV=production` and writes the resolved configuration to `dist/worker/wrangler.json`. Do not edit the generated file or append `--env production` to generated-config commands. Rebuild after changing source configuration. See [Cloudflare environments with Vite](https://developers.cloudflare.com/workers/vite-plugin/reference/cloudflare-environments/).

Migrations come from [`migrations/`](../migrations/). D1 tracks applied migrations; this is distinct from publishing Worker code. Check that the generated target is your intended database before migrating. See [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/).

## 3. Protect the first upload

Using your editor, create a private file outside the repository, such as `/absolute/private/path/challenge-chat.env`:

```dotenv
OWNER_PASSWORD=REPLACE_WITH_A_LONG_UNIQUE_PASSWORD
```

Use a password manager or cryptographically secure generator; the example is not a usable password. Restrict file access. Keep the password out of shell arguments, screenshots, Git, OBS URLs, and public logs.

Upload the password with the first version:

```bash
npx wrangler deploy -c dist/worker/wrangler.json --secrets-file /absolute/private/path/challenge-chat.env
```

Wrangler accepts JSON or dotenv files and preserves existing secrets omitted from the file. See [Cloudflare secret uploads](https://developers.cloudflare.com/workers/configuration/secrets/#upload-secrets-alongside-code).

`OWNER_PASSWORD` takes precedence over a D1-backed password. With no secret and no stored profile, the app exposes one-time browser setup. Do not publish that unclaimed screen to the open internet. Browser setup is suitable locally or behind an access restriction while the owner claims it.

Open the emitted HTTPS workers.dev URL, sign in, and create a board. Existing boards are retained across releases; signing in should take you to an accessible board rather than require another setup.

## 4. Configure the board

### AI and billing

The current production variables are `APP_MODE=live`, `AI_GATEWAY_ID=default`, and `AI_MODEL=openai/gpt-4.1-mini`. They select the gateway/model used by server-side `AI.run` calls. The Settings UI switches features per board; it does not provision gateways or accept provider credentials.

Create/select the matching gateway and configure [Unified Billing](https://developers.cloudflare.com/ai-gateway/features/unified-billing/) for the Cloudflare-managed provider path. Confirm access with a small real request. See [Workers AI binding methods](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/) for setup.

Parsing and AI-title switches currently default to on. Turn them off before accepting submissions if you do not want AI usage. Editing/naming remains available. Model errors fall back to deterministic parsing/naming, but successful requests can still incur charges. Gateway calls enable log collection; review text disclosure and retention before handling sensitive content. Local development also uses remote AI and can spend real credits.

### Twitch

1. Open **Settings → Twitch** and copy the application URL and exact OAuth Redirect URL for the deployed origin.
2. Register a confidential application in the Twitch developer console.
3. Save its Client ID and Client Secret in the owner-only form.
4. Choose **Connect broadcaster** and complete OAuth for the selected board.
5. Confirm connection, then send a real `!challenge …` and `!vote N` when those phases are open.

OAuth callback: `/api/twitch/oauth/callback`. EventSub webhook: `/api/twitch/eventsub`. If using a custom domain, configure that exact redirect URL in Twitch too.

The settings form stores global app credentials in D1 and generates the signing secret. Alternatively, provision Worker secrets `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, and `TWITCH_EVENTSUB_SECRET`; these are fallback app configuration when no saved D1 configuration exists, not an override for a saved one. The EventSub secret must be a random 10–100-character string. Broadcaster authorization remains board-specific.

### OBS and other clients

Copy the exact board overlay link from Settings. Add a 1920 × 1080 transparent Browser Source in OBS. Preserve `?channel=BOARD_ID` in API, MCP, socket, and overlay URLs. Names/slugs can change without changing the stable board ID.

Use **Settings → API** for named REST/MCP board tokens and board integration settings for a metric reporter token. They have different permissions; never embed either in OBS. The optional Worker secret `INTEGRATION_TOKEN` is only a legacy default-board fallback, superseded by a generated token for that board.

## Subsequent releases

```bash
npm test
npm run deploy:production
```

This runs production build → remote D1 migrations → deployment and retains existing secrets. Do not use `npm run deploy` for production: the older demo script builds the top-level configuration and deploys before migrating.

For CI, use a Cloudflare API token restricted to the required account/resources, stored in the CI secret manager, and the same build/migrate/deploy order. Do not commit an owner-password file to simplify CI.

## Online smoke test

Use a dedicated test board: these checks create records, scores, and potentially paid AI calls.

- Sign in, refresh, sign out, and sign in again. Confirm an existing board opens and a moderator cannot access an unassigned board.
- With AI off, submit ideas, edit text/time/attempt limits, approve/deselect, and set a manual round name.
- With funded AI on, submit a messy challenge, inspect parsed fields, generate a name, and regenerate it. Check gateway activity and fallback behavior.
- Open a ballot, send distinct real chat votes, retry one vote, and close voting. Check immediate pending feedback and no duplicate transition on repeated clicks.
- Start challenges; check countdown, compact active card, attempts, pause/resume, and results. Complete the round and start another without reloading OBS.
- Test elements, themes, community moments, and a metric run. Retry the same metric envelope and confirm no double increment.
- Check scores, Challenger awards, and history. Confirm settings changes do not alter old scores.
- Exercise a named board token via REST and MCP, revoke it, then confirm rejection. Check WebMCP in a supporting signed-in owner browser.
- Reload/disconnect/reconnect the overlay. Confirm current-round bootstrap, no stale metrics, and no private state.

## Security and backups

The Worker enforces owner/mod membership and board scope. Public overlays receive redacted state. Owner profiles use salted password hashes; session, invite, and generated API-token credentials are stored as hashes. Cookies are HTTP-only and same-origin writes are checked.

Saved Twitch app/signing secrets currently live in D1 **without application-level encryption**. Restrict Cloudflare/database access, treat backups as sensitive, and harden credential storage before a higher-security rollout. OAuth tokens are used transiently during connection/validation, not persisted by the current Twitch schema. See [security](./security.md) for credential and revocation details.

Back up D1 before risky schema changes and preserve R2 assets as needed. The current generic run and accepted-event markers are session-local DO data, cleared on session replacement, not a durable event archive. A D1 export alone does not capture an active generic run. A Worker-code rollback is not a database rollback; plan schema compatibility and recovery separately. Do not delete production resources or Durable Object migration history to fix a deployment.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Unknown database, binding, or account | `wrangler whoami`, production resource IDs, and whether the generated config came from `build:production` |
| Missing table | Apply pending migrations to `DB` using the production-generated config |
| Empty/wrong OBS board | Compare the exact `channel` in control, OBS, API, and socket URLs |
| Password change ignored | An existing `OWNER_PASSWORD` secret overrides the stored password |
| AI falls back | Feature switches, gateway ID, model access, billing, and Worker/gateway logs |
| No Twitch chat delivery | Exact HTTPS callback, broadcaster authorization, EventSub status, and intake/voting phase |
| Missing custom element | Register the theme, enable the element, match its outlet region, and implement the current scene |
| Local port occupied | Vite requires 127.0.0.1:5174; stop the conflicting server or intentionally change Vite config |

Inspect logs with `npx wrangler tail -c dist/worker/wrangler.json` after a production build. Avoid sharing request text, private links, or credentials from logs.

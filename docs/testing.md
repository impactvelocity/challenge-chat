# Testing and release checklist

Use automated tests for deterministic contracts, then rehearse real integrations on a dedicated test board. This checklist is a procedure, not a record that every scenario has already been executed against your deployment.

## Automated checks

```bash
npm test
npm run build
npm run build:production
```

The suite covers shared rules, real-schema SQLite product/auth workflows, API/MCP/WebMCP contracts, Twitch normalization/verification, parser fallback, generic-run transport, and SDK/theme behavior. Builds check types and bundle the single Worker/client deployment. They do not contact every real external service or demonstrate a working OBS/Twitch connection.

For new rules/events, add reducer/coordinator tests. For a changed draft/settings schema, test validation and persistence. For new adapters, test provider verification and duplicate IDs. For new themes, exercise data hooks/scenes as well as schema defaults.

## Prepare a rehearsal

Create a separate board so synthetic votes, challenge outcomes, and leaderboard awards do not pollute a live contest. Keep its ID in every route/request. Use one operator panel for auto-next tests. Turn AI off unless explicitly testing paid requests.

Studio simulates local gameplay but persists appearance changes. Settings → Dev creates real board suggestions/votes/runs and can make paid AI calls. Choose the correct tool before testing.

## Access and isolation

- Sign in, refresh, sign out, then sign in again. Existing completed boards should open instead of forcing new-board setup.
- Create a second board and verify its queue/history/scoring/OBS links are independent.
- Invite a moderator with a private one-use link; verify expiry/reuse rejection in tests and assigned-board access in rehearsal.
- Remove moderator membership and confirm API rejection/socket closure for that board, without assuming unrelated memberships are removed.
- Create/revoke a named API token and replace an integration token; confirm the old credentials fail.
- Open the public overlay without a session and inspect its responses for private/admin fields. The public-page toggle is not a substitute for access checks.

## Complete a show round

1. Open submissions. Send several ideas from chat or the Dev simulator.
2. Close intake and send another suggestion; find it in Inbox. Add it back while appropriate and verify seen/unseen behavior.
3. Edit pending and approved ideas: title/objective, untimed/timed, unlimited/limited attempts, and an existing target. Approve, deselect, and reapprove.
4. Open a ballot with more candidates than selected slots. Check fixed command numbers, distinct vote allowance, duplicate retries, deadline rejection, and deterministic ties.
5. Close voting. Check immediate loading/disabled feedback and no second transition from a repeated click. Verify losers return to Inbox and selected awards are not duplicated.
6. Reopen voting before play and confirm votes persist; close again and check awards/lineup.
7. Save a manual title. If enabled for this test, generate/regenerate and confirm current saved text/overlay behavior.
8. Start play. Check the 10-second countdown and compact active graphic, then timer/attempt values.
9. Pause/resume after countdown and confirm server/creator/overlay clocks agree. Test untimed and time-up displays; human outcome calls remain required for show challenges.
10. Award outcomes, advance/skip, cancel a local auto-next countdown, and complete all selected tasks. Confirm disabled Undo is not presented as a working rollback.
11. Inspect team bonuses, sweep conditions, Challenger awards, and recap. Change defaults and confirm historical totals do not change.
12. Start the next round without reloading OBS; confirm new state and no stale generic metrics. Separately rehearse **Cancel round** on disposable data.

Do not extrapolate one operator's pending-action lock into a global cross-client idempotency guarantee. If a network response is uncertain, read state before retrying a consequential mutation.

## AI checks

With both AI request paths off, submit/edit/name/vote/play and confirm no request is required. Then, with explicit billing permission, run a small real parse and naming/regeneration request. Inspect parser/generator status and gateway activity; configured status alone is not inference verification.

Test model failures with fixtures or an isolated environment and confirm usable deterministic fallback. Turning off challenge title writing alone must not be described as stopping AI parsing. Avoid paid repeat loops just to test a visual loading state. See [AI](./ai.md).

## Twitch and OBS checks

Authorize the intended broadcaster on the deployed HTTPS origin and inspect all listeners. Send real `!challenge` / `!vote` messages; the Dev simulator is not a webhook test. Check community moments when practical without purchasing activity solely for routine testing.

Add the real `/overlay?channel=ID` in OBS at 1920 × 1080. Verify transparency over gameplay, element availability, scene changes, both winners, round rollover, reconnect, and missing-data behavior. Do not use a mock Studio URL as proof of live delivery. See [Twitch](./twitch-setup.md) and [OBS](./obs-setup.md).

## API, MCP, and generic runs

- Discover the HTTP/OpenAPI surface and MCP tools, read the board, then perform bounded mutations on the test board.
- Confirm a board token cannot call owner settings or generic-run creation; an integration token cannot operate the show or submit privileged lifecycle events.
- Check MCP `isError`, not just HTTP 200. Test WebMCP separately in a supporting owner browser and confirm it is not registered for moderators.
- Start the example generic run, send public metrics, and verify an accepted retry returns `duplicate: true` with no second increment.
- Reject wrong boards/runs, unknown metrics, invalid types, countdown/paused changes, and late events. Exercise generic pause/resume and a timer-expiry rule with all browsers closed.
- Confirm a metric run does not silently award a reference-show challenge or create a permanent event archive.

## Release

Review [known limitations](../GAPS.md), verify the target Cloudflare account and production resource IDs, back up data as appropriate, then follow the [deployment runbook](./deployment.md). Migration and code deployment are not one rollback unit. Re-run a small online smoke test after publishing and record the deployed version and checks in your release process.

Never put credentials or private moderator links into screenshots, fixtures, logs, or a public test report.

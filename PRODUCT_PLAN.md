# Challenge.chat — Product and Build Plan

Status: implementation-ready draft  
Created: 2026-10-23  
Hackathon submission target: 2026-11-02 before 2:00 PM Pacific

## 1. Product summary

Challenge.chat turns spontaneous viewer dares into a structured live game show.

Chat proposes challenges, a streamer or moderator curates them, viewers vote, the streamer attempts the winner, and a referee records the result. The broadcast overlay makes every phase legible and gives the challenge author a moment of recognition.

The product is not primarily a challenge queue, a generic poll, or a way for viewers to control a game. Its core product is a repeatable performance loop:

```text
Propose -> Curate -> Vote -> Queue -> Attempt -> Verdict -> Score -> Repeat
```

Working pitch:

> Turn chat's best dares into live challenges. Chat sets the challenge, the streamer takes it on, and every attempt becomes a shared moment.

## 2. Product thesis

Long streams naturally contain quiet stretches. Strong streamers already create small games inside the game to restore tension: a difficult trick, a restricted loadout, a timed attempt, or a risky streak. Chat often contributes these ideas, but the interaction is informal and ephemeral.

Challenge.chat makes that behavior visible and repeatable without taking control away from the streamer.

The system succeeds when:

- chat feels it can influence the show;
- challenge authors receive meaningful recognition;
- moderators can act as producers and referees;
- the streamer performs rather than administers;
- a challenge can be launched in seconds or built into a larger hype moment;
- the audience always understands what is happening, what counts, and who won.

## 3. Goals and non-goals

### Goals

- Let viewers submit freeform challenges from Twitch chat.
- Convert messy challenge text into an editable structured draft.
- Let streamers and moderators approve, edit, queue, and start challenges quickly.
- Support both rapid-fire challenges and longer audience-voted events.
- Render every phase through an OBS browser-source overlay.
- Track a session-level Streamer vs. Chat score.
- Recognize challenge authors without rewarding impossible or unsafe proposals.
- Allow the overlay to match a creator's brand without giving uploaded themes control of product logic.
- Be demonstrable end-to-end on a real Twitch stream before the hackathon deadline.

### Non-goals for the hackathon MVP

- Automatic verification from game telemetry or computer vision.
- Direct control of the game.
- A public Twitch Extension release.
- Bits, payments, or a marketplace.
- Native Twitch badges.
- Cross-platform support beyond Twitch.
- Arbitrary uploaded JavaScript, HTML, or unrestricted CSS.
- Full automatic moderation with no human approval.

## 4. Primary users

### Streamer

Wants entertaining prompts without losing focus or control. During play, the streamer should need no more than four actions:

- start next;
- success;
- failure;
- skip.

### Moderator / producer

Reviews submissions, edits constraints, chooses finalists, operates votes, updates attempts, and issues verdicts. This is the ideal operator for a busy channel.

### Viewer / challenge author

Submits a challenge, sees their name associated with it, campaigns for votes, and receives recognition if the challenge is selected.

### General viewer

Votes on challenges, follows the active rules, celebrates or disputes the result, and contributes to the Chat team score.

## 5. Core operating modes

All modes use the same challenge data and lifecycle.

### Open Queue

- Chat submits challenges throughout the stream.
- Moderators quietly curate a ready queue.
- The streamer starts one whenever the timing feels right.
- Best default mode for a four-hour stream.

### Blitz

- Several approved challenges run in rapid succession.
- Voting is optional.
- Short timers or attempt limits are encouraged.
- The next queued challenge can start immediately from the result screen.

### Hype Round

- Suggestions open for a configurable period, typically 5–10 minutes.
- A moderator selects two or three finalists.
- Chat votes during a visible countdown.
- The winning challenge gets a full-screen introduction and elevated point value.

## 6. Challenge contract

The freeform challenge text remains authoritative. Structured metadata controls timers, counters, display, scoring, and clarity.

### Fields

- `rawText`: exactly what the viewer submitted.
- `title`: a short overlay-friendly name.
- `objective`: a clean, imperative description of the goal.
- `author`: Twitch user ID, login, and display name.
- `game`: optional game/category.
- `context`: optional level, map, match, run, location, or other scope.
- `targets`: optional countable goals.
- `constraints`: restrictions such as loadout, technique, movement, or location.
- `timeLimitSeconds`: optional clock limit.
- `maxAttempts`: optional attempt limit.
- `requiresStreak`: whether targets must be completed consecutively.
- `failureConditions`: explicit reasons an attempt or challenge fails.
- `difficulty`: easy, medium, hard, or ridiculous.
- `verificationMode`: moderator, streamer, or chat-review.
- `warnings`: ambiguity, safety, impossibility, or parsing notes.
- `needsReview`: always true when the parser is uncertain or flags a warning.

### Example

Input:

> do five kickflips in a row, one shot attempt, on the waterslide level, only have 90 seconds

Structured draft:

```json
{
  "schemaVersion": 1,
  "rawText": "do five kickflips in a row, one shot attempt, on the waterslide level, only have 90 seconds",
  "title": "Waterslide One-Shot",
  "objective": "Land five kickflips in a row",
  "game": null,
  "context": {
    "scope": "level",
    "label": "Waterslide"
  },
  "targets": [
    {
      "label": "Kickflips",
      "value": 5,
      "comparison": "at_least",
      "requiresStreak": true
    }
  ],
  "constraints": [],
  "timeLimitSeconds": 90,
  "maxAttempts": 1,
  "failureConditions": [],
  "difficulty": "hard",
  "verificationMode": "moderator",
  "warnings": [],
  "needsReview": false
}
```

When both time and attempts are present, the challenge ends when either limit is exhausted.

### Lifecycle

```text
PENDING_REVIEW
  -> APPROVED
  -> VOTING (optional)
  -> QUEUED
  -> ACTIVE
  -> RESOLVING
  -> STREAMER_WON | CHAT_WON | SKIPPED | VOIDED
```

Rejected proposals do not enter the playable lifecycle.

## 7. AI challenge parser

### Purpose

The parser turns unstructured chat language into a structured draft. It is an assistant to the moderator, not an authority.

It must never automatically approve, publish, start, or score a challenge.

### Endpoint

```http
POST /api/challenges/parse
```

Request:

```json
{
  "text": "do five kickflips in a row, one shot attempt, on the waterslide level, only have 90 seconds",
  "channelId": "twitch-channel-id",
  "game": "Skate",
  "defaults": {
    "verificationMode": "moderator"
  }
}
```

Response:

```json
{
  "challenge": {},
  "parser": {
    "status": "parsed",
    "confidence": "high"
  }
}
```

### Implementation rules

- Call the OpenAI API only from the server.
- Use the Responses API with Structured Outputs and a strict JSON Schema.
- Define the schema once in application code and derive both runtime validation and API schema from it.
- Treat every string from chat as untrusted user content.
- Preserve `rawText` so moderators can compare the interpretation with the original.
- Use `null` for fields not present in the request; do not invent constraints.
- Return warnings for ambiguity, conflicts, harmful requests, or likely impossibility.
- Validate the response again on the server before storing it.
- Handle refusals, timeouts, and incomplete responses explicitly.
- Fall back to a valid draft containing the raw text and empty metadata when parsing fails.
- Cache identical normalized text plus game context during a stream.
- Keep the model configurable through server environment settings rather than hard-coding it throughout the codebase.

Official reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

### Parser acceptance criteria

- Extract explicit time, attempts, counts, streaks, and locations.
- Never infer an unstated time, count, streak, or failure rule.
- Preserve unusual wording when normalization would change the meaning.
- Return a complete schema-valid object for ordinary requests.
- Produce an editable fallback draft during any API failure.
- Never expose an OpenAI API key to the browser or OBS overlay.

## 8. Refereeing and verdicts

### Default hierarchy

1. An authenticated moderator acts as referee.
2. If no moderator is operating, the streamer decides.
3. An optional chat review can resolve a disputed or entertaining edge case.

### Chat review

- Runs for approximately ten seconds.
- Shows `COUNTS` and `DOES NOT COUNT` options.
- One vote per Twitch user.
- The broadcaster can override the result.
- Disabled by default for safety-sensitive or subjective challenges.

### Actions during an active challenge

- increment or decrement attempt;
- pause/resume timer;
- record success;
- record failure;
- open chat review;
- skip or void with a reason.

## 9. Scoring and recognition

Two score systems avoid rewarding impossible challenges.

### Streamer vs. Chat

- Streamer completes the challenge: Streamer receives the round value.
- Streamer fails: Chat receives the round value.
- Default value is one point.
- Hype or high-difficulty rounds may be worth two or three points.
- Skipped, rejected, unsafe, or voided challenges award no team points.

### Challenge Creator XP

- Approved: +1 XP.
- Selected as a vote finalist: +2 XP.
- Won the vote and was played: +5 XP.
- Optional moderator-awarded entertainment bonus: +1–3 XP.
- No automatic bonus merely because the streamer failed.

### Recognition moments

- The author's tag appears on voting, active, and result screens.
- The result overlay spotlights the author.
- The bot posts the author and outcome in chat.
- The session recap names the top challenge creator.

### App-level achievements after MVP

- First Pick
- Crowd Favorite
- Challenge Architect
- Streak Breaker
- Boss Builder
- Streamer's Nemesis

These are Challenge.chat profile achievements, not native Twitch chat badges.

## 10. Product surfaces

### Streamer/mod dashboard

Recommended layout:

```text
Submission Inbox | Approved Queue | Live Control
```

Key behaviors:

- New chat submissions arrive in real time.
- Selecting a proposal shows raw text beside its structured draft.
- Metadata uses editable chips and small numeric fields.
- Approve, reject, queue, and start are one-click actions.
- A quick-add input lets the streamer create their own challenge and run the same parser.
- Presets can create common structures such as “three attempts,” “60-second sprint,” or “best of five.”
- Keyboard shortcuts support start, success, failure, and skip.

### Viewer input

MVP commands:

```text
!challenge <freeform challenge>
!vote 1
!vote 2
!vote 3
!score
!leaderboard
```

Controls:

- per-user submission cooldown;
- configurable follower/subscriber restrictions if the channel wants them;
- duplicate detection;
- maximum text length;
- streamer/mod approval before anything appears prominently on stream.

### OBS overlay

The overlay is a public read-only browser-source URL protected by a high-entropy channel token. It receives sanitized live state through SSE or WebSocket and never receives Twitch or OpenAI secrets.

Overlay states:

1. Idle / scoreboard.
2. Call for challenges.
3. Voting.
4. Queue preview.
5. Challenge introduction.
6. Active challenge.
7. Chat review.
8. Streamer win.
9. Chat win.
10. Session recap.

## 11. Overlay theming

The application owns the semantic layout, live data, accessibility, and state transitions. Themes control presentation.

### Theme levels

#### Level 1: Presets — MVP

Ship at least three visually distinct presets:

- Broadcast Minimal: restrained sports-broadcast styling.
- Arcade Clash: bold streamer-versus-chat presentation.
- Creator Neon: high-energy gaming visual treatment.

#### Level 2: Brand editor — MVP

Allow a streamer to customize:

- primary, secondary, accent, success, and failure colors;
- heading and body font from an approved local list;
- border radius, shadow intensity, and panel opacity;
- compact or cinematic density;
- screen position and safe-area margins;
- entrance/exit animation from an approved list;
- logo, background texture, and frame image uploads.

#### Level 3: Theme pack — after MVP

A portable theme manifest may reference uploaded, validated assets:

```json
{
  "name": "Creator Brand 2026",
  "base": "arcade-clash",
  "tokens": {
    "primary": "#6d3cff",
    "accent": "#f6ff00",
    "fontHeading": "Bebas Neue",
    "radius": 16
  },
  "assets": {
    "logo": "logo.webp",
    "frame": "frame.webp",
    "successEffect": "success.webm",
    "failureEffect": "failure.webm"
  },
  "motion": {
    "enter": "slam",
    "result": "burst"
  }
}
```

### Technical theming model

- Render one stable React component tree for every theme.
- Express brand values as CSS custom properties.
- Use named asset slots rather than arbitrary markup.
- Use a whitelist of motion primitives so state transitions remain reliable.
- Scope every theme beneath one overlay root.
- Store theme versions so an active stream cannot break when a draft theme changes.
- Provide a preview simulator for every overlay state.

### Upload safety

- Do not accept arbitrary JavaScript or HTML.
- Do not allow unrestricted CSS in the MVP.
- Accept only allowlisted image/video MIME types and strict size limits.
- Prefer raster image uploads initially; sanitize or defer SVG.
- Strip metadata and transcode uploaded images where practical.
- Keep uploaded assets on a separate asset origin or storage path.

An advanced custom-CSS layer can be explored later, but it requires sanitization, URL restrictions, size limits, and recovery tooling. It is not necessary to prove creator customization in the hackathon build.

## 12. Recommended technical architecture

### Stack

- TypeScript throughout.
- React + Vite for dashboard and overlay.
- Fastify or a similarly small Node server for OAuth, API routes, Twitch EventSub, and real-time state.
- PostgreSQL in deployment; an in-memory or local development adapter for rapid setup.
- Zod for shared schemas and request validation.
- Server-Sent Events for the read-only OBS overlay; WebSocket only where bidirectional live control is needed.
- Twitch EventSub WebSocket for chat during the initial single-channel build.
- Twitch Helix API for sending bot responses.

### Suggested repository layout

```text
apps/
  server/        OAuth, EventSub, API, realtime, parser
  web/           dashboard, onboarding, theme editor
  overlay/       OBS browser-source renderer and simulator
packages/
  contracts/     Zod schemas and shared TypeScript types
  theme/         theme tokens, manifests, and presets
  twitch/        Twitch API and EventSub adapter
```

For speed, these may initially be workspaces inside a single repository and deployed as one server plus static assets.

### Event flow

```text
Twitch Chat
  -> EventSub listener
  -> command parser and rate limits
  -> challenge parser endpoint
  -> pending proposal store
  -> moderator dashboard
  -> round state machine
  -> realtime event stream
  -> OBS overlay
```

### Core persistence

- channels and Twitch authorization;
- stream sessions;
- viewer identities and channel-scoped profiles;
- challenge proposals and parsed contracts;
- vote rounds and individual votes;
- challenge attempts and verdicts;
- score ledger and creator XP ledger;
- theme drafts, published theme versions, and asset references.

Prefer append-only score ledgers over mutable counters so results can be audited or corrected.

## 13. MVP scope

### P0 — required for submission

- Connect one Twitch broadcaster account.
- Receive `!challenge` messages through EventSub.
- Parse challenges into structured, editable drafts.
- Moderator/streamer inbox with approve, reject, edit, queue, and start.
- One-vote-per-user voting for two or three finalists.
- Active timer and attempt controls.
- Manual success, failure, skip, and void verdicts.
- Session Streamer vs. Chat score.
- Author recognition and Creator XP.
- OBS overlay covering idle, vote, intro, active, and result states.
- Three preset themes.
- Brand color/font controls and logo/frame upload.
- Reconnection recovery for an active round.
- Demo/simulator mode using fake chat and Twitch events.
- Clear README and one-command local startup after environment configuration.

### P1 — only after a reliable live test

- Ten-second chat review.
- Persistent creator leaderboard.
- Full session recap.
- Saved challenge templates and game packs.
- Streamer keyboard shortcuts.
- Theme export/import.
- Better duplicate clustering and AI warnings.

### P2 — post-hackathon

- Public Twitch Extension.
- Stream Deck integration.
- Channel Points and Bits integrations.
- Automatic clip markers and post-stream challenge reels.
- Game telemetry adapters.
- YouTube and Kick support.
- Seasons, richer achievements, and creator profiles.
- Theme marketplace or agency-designed brand packs.

## 14. MVP acceptance criteria

- A chat challenge appears in the dashboard within a few seconds.
- The parser extracts explicitly stated time, attempt, count, streak, and context fields.
- A moderator can correct any parsed field before approval.
- A vote accepts at most one choice from each Twitch user.
- The winning vote can be queued and started without re-entering data.
- Overlay state updates are visible in OBS without refreshing the browser source.
- The timer and attempts remain consistent across dashboard and overlay.
- A verdict updates the result screen, team score, author XP, and history exactly once.
- Reloading the dashboard or overlay restores the active round.
- Invalid or malicious chat content cannot inject HTML or scripts into the dashboard or overlay.
- Loss of OpenAI connectivity does not block manual challenge creation.
- No Twitch or OpenAI credentials are present in client bundles, URLs, logs, or repository history.

## 15. Success metrics

For the live pilot, record:

- challenges submitted per hour;
- percentage approved;
- percentage of approved challenges actually played;
- unique voters and vote participation rate;
- median time from streamer decision to active challenge;
- number of streamer actions required per round;
- completed challenges per hour;
- Streamer vs. Chat result balance;
- repeat challenge authors;
- qualitative streamer rating: energizing vs. distracting.

A healthy first test is not maximum submission volume. It is a smooth loop with multiple completed rounds and no loss of streamer focus.

## 16. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Streamer cognitive load | Moderator-first dashboard, four streamer actions, keyboard shortcuts later. |
| Unsafe, abusive, or impossible submissions | Human approval, warnings, cooldowns, blocklists, no automatic publication. |
| AI misinterprets a request | Raw text remains visible and authoritative; every field is editable. |
| AI outage or latency | Manual/fallback draft and non-blocking parsing workflow. |
| Users submit impossible challenges for points | Creator XP rewards selection and entertainment, not streamer failure. |
| Ambiguous result | Explicit failure rules, moderator referee, optional chat review. |
| Overlay breaks a stream | Stable renderer, versioned themes, preview simulator, reset-to-default control. |
| Custom theme introduces executable content | Tokens and asset slots only; no arbitrary JS/HTML/CSS in MVP. |
| Twitch Extension review misses deadline | Build around EventSub, chat, dashboard, and OBS browser source. |
| Live demo fails | Local simulator plus a prerecorded real Twitch test for the submission video. |

## 17. Ten-day build schedule

### October 23

- Lock product plan, repository structure, schemas, and development environment.
- Register the Twitch developer application and test account.

### October 24

- Implement Twitch OAuth and EventSub chat connection.
- Receive and persist `!challenge` submissions.

### October 25

- Implement the shared challenge schema and OpenAI parser endpoint.
- Build parser fixtures and fallback behavior.

### October 26

- Build submission inbox, edit form, approval, and queue.

### October 27

- Implement voting and the round state machine.
- Add idempotent score and XP ledgers.

### October 28

- Build all P0 overlay states and realtime updates.
- Add active timer and attempts.

### October 29

- Add three visual themes, brand tokens, logo/frame uploads, and state previewer.

### October 30

- Add reconnection recovery, simulator mode, tests, and operational diagnostics.

### October 31

- Run a real stream test with the target creator.
- Fix flow problems before adding optional features.

### November 1

- Final live demo capture.
- Finish README, setup instructions, project description, and video edit.

### November 2

- Verify repository from a clean environment.
- Submit by noon Pacific to preserve a two-hour buffer before the rules deadline.

## 18. Demo narrative

The submission video should show one complete round in under two minutes, leaving the remaining time for setup and Codex usage.

1. A viewer submits a messy challenge in Twitch chat.
2. The dashboard receives it and shows the structured interpretation.
3. A moderator corrects or approves it.
4. Chat votes between finalists.
5. The winning author's name appears in the introduction.
6. The streamer attempts the challenge while the overlay tracks time or attempts.
7. The moderator issues a verdict.
8. The result animation updates Streamer vs. Chat and author XP.
9. Briefly show the theme changing without affecting the live state.
10. End with the scoreboard and next challenge ready.

## 19. Decisions locked for the first build

- Twitch only.
- Chat + EventSub + OBS overlay; no dependency on Extension approval.
- Human approval and human verdicts.
- Freeform challenge text plus optional structured metadata.
- AI parsing creates drafts only.
- Streamer vs. Chat and Creator XP are separate systems.
- One stable overlay renderer with preset themes and safe brand customization.
- One live channel and one active stream session at a time for the hackathon MVP.


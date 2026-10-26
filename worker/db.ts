import {
  CHALLENGE_COUNTDOWN_SECONDS,
  ChallengeDraftSchema,
  DEFAULT_THEME,
  ThemeSchema,
  type AppState,
  type Ballot,
  type Challenge,
  type ChallengeDraft,
  type ContestSide,
  type SessionHistoryEntry,
  type SideStreaks,
  type Theme,
} from "../shared/contracts";
import { ARCADE_SCORING_RULES, CLASSIC_SCORING_RULES, parseScoringRules, type ScoringRules } from "../shared/scoring";
import { fallbackParseChallenge } from "./parser";
import { AuthError } from "./auth";
import type { ChannelScope } from "../shared/channels";
import {
  DEFAULT_OVERLAY_CONFIG,
  DEFAULT_SESSION_SETTINGS,
  OverlayConfigSchema,
  SessionSettingsSchema,
  type OverlayConfig,
  type SessionSettings,
} from "../shared/surface-config";

export const DEMO_CHANNEL_ID = "demo-channel";
export const DEMO_SESSION_ID = "demo-session";

interface ChallengeRow {
  id: string;
  author_id: string;
  author_login: string;
  author_display_name: string;
  raw_text: string;
  title: string;
  objective: string;
  game: string | null;
  context_json: string | null;
  targets_json: string;
  constraints_json: string;
  time_limit_seconds: number | null;
  max_attempts: number | null;
  failure_conditions_json: string;
  difficulty: Challenge["difficulty"];
  verification_mode: Challenge["verificationMode"];
  warnings_json: string;
  needs_review: number;
  status: Challenge["status"];
  round_value: number;
  parser_status: Challenge["parserStatus"];
  created_at: string;
  vote_count?: number;
}

interface SessionRow {
  id: string;
  name: string | null;
  status: "live" | "ended";
  mode: "open_queue" | "blitz" | "hype";
  streamer_score: number;
  chat_score: number;
  phase: AppState["session"]["phase"];
  submissions_open: number;
  scoring_rules_json: string;
  winner: ContestSide | null;
  sweep_winner: ContestSide | null;
  sweep_label: string | null;
  completed_at: string | null;
}

interface ChannelRow {
  id: string;
  display_name: string;
  broadcaster_login: string;
  setup_completed: number;
  theme_json: string;
  scoring_rules_json: string;
  overlay_config_json: string;
  session_settings_json: string;
}

interface RoundRow {
  id: string;
  challenge_id: string;
  status: "active" | "resolved";
  started_at: string;
  ends_at: string | null;
  attempts_used: number;
  result: "streamer_won" | "chat_won" | null;
}

interface BallotRow {
  id: string;
  status: "open" | "closed";
  ends_at: string;
  winners_count: number;
  votes_per_viewer: number;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function rowToChallenge(row: ChallengeRow, voteCount = 0): Challenge {
  return {
    id: row.id,
    schemaVersion: 1,
    authorId: row.author_id,
    authorLogin: row.author_login,
    authorDisplayName: row.author_display_name,
    rawText: row.raw_text,
    title: row.title,
    objective: row.objective,
    game: row.game,
    context: parseJson(row.context_json, null),
    targets: parseJson(row.targets_json, []),
    constraints: parseJson(row.constraints_json, []),
    timeLimitSeconds: row.time_limit_seconds,
    maxAttempts: row.max_attempts,
    failureConditions: parseJson(row.failure_conditions_json, []),
    difficulty: row.difficulty,
    verificationMode: row.verification_mode,
    warnings: parseJson(row.warnings_json, []),
    needsReview: Boolean(row.needs_review),
    status: row.status,
    roundValue: row.round_value,
    parserStatus: row.parser_status,
    createdAt: row.created_at,
    voteCount,
  };
}

function challengeInsertStatement(
  db: D1Database,
  scope: ChannelScope,
  draft: ChallengeDraft,
  options: {
    id: string;
    authorId: string;
    authorLogin: string;
    authorDisplayName: string;
    status: Challenge["status"];
    parserStatus: Challenge["parserStatus"];
    roundValue?: number;
  },
) {
  return db
    .prepare(
      `INSERT INTO challenges (
        id, channel_id, session_id, author_id, author_login, author_display_name,
        raw_text, title, objective, game, context_json, targets_json, constraints_json,
        time_limit_seconds, max_attempts, failure_conditions_json, difficulty,
        verification_mode, warnings_json, needs_review, status, round_value, parser_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      options.id,
      scope.channelId,
      scope.sessionId,
      options.authorId,
      options.authorLogin,
      options.authorDisplayName,
      draft.rawText,
      draft.title,
      draft.objective,
      draft.game,
      draft.context ? JSON.stringify(draft.context) : null,
      JSON.stringify(draft.targets),
      JSON.stringify(draft.constraints),
      draft.timeLimitSeconds,
      draft.maxAttempts,
      JSON.stringify(draft.failureConditions),
      draft.difficulty,
      draft.verificationMode,
      JSON.stringify(draft.warnings),
      draft.needsReview ? 1 : 0,
      options.status,
      options.roundValue ?? 1,
      options.parserStatus,
    );
}

export async function ensureDemoData(db: D1Database): Promise<void> {
  await db.batch([
    db
      .prepare(
        `INSERT OR IGNORE INTO channels (id, display_name, broadcaster_login, setup_completed, theme_json, scoring_rules_json)
         VALUES (?, ?, ?, 0, ?, ?)`,
      )
      .bind(DEMO_CHANNEL_ID, "Unconfigured board", "setup-pending-demo-channel", JSON.stringify(DEFAULT_THEME), JSON.stringify(ARCADE_SCORING_RULES)),
    db
      .prepare(
        `INSERT OR IGNORE INTO sessions (id, channel_id, status, mode, scoring_rules_json)
         VALUES (?, ?, 'live', 'open_queue', ?)`,
      )
      .bind(DEMO_SESSION_ID, DEMO_CHANNEL_ID, JSON.stringify(CLASSIC_SCORING_RULES)),
    db.prepare("UPDATE channels SET active_session_id = ? WHERE id = ? AND active_session_id IS NULL").bind(DEMO_SESSION_ID, DEMO_CHANNEL_ID),
  ]);
}

export async function insertChallenge(
  db: D1Database,
  scope: ChannelScope,
  draft: ChallengeDraft,
  author: { id: string; login: string; displayName: string },
  parserStatus: Challenge["parserStatus"],
): Promise<string> {
  const session = await db.prepare("SELECT phase, submissions_open FROM sessions WHERE id = ? AND status = 'live'")
    .bind(scope.sessionId).first<{ phase: string; submissions_open: number }>();
  if (!session) throw new Error("No active session is available");
  const id = crypto.randomUUID();
  const parsed = ChallengeDraftSchema.parse(draft);
  const goesToInbox = session.phase !== "collecting" || !Boolean(session.submissions_open);
  await challengeInsertStatement(db, scope, goesToInbox ? { ...parsed, needsReview: true } : parsed, {
    id,
    authorId: author.id,
    authorLogin: author.login,
    authorDisplayName: author.displayName,
    status: goesToInbox ? "inbox" : "pending_review",
    parserStatus,
  }).run();
  return id;
}

export async function updateChallengeDraft(db: D1Database, scope: ChannelScope, id: string, draft: ChallengeDraft): Promise<void> {
  const parsed = ChallengeDraftSchema.parse(draft);
  const changed = await db
    .prepare(
      `UPDATE challenges SET
        raw_text = ?, title = ?, objective = ?, game = ?, context_json = ?, targets_json = ?,
        constraints_json = ?, time_limit_seconds = ?, max_attempts = ?, failure_conditions_json = ?,
        difficulty = ?, verification_mode = ?, warnings_json = ?, needs_review = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND session_id = ? AND status = 'pending_review'`,
    )
    .bind(
      parsed.rawText,
      parsed.title,
      parsed.objective,
      parsed.game,
      parsed.context ? JSON.stringify(parsed.context) : null,
      JSON.stringify(parsed.targets),
      JSON.stringify(parsed.constraints),
      parsed.timeLimitSeconds,
      parsed.maxAttempts,
      JSON.stringify(parsed.failureConditions),
      parsed.difficulty,
      parsed.verificationMode,
      JSON.stringify(parsed.warnings),
      parsed.needsReview ? 1 : 0,
      id,
      scope.sessionId,
    )
    .run();
  if (!changed.meta.changes) throw new AuthError("Editable challenge not found in this channel", 404);
}

export async function setChallengeStatus(
  db: D1Database,
  scope: ChannelScope,
  id: string,
  status: "approved" | "queued" | "rejected" | "inbox" | "pending_review",
): Promise<void> {
  const challenge = await db
    .prepare("SELECT c.author_id, c.author_display_name, c.status, c.needs_review, c.session_id FROM challenges c WHERE c.id = ? AND c.channel_id = ?")
    .bind(id, scope.channelId)
    .first<{ author_id: string; author_display_name: string; status: Challenge["status"]; needs_review: number; session_id: string }>();
  if (!challenge) throw new AuthError("Challenge not found in this channel", 404);

  const session = await db.prepare("SELECT phase FROM sessions WHERE id = ? AND status = 'live'")
    .bind(scope.sessionId).first<{ phase: string }>();
  const isCollecting = session?.phase === "collecting";
  const belongsToCurrentSession = challenge.session_id === scope.sessionId;
  const isRoundCandidate = ["pending_review", "approved", "queued"].includes(challenge.status);
  const allowed =
    (status === "pending_review" && challenge.status === "inbox" && isCollecting)
    || (status === "inbox" && ((belongsToCurrentSession && isRoundCandidate && isCollecting) || challenge.status === "rejected"))
    || (status === "rejected" && (challenge.status === "inbox" || (belongsToCurrentSession && isRoundCandidate && isCollecting)))
    || ((status === "approved" || status === "queued") && belongsToCurrentSession && isRoundCandidate && isCollecting);
  if (!allowed) throw new Error("That challenge cannot be changed at this point in the round");

  const statements = [
    db
      .prepare(
        `UPDATE challenges SET session_id = CASE WHEN ? = 'pending_review' THEN ? ELSE session_id END,
          status = ?, needs_review = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND channel_id = ?`,
      )
      .bind(
        status,
        scope.sessionId,
        status === "pending_review" ? (challenge.needs_review ? "pending_review" : "approved") : status,
        status === "approved" || status === "queued" ? 0 : challenge.needs_review,
        id,
        scope.channelId,
      ),
  ];

  if (status === "approved" || status === "queued") {
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO points_ledger
            (id, session_id, user_id, display_name, reason, amount, challenge_id, idempotency_key)
           VALUES (?, ?, ?, ?, 'approved', 1, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          scope.sessionId,
          challenge.author_id,
          challenge.author_display_name,
          id,
          `approved:${id}`,
        ),
    );
  }

  await db.batch(statements);
}

export async function setSubmissionsOpen(db: D1Database, scope: ChannelScope, open: boolean): Promise<void> {
  const changed = await db
    .prepare("UPDATE sessions SET submissions_open = ? WHERE id = ? AND channel_id = ? AND status = 'live' AND phase = 'collecting'")
    .bind(open ? 1 : 0, scope.sessionId, scope.channelId)
    .run();
  if (!changed.meta.changes) throw new Error("Submissions can only be changed while collecting ideas");
}

export async function createBallot(
  db: D1Database,
  scope: ChannelScope,
  challengeIds: string[],
  durationSeconds: number,
  requestedWinnersCount?: number,
): Promise<string> {
  const session = await db.prepare("SELECT phase, scoring_rules_json FROM sessions WHERE id = ? AND status = 'live'")
    .bind(scope.sessionId).first<{ phase: string; scoring_rules_json: string }>();
  if (!session || session.phase !== "collecting") throw new Error("Voting can only start while suggestions are being collected");
  const rules = parseScoringRules(parseJson(session.scoring_rules_json, null));
  const uniqueIds = [...new Set(challengeIds)].slice(0, rules.voting.shortlistSize);
  if (uniqueIds.length < 2) throw new Error("Choose at least two challenges");
  const winnersCount = Math.min(requestedWinnersCount ?? rules.voting.winnersCount, uniqueIds.length - 1);
  const id = crypto.randomUUID();
  const chosenDuration = Number.isFinite(durationSeconds) ? durationSeconds : rules.voting.durationSeconds;
  const endsAt = new Date(Date.now() + Math.max(10, Math.min(chosenDuration, 900)) * 1000).toISOString();
  const placeholders = uniqueIds.map(() => "?").join(",");
  const valid = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM challenges
       WHERE session_id = ? AND id IN (${placeholders}) AND status IN ('pending_review', 'approved', 'queued')`,
    )
    .bind(scope.sessionId, ...uniqueIds)
    .first<{ count: number }>();
  if (Number(valid?.count ?? 0) !== uniqueIds.length) throw new Error("A selected challenge cannot enter voting");

  const statements: D1PreparedStatement[] = [
    db
      .prepare("INSERT INTO ballots (id, session_id, status, ends_at, winners_count, votes_per_viewer) VALUES (?, ?, 'open', ?, ?, ?)")
      .bind(id, scope.sessionId, endsAt, winnersCount, winnersCount),
    db.prepare("UPDATE sessions SET phase = 'voting', submissions_open = 0 WHERE id = ?").bind(scope.sessionId),
    db.prepare(
      `UPDATE challenges SET status = 'inbox', needs_review = CASE WHEN status = 'pending_review' THEN 1 ELSE 0 END,
        updated_at = CURRENT_TIMESTAMP
       WHERE session_id = ? AND status IN ('pending_review', 'approved', 'queued') AND id NOT IN (${placeholders})`,
    ).bind(scope.sessionId, ...uniqueIds),
  ];

  uniqueIds.forEach((challengeId, index) => {
    statements.push(
      db
        .prepare("INSERT INTO ballot_entries (ballot_id, challenge_id, position) VALUES (?, ?, ?)")
        .bind(id, challengeId, index + 1),
      db.prepare("UPDATE challenges SET status = 'voting' WHERE id = ?").bind(challengeId),
      db
        .prepare(
          `INSERT OR IGNORE INTO points_ledger
            (id, session_id, user_id, display_name, reason, amount, challenge_id, idempotency_key)
           SELECT ?, ?, author_id, author_display_name, 'finalist', 2, id, ?
           FROM challenges WHERE id = ?`,
        )
        .bind(crypto.randomUUID(), scope.sessionId, `finalist:${id}:${challengeId}`, challengeId),
    );
  });

  await db.batch(statements);
  return id;
}

export async function castVote(db: D1Database, scope: ChannelScope, ballotId: string, voterId: string, challengeId: string): Promise<void> {
  const entry = await db
    .prepare(
      `SELECT b.votes_per_viewer AS votes_per_viewer FROM ballot_entries e
       JOIN ballots b ON b.id = e.ballot_id
       WHERE e.ballot_id = ? AND e.challenge_id = ? AND b.session_id = ? AND b.status = 'open'
       AND julianday(b.ends_at) > julianday('now')`,
    )
    .bind(ballotId, challengeId, scope.sessionId)
    .first<{ votes_per_viewer: number }>();
  if (!entry) throw new AuthError("That challenge is not on this channel's active ballot", 404);
  const safeVoter = voterId.slice(0, 100);
  const existing = await db.prepare("SELECT 1 AS present FROM votes WHERE ballot_id = ? AND voter_id = ? AND challenge_id = ?")
    .bind(ballotId, safeVoter, challengeId).first();
  // Chat retries and repeated commands are idempotent. Once cast, a vote cannot
  // be toggled off; a viewer may only add another distinct choice.
  if (existing) return;
  const count = await db.prepare("SELECT COUNT(*) AS total FROM votes WHERE ballot_id = ? AND voter_id = ?")
    .bind(ballotId, safeVoter).first<{ total: number }>();
  if (Number(count?.total ?? 0) >= entry.votes_per_viewer) throw new Error(`Each viewer can choose up to ${entry.votes_per_viewer} challenges`);
  await db.prepare("INSERT OR IGNORE INTO votes (ballot_id, voter_id, challenge_id) VALUES (?, ?, ?)")
    .bind(ballotId, safeVoter, challengeId).run();
}

export async function closeBallot(db: D1Database, scope: ChannelScope, ballotId: string): Promise<string[]> {
  const ballot = await db.prepare("SELECT winners_count FROM ballots WHERE id = ? AND session_id = ? AND status = 'open'")
    .bind(ballotId, scope.sessionId).first<{ winners_count: number }>();
  if (!ballot) throw new AuthError("Open ballot not found in this channel", 404);
  const ranked = await db
    .prepare(
      `SELECT e.challenge_id, e.position, COUNT(v.voter_id) AS votes
       FROM ballot_entries e
       LEFT JOIN votes v ON v.ballot_id = e.ballot_id AND v.challenge_id = e.challenge_id
       JOIN ballots b ON b.id = e.ballot_id
       WHERE e.ballot_id = ? AND b.session_id = ? AND b.status = 'open'
       GROUP BY e.challenge_id, e.position
       ORDER BY votes DESC, e.position ASC
       LIMIT ?`,
    )
    .bind(ballotId, scope.sessionId, ballot.winners_count)
    .all<{ challenge_id: string; position: number; votes: number }>();
  const winnerIds = ranked.results.map((winner) => winner.challenge_id);
  if (!winnerIds.length) throw new AuthError("Open ballot not found in this channel", 404);
  const rulesRow = await db.prepare("SELECT scoring_rules_json FROM sessions WHERE id = ?")
    .bind(scope.sessionId).first<{ scoring_rules_json: string }>();
  const rules = parseScoringRules(parseJson(rulesRow?.scoring_rules_json ?? null, null));
  const placeholders = winnerIds.map(() => "?").join(",");
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "UPDATE ballots SET status = 'closed', winner_challenge_id = ?, closed_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'open'",
      )
      .bind(winnerIds[0], ballotId),
    db
      .prepare(
        `UPDATE challenges SET status = CASE WHEN id IN (${placeholders}) THEN 'queued' ELSE 'inbox' END
         WHERE id IN (SELECT challenge_id FROM ballot_entries WHERE ballot_id = ?)`,
      )
      .bind(...winnerIds, ballotId),
    db.prepare("UPDATE sessions SET phase = 'ready', selected_challenge_count = ? WHERE id = ?")
      .bind(winnerIds.length, scope.sessionId),
  ];
  for (const challengeId of winnerIds) {
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO points_ledger
        (id, session_id, user_id, display_name, reason, amount, challenge_id, idempotency_key)
       SELECT ?, ?, author_id, author_display_name, 'selected', ?, id, ? FROM challenges WHERE id = ? AND session_id = ?`,
    ).bind(crypto.randomUUID(), scope.sessionId, rules.challenger.selectedPoints, `selected:${scope.sessionId}:${challengeId}`, challengeId, scope.sessionId));
  }
  await db.batch(statements);
  return winnerIds;
}

export async function startChallenge(db: D1Database, scope: ChannelScope, challengeId: string): Promise<string> {
  const challenge = await db
    .prepare(
      `SELECT c.author_id, c.author_display_name, c.time_limit_seconds, s.scoring_rules_json, s.phase FROM challenges c
       JOIN sessions s ON s.id = c.session_id
       WHERE c.id = ? AND c.session_id = ? AND ((s.phase = 'collecting' AND c.status IN ('approved', 'queued')) OR (s.phase IN ('ready', 'live') AND c.status = 'queued'))`,
    )
    .bind(challengeId, scope.sessionId)
    .first<{ author_id: string; author_display_name: string; time_limit_seconds: number | null; scoring_rules_json: string; phase: string }>();
  if (!challenge) throw new AuthError("Ready challenge not found in this channel", 404);
  const rules = parseScoringRules(parseJson(challenge.scoring_rules_json, null));

  const active = await db
    .prepare("SELECT 1 AS active FROM rounds WHERE session_id = ? AND status = 'active'")
    .bind(scope.sessionId)
    .first();
  if (active) throw new Error("Resolve the active challenge first");

  const roundId = crypto.randomUUID();
  const startedAtDate = new Date(Date.now() + CHALLENGE_COUNTDOWN_SECONDS * 1000);
  const startedAt = startedAtDate.toISOString();
  const endsAt = challenge.time_limit_seconds
    ? new Date(startedAtDate.getTime() + challenge.time_limit_seconds * 1000).toISOString()
    : null;

  await db.batch([
    db.prepare("UPDATE challenges SET status = 'active', round_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(rules.team.challengeWinPoints, challengeId),
    db.prepare("UPDATE sessions SET phase = 'live' WHERE id = ?").bind(scope.sessionId),
    db
      .prepare(
        `INSERT INTO rounds (id, session_id, challenge_id, status, started_at, ends_at)
         VALUES (?, ?, ?, 'active', ?, ?)`,
      )
      .bind(roundId, scope.sessionId, challengeId, startedAt, endsAt),
    db
      .prepare(
        `INSERT OR IGNORE INTO points_ledger
          (id, session_id, user_id, display_name, reason, amount, challenge_id, idempotency_key)
         VALUES (?, ?, ?, ?, 'played', 5, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        scope.sessionId,
        challenge.author_id,
        challenge.author_display_name,
        challengeId,
        `played:${challengeId}`,
      ),
  ]);

  return roundId;
}

export async function incrementAttempt(db: D1Database, scope: ChannelScope, challengeId: string, delta: number): Promise<void> {
  const changed = await db
    .prepare(
      `UPDATE rounds SET attempts_used = MAX(0, attempts_used + ?)
       WHERE challenge_id = ? AND session_id = ? AND status = 'active'`,
    )
    .bind(delta > 0 ? 1 : -1, challengeId, scope.sessionId)
    .run();
  if (!changed.meta.changes) throw new AuthError("Active challenge not found in this channel", 404);
}

export async function resolveChallenge(
  db: D1Database,
  scope: ChannelScope,
  challengeId: string,
  result: "streamer_won" | "chat_won" | "skipped" | "voided",
): Promise<void> {
  const round = await db
    .prepare(
      `SELECT r.id, c.round_value, c.author_id, c.author_display_name, s.scoring_rules_json FROM rounds r
       JOIN challenges c ON c.id = r.challenge_id
       JOIN sessions s ON s.id = r.session_id
       WHERE r.challenge_id = ? AND r.session_id = ? AND r.status = 'active'`,
    )
    .bind(challengeId, scope.sessionId)
    .first<{ id: string; round_value: number; author_id: string; author_display_name: string; scoring_rules_json: string }>();
  if (!round) throw new AuthError("Active challenge not found in this channel", 404);

  const nonce = crypto.randomUUID();
  const scoredResult = result === "streamer_won" || result === "chat_won" ? result : null;
  const challengeStatus = result;

  const rules = parseScoringRules(parseJson(round.scoring_rules_json, null));
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE rounds SET status = 'resolved', result = ?, resolved_by = 'demo-referee',
          resolved_at = CURRENT_TIMESTAMP, resolution_nonce = ?
         WHERE id = ? AND status = 'active'`,
      )
      .bind(scoredResult, nonce, round.id),
    db.prepare("UPDATE challenges SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(challengeStatus, challengeId),
    db
      .prepare(
        `UPDATE sessions SET
          streamer_score = streamer_score + CASE WHEN ? = 'streamer_won' THEN ? ELSE 0 END,
          chat_score = chat_score + CASE WHEN ? = 'chat_won' THEN ? ELSE 0 END
         WHERE id = ? AND EXISTS (SELECT 1 FROM rounds WHERE id = ? AND resolution_nonce = ?)`,
      )
      .bind(result, round.round_value, result, round.round_value, scope.sessionId, round.id, nonce),
  ];
  if (result === "chat_won") {
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO points_ledger
        (id, session_id, user_id, display_name, reason, amount, challenge_id, idempotency_key)
       VALUES (?, ?, ?, ?, 'defeated_streamer', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), scope.sessionId, round.author_id, round.author_display_name, rules.challenger.defeatedStreamerPoints, challengeId, `defeated-streamer:${scope.sessionId}:${challengeId}`));
  }
  await db.batch(statements);
}

export async function completeSession(db: D1Database, scope: ChannelScope): Promise<{ winner: ContestSide | null; sweepWinner: ContestSide | null }> {
  const session = await db.prepare("SELECT * FROM sessions WHERE id = ? AND channel_id = ? AND status = 'live'")
    .bind(scope.sessionId, scope.channelId).first<SessionRow & { selected_challenge_count: number }>();
  if (!session || session.phase === "complete") throw new Error("This session is already complete");
  if (await db.prepare("SELECT 1 AS active FROM rounds WHERE session_id = ? AND status = 'active'").bind(scope.sessionId).first()) {
    throw new Error("Resolve the active challenge before completing the session");
  }
  const results = await db.prepare(
    `SELECT COUNT(*) AS resolved,
      SUM(CASE WHEN result = 'streamer_won' THEN 1 ELSE 0 END) AS streamer_wins,
      SUM(CASE WHEN result = 'chat_won' THEN 1 ELSE 0 END) AS chat_wins,
      SUM(CASE WHEN result IS NOT NULL THEN 1 ELSE 0 END) AS scored
     FROM rounds WHERE session_id = ? AND status = 'resolved'`,
  ).bind(scope.sessionId).first<{ resolved: number; streamer_wins: number; chat_wins: number; scored: number }>();
  const resolved = Number(results?.resolved ?? 0);
  const streamerWins = Number(results?.streamer_wins ?? 0);
  const chatWins = Number(results?.chat_wins ?? 0);
  const scored = Number(results?.scored ?? 0);
  if (!resolved) throw new Error("Play at least one challenge before completing the session");
  if (session.selected_challenge_count > 0 && resolved < session.selected_challenge_count) {
    throw new Error(`Resolve all ${session.selected_challenge_count} selected challenges before completing the session`);
  }
  const winner: ContestSide | null = streamerWins === chatWins ? null : streamerWins > chatWins ? "streamer" : "chat";
  const expected = session.selected_challenge_count || resolved;
  const sweepWinner: ContestSide | null = scored === expected && resolved === expected && (streamerWins === expected || chatWins === expected)
    ? streamerWins === expected ? "streamer" : "chat"
    : null;
  const rules = parseScoringRules(parseJson(session.scoring_rules_json, null));
  let streamerScore = Number(session.streamer_score);
  let chatScore = Number(session.chat_score);
  if (sweepWinner && rules.team.cleanSweep.enabled) {
    if (sweepWinner === "streamer") streamerScore = Math.round(streamerScore * rules.team.cleanSweep.multiplierPercent / 100);
    else chatScore = Math.round(chatScore * rules.team.cleanSweep.multiplierPercent / 100);
  }
  if (winner === "streamer") streamerScore += rules.team.sessionWinBonus;
  if (winner === "chat") chatScore += rules.team.sessionWinBonus;
  await db.prepare(
    `UPDATE sessions SET phase = 'complete', submissions_open = 0, streamer_score = ?, chat_score = ?, winner = ?, sweep_winner = ?, sweep_label = ?, completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND channel_id = ? AND status = 'live'`,
  ).bind(streamerScore, chatScore, winner, sweepWinner, sweepWinner ? rules.team.cleanSweep.label : null, scope.sessionId, scope.channelId).run();
  return { winner, sweepWinner };
}

export async function createNextSession(db: D1Database, scope: ChannelScope): Promise<string> {
  const current = await db.prepare("SELECT phase FROM sessions WHERE id = ? AND channel_id = ? AND status = 'live'")
    .bind(scope.sessionId, scope.channelId).first<{ phase: string }>();
  if (!current || current.phase !== "complete") throw new Error("Complete the current session before starting another");
  const channel = await db.prepare("SELECT scoring_rules_json FROM channels WHERE id = ?")
    .bind(scope.channelId).first<{ scoring_rules_json: string }>();
  if (!channel) throw new AuthError("Channel not found", 404);
  const rules = parseScoringRules(parseJson(channel.scoring_rules_json, null));
  const id = crypto.randomUUID();
  await db.batch([
    db.prepare("UPDATE sessions SET status = 'ended', ended_at = CURRENT_TIMESTAMP WHERE id = ? AND channel_id = ?").bind(scope.sessionId, scope.channelId),
    db.prepare("INSERT INTO sessions (id, channel_id, status, mode, phase, scoring_rules_json) VALUES (?, ?, 'live', 'open_queue', 'collecting', ?)")
      .bind(id, scope.channelId, JSON.stringify(rules)),
    db.prepare("UPDATE channels SET active_session_id = ? WHERE id = ?").bind(id, scope.channelId),
  ]);
  return id;
}

export async function cancelSession(db: D1Database, scope: ChannelScope): Promise<{ id: string; inboxCount: number }> {
  const current = await db.prepare(
    `SELECT phase, submissions_open AS submissionsOpen,
      (SELECT COUNT(*) FROM challenges WHERE session_id = ? AND status NOT IN ('inbox', 'rejected')) AS challengeCount
     FROM sessions WHERE id = ? AND channel_id = ? AND status = 'live'`,
  ).bind(scope.sessionId, scope.sessionId, scope.channelId).first<{ phase: string; submissionsOpen: number; challengeCount: number }>();
  if (!current) throw new AuthError("Active round not found", 404);
  if (current.phase === "complete") throw new Error("A finished round cannot be cancelled");
  if (current.phase === "collecting" && !current.submissionsOpen && !Number(current.challengeCount)) {
    throw new Error("There is no round to cancel");
  }

  const channel = await db.prepare("SELECT scoring_rules_json FROM channels WHERE id = ?")
    .bind(scope.channelId).first<{ scoring_rules_json: string }>();
  if (!channel) throw new AuthError("Channel not found", 404);
  const rules = parseScoringRules(parseJson(channel.scoring_rules_json, null));
  const portable = ["inbox", "pending_review", "approved", "voting", "queued", "active"];
  const kept = await db.prepare(
    `SELECT COUNT(*) AS count FROM challenges WHERE session_id = ? AND status IN (${portable.map(() => "?").join(",")})`,
  ).bind(scope.sessionId, ...portable).first<{ count: number }>();
  const id = crypto.randomUUID();

  await db.batch([
    db.prepare("UPDATE sessions SET status = 'ended', submissions_open = 0, ended_at = CURRENT_TIMESTAMP WHERE id = ? AND channel_id = ?")
      .bind(scope.sessionId, scope.channelId),
    db.prepare("INSERT INTO sessions (id, channel_id, status, mode, phase, scoring_rules_json) VALUES (?, ?, 'live', 'open_queue', 'collecting', ?)")
      .bind(id, scope.channelId, JSON.stringify(rules)),
    db.prepare(
      `UPDATE challenges SET session_id = ?, status = 'inbox', updated_at = CURRENT_TIMESTAMP
       WHERE session_id = ? AND status IN (${portable.map(() => "?").join(",")})`,
    ).bind(id, scope.sessionId, ...portable),
    db.prepare("UPDATE channels SET active_session_id = ? WHERE id = ?").bind(id, scope.channelId),
    // Removing the abandoned session also removes its ballots, rounds, and point ledger.
    // Challenges worth keeping were moved to the new session above; terminal and rejected
    // challenges disappear with the abandoned round so they cannot affect history or streaks.
    db.prepare("DELETE FROM sessions WHERE id = ? AND channel_id = ?").bind(scope.sessionId, scope.channelId),
  ]);
  return { id, inboxCount: Number(kept?.count ?? 0) };
}

export async function updateTheme(db: D1Database, scope: ChannelScope, theme: Theme): Promise<void> {
  const parsed = ThemeSchema.parse(theme);
  await db
    .prepare("UPDATE channels SET theme_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(JSON.stringify(parsed), scope.channelId)
    .run();
}

export async function updateOverlayConfig(db: D1Database, scope: ChannelScope, config: OverlayConfig): Promise<OverlayConfig> {
  const parsed = OverlayConfigSchema.parse(config);
  await db
    .prepare("UPDATE channels SET overlay_config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(JSON.stringify(parsed), scope.channelId)
    .run();
  return parsed;
}

export async function updateSessionSettings(db: D1Database, scope: ChannelScope, settings: SessionSettings): Promise<SessionSettings> {
  const parsed = SessionSettingsSchema.parse(settings);
  await db
    .prepare("UPDATE channels SET session_settings_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(JSON.stringify(parsed), scope.channelId)
    .run();
  return parsed;
}

export async function readSessionSettings(db: D1Database, scope: ChannelScope): Promise<SessionSettings> {
  const row = await db.prepare("SELECT session_settings_json FROM channels WHERE id = ?")
    .bind(scope.channelId).first<{ session_settings_json: string }>();
  if (!row) throw new AuthError("Channel not found", 404);
  return SessionSettingsSchema.parse(parseJson(row.session_settings_json, DEFAULT_SESSION_SETTINGS));
}

export async function selectedChallengeSummaries(
  db: D1Database,
  scope: ChannelScope,
): Promise<{ title: string; objective: string; game: string | null }[]> {
  const rows = await db.prepare(
    `SELECT title, objective, game FROM challenges
     WHERE session_id = ? AND status IN ('queued', 'active', 'streamer_won', 'chat_won', 'skipped', 'voided')
     ORDER BY updated_at, created_at, id`,
  ).bind(scope.sessionId).all<{ title: string; objective: string; game: string | null }>();
  return rows.results;
}

export async function updateSessionName(db: D1Database, scope: ChannelScope, name: string | null): Promise<void> {
  const changed = await db.prepare(
    "UPDATE sessions SET name = ? WHERE id = ? AND channel_id = ? AND status = 'live'",
  ).bind(name?.trim().slice(0, 60) || null, scope.sessionId, scope.channelId).run();
  if (!changed.meta.changes) throw new AuthError("Active round not found", 404);
}

export async function resetDemo(db: D1Database, scope: ChannelScope): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM sessions WHERE id = ? AND channel_id = ?").bind(scope.sessionId, scope.channelId),
    db.prepare("INSERT INTO sessions (id, channel_id, status, mode, scoring_rules_json) SELECT ?, ?, 'live', 'open_queue', scoring_rules_json FROM channels WHERE id = ?")
      .bind(scope.sessionId, scope.channelId, scope.channelId),
  ]);

  const seeds = [
    {
      draft: {
        ...fallbackParseChallenge("Hit 3 airborne headshots in one match with gray weapons only", "Fortnite"),
        title: "Air Mail",
        objective: "Hit three airborne headshots in one match",
        constraints: [{ kind: "loadout" as const, label: "Gray weapons only" }],
        targets: [{ label: "Airborne headshots", value: 3, comparison: "at_least" as const, requiresStreak: false }],
        context: { scope: "match" as const, label: "Current match" },
        difficulty: "ridiculous" as const,
        warnings: [],
        needsReview: false,
      },
      author: ["viewer-1", "pixelfiend", "PixelFiend"],
      status: "pending_review" as const,
    },
    {
      draft: {
        ...fallbackParseChallenge("Land five kickflips in a row on the waterslide in 90 seconds", "Skate"),
        title: "Waterslide Five",
        objective: "Land five kickflips in a row",
        timeLimitSeconds: 90,
        maxAttempts: 3,
        targets: [{ label: "Kickflips", value: 5, comparison: "at_least" as const, requiresStreak: true }],
        context: { scope: "location" as const, label: "Waterslide" },
        difficulty: "hard" as const,
        warnings: [],
        needsReview: false,
      },
      author: ["viewer-2", "boardlord", "BoardLord"],
      status: "queued" as const,
    },
    {
      draft: {
        ...fallbackParseChallenge("Win the next fight without healing", "Fortnite"),
        title: "No Meds, No Mercy",
        objective: "Win the next fight without healing",
        context: { scope: "match" as const, label: "Next fight" },
        constraints: [{ kind: "other" as const, label: "No healing" }],
        difficulty: "hard" as const,
        warnings: [],
        needsReview: false,
      },
      author: ["viewer-3", "chatgremlin", "ChatGremlin"],
      status: "approved" as const,
    },
    {
      draft: {
        ...fallbackParseChallenge("Do a double kickflip to smith grind from the weird angle", "Skate"),
        title: "Weird Angle Smith",
        objective: "Land a double kickflip to smith grind from the weird angle",
        maxAttempts: 5,
        difficulty: "hard" as const,
        warnings: [],
        needsReview: false,
      },
      author: ["viewer-4", "manualcatch", "ManualCatch"],
      status: "approved" as const,
    },
  ];

  await db.batch(
    seeds.map((seed) =>
      challengeInsertStatement(db, scope, ChallengeDraftSchema.parse(seed.draft), {
        id: crypto.randomUUID(),
        authorId: seed.author[0],
        authorLogin: seed.author[1],
        authorDisplayName: seed.author[2],
        status: seed.status,
        parserStatus: "fallback",
      }),
    ),
  );
}

function emptySideStreaks(): SideStreaks {
  return {
    challenge: { current: 0, best: 0 },
    session: { current: 0, best: 0 },
    cleanSweep: { current: 0, best: 0, total: 0 },
  };
}

function calculateStreaks(
  challengeResults: { result: "streamer_won" | "chat_won" }[],
  sessions: { winner: ContestSide | null; sweepWinner: ContestSide | null }[],
): Record<ContestSide, SideStreaks> {
  const output = { streamer: emptySideStreaks(), chat: emptySideStreaks() };
  for (const row of challengeResults) {
    const side: ContestSide = row.result === "streamer_won" ? "streamer" : "chat";
    const other: ContestSide = side === "streamer" ? "chat" : "streamer";
    output[side].challenge.current += 1;
    output[side].challenge.best = Math.max(output[side].challenge.best, output[side].challenge.current);
    output[other].challenge.current = 0;
  }
  for (const row of sessions) {
    for (const side of ["streamer", "chat"] as const) {
      output[side].session.current = row.winner === side ? output[side].session.current + 1 : 0;
      output[side].session.best = Math.max(output[side].session.best, output[side].session.current);
      if (row.sweepWinner === side) {
        output[side].cleanSweep.current += 1;
        output[side].cleanSweep.total += 1;
      } else output[side].cleanSweep.current = 0;
      output[side].cleanSweep.best = Math.max(output[side].cleanSweep.best, output[side].cleanSweep.current);
    }
  }
  return output;
}

export async function loadState(db: D1Database, scope: ChannelScope, mode: "demo" | "live"): Promise<AppState> {
  const [channel, session, challengeResult, round, openBallot] = await Promise.all([
    db.prepare("SELECT * FROM channels WHERE id = ?").bind(scope.channelId).first<ChannelRow>(),
    db.prepare("SELECT * FROM sessions WHERE id = ?").bind(scope.sessionId).first<SessionRow>(),
    db
      .prepare(
        `SELECT c.*,
          (SELECT COUNT(*) FROM votes v JOIN ballots b ON b.id = v.ballot_id
           WHERE v.challenge_id = c.id AND b.session_id = ?) AS vote_count
         FROM challenges c
         WHERE c.session_id = ? OR (c.channel_id = ? AND c.status = 'inbox')
         ORDER BY c.created_at ASC`,
      )
      .bind(scope.sessionId, scope.sessionId, scope.channelId)
      .all<ChallengeRow>(),
    db
      .prepare("SELECT * FROM rounds WHERE session_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1")
      .bind(scope.sessionId)
      .first<RoundRow>(),
    db
      .prepare("SELECT * FROM ballots WHERE session_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1")
      .bind(scope.sessionId)
      .first<BallotRow>(),
  ]);

  if (!channel || !session) throw new Error("Demo state could not be initialized");
  const challenges = challengeResult.results.map((row) => rowToChallenge(row, Number(row.vote_count ?? 0)));
  let ballot: Ballot | null = null;

  if (openBallot) {
    const entries = await db
      .prepare(
        `SELECT e.position, e.challenge_id, COUNT(v.voter_id) AS votes
         FROM ballot_entries e
         LEFT JOIN votes v ON v.ballot_id = e.ballot_id AND v.challenge_id = e.challenge_id
         WHERE e.ballot_id = ?
         GROUP BY e.position, e.challenge_id ORDER BY e.position ASC`,
      )
      .bind(openBallot.id)
      .all<{ position: number; challenge_id: string; votes: number }>();
    ballot = {
      id: openBallot.id,
      status: openBallot.status,
      endsAt: openBallot.ends_at,
      winnersCount: openBallot.winners_count,
      votesPerViewer: openBallot.votes_per_viewer,
      entries: entries.results
        .map((entry) => {
          const challenge = challenges.find((item) => item.id === entry.challenge_id);
          return challenge
            ? { challenge: { ...challenge, voteCount: Number(entry.votes) }, position: entry.position, votes: Number(entry.votes) }
            : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    };
  }

  const [leaderboardRows, historyRows, challengeStreakRows, overallRow] = await Promise.all([
    db.prepare(
      `WITH scores AS (
         SELECT p.user_id, MAX(p.display_name) AS display_name, SUM(p.amount) AS points
         FROM points_ledger p JOIN sessions s ON s.id = p.session_id
         WHERE s.channel_id = ? AND p.reason IN ('selected', 'defeated_streamer')
         GROUP BY p.user_id HAVING points > 0
       ), records AS (
         SELECT c.author_id AS user_id,
           SUM(CASE WHEN c.status IN ('streamer_won', 'chat_won') THEN 1 ELSE 0 END) AS played,
           SUM(CASE WHEN c.status = 'chat_won' THEN 1 ELSE 0 END) AS won
         FROM challenges c JOIN sessions s ON s.id = c.session_id
         WHERE s.channel_id = ? GROUP BY c.author_id
       )
       SELECT scores.user_id AS userId, scores.display_name AS displayName, scores.points,
         COALESCE(records.played, 0) AS played, COALESCE(records.won, 0) AS won
       FROM scores LEFT JOIN records ON records.user_id = scores.user_id
       ORDER BY points DESC, displayName ASC, userId ASC LIMIT 50`,
    ).bind(scope.channelId, scope.channelId).all<AppState["leaderboard"][number]>(),
    db.prepare(
      `SELECT s.id, s.name, s.streamer_score AS streamerScore, s.chat_score AS chatScore,
        SUM(CASE WHEN r.result = 'streamer_won' THEN 1 ELSE 0 END) AS streamerChallengeWins,
        SUM(CASE WHEN r.result = 'chat_won' THEN 1 ELSE 0 END) AS chatChallengeWins,
        s.winner, s.sweep_winner AS sweepWinner, s.sweep_label AS sweepLabel, s.completed_at AS completedAt
       FROM sessions s LEFT JOIN rounds r ON r.session_id = s.id
       WHERE s.channel_id = ? AND s.completed_at IS NOT NULL
       GROUP BY s.id ORDER BY s.completed_at DESC LIMIT 20`,
    ).bind(scope.channelId).all<SessionHistoryEntry>(),
    db.prepare(
      `SELECT r.result FROM rounds r JOIN sessions s ON s.id = r.session_id
       WHERE s.channel_id = ? AND r.result IS NOT NULL ORDER BY r.resolved_at, r.id`,
    ).bind(scope.channelId).all<{ result: "streamer_won" | "chat_won" }>(),
    db.prepare(
      `SELECT COALESCE(SUM(streamer_score), 0) AS streamer, COALESCE(SUM(chat_score), 0) AS chat,
        SUM(CASE WHEN winner = 'streamer' THEN 1 ELSE 0 END) AS streamerSessionWins,
        SUM(CASE WHEN winner = 'chat' THEN 1 ELSE 0 END) AS chatSessionWins
       FROM sessions WHERE channel_id = ?`,
    ).bind(scope.channelId).first<{ streamer: number; chat: number; streamerSessionWins: number; chatSessionWins: number }>(),
  ]);
  const chronologicalSessions = [...historyRows.results].reverse().map((row) => ({ winner: row.winner, sweepWinner: row.sweepWinner }));
  const streaks = calculateStreaks(challengeStreakRows.results, chronologicalSessions);
  const sessionRules = parseScoringRules(parseJson(session.scoring_rules_json, null), CLASSIC_SCORING_RULES);
  const channelRules = parseScoringRules(parseJson(channel.scoring_rules_json, null));

  return {
    mode: scope.channelId === DEMO_CHANNEL_ID ? mode : "live",
    channel: {
      id: channel.id,
      displayName: channel.display_name,
      broadcasterLogin: channel.broadcaster_login,
      slug: channel.broadcaster_login,
      setupComplete: Boolean(channel.setup_completed),
      scoringRules: channelRules,
    },
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      streamerScore: session.streamer_score,
      chatScore: session.chat_score,
      mode: session.mode,
      phase: session.phase,
      submissionsOpen: Boolean(session.submissions_open),
      scoringRules: sessionRules,
      winner: session.winner,
      sweepWinner: session.sweep_winner,
      sweepLabel: session.sweep_label,
    },
    challenges,
    activeRound: round
      ? {
          id: round.id,
          challengeId: round.challenge_id,
          status: round.status,
          startedAt: round.started_at,
          endsAt: round.ends_at,
          attemptsUsed: round.attempts_used,
          result: round.result,
        }
      : null,
    ballot,
    leaderboard: leaderboardRows.results,
    streaks,
    sessionHistory: historyRows.results.map((row) => ({
      ...row,
      streamerChallengeWins: Number(row.streamerChallengeWins),
      chatChallengeWins: Number(row.chatChallengeWins),
    })),
    overallScore: {
      streamer: Number(overallRow?.streamer ?? 0),
      chat: Number(overallRow?.chat ?? 0),
      streamerSessionWins: Number(overallRow?.streamerSessionWins ?? 0),
      chatSessionWins: Number(overallRow?.chatSessionWins ?? 0),
    },
    theme: ThemeSchema.catch(DEFAULT_THEME).parse(parseJson(channel.theme_json, DEFAULT_THEME)),
    overlayConfig: OverlayConfigSchema.catch(DEFAULT_OVERLAY_CONFIG).parse(parseJson(channel.overlay_config_json, DEFAULT_OVERLAY_CONFIG)),
    sessionSettings: SessionSettingsSchema.catch(DEFAULT_SESSION_SETTINGS).parse(parseJson(channel.session_settings_json, DEFAULT_SESSION_SETTINGS)),
  };
}

import { DEFAULT_THEME } from "../shared/contracts";
import { ARCADE_SCORING_RULES, ScoringRulesSchema, type ScoringRules } from "../shared/scoring";
import { ChannelInputSchema, type ChannelScope, type ChannelSummary } from "../shared/channels";
import { AuthError, sha256, type Actor } from "./auth";

export async function channelScope(db: D1Database, channelId: string): Promise<ChannelScope> {
  const row = await db.prepare("SELECT c.id AS channelId, s.id AS sessionId FROM channels c JOIN sessions s ON s.id = c.active_session_id AND s.channel_id = c.id WHERE c.id = ? AND s.status = 'live'")
    .bind(channelId).first<ChannelScope>();
  if (!row) throw new AuthError("Channel not found", 404);
  return row;
}

export async function requireChannelAccess(db: D1Database, actor: Actor, channelId: string): Promise<void> {
  if (actor.role === "owner") return;
  const membership = await db.prepare("SELECT 1 AS present FROM channel_memberships WHERE channel_id = ? AND user_id = ?")
    .bind(channelId, actor.id).first();
  if (!membership) throw new AuthError("You do not have access to this channel", 403);
}

export async function listChannels(db: D1Database, actor: Actor): Promise<ChannelSummary[]> {
  const result = actor.role === "owner"
    ? await db.prepare("SELECT id, display_name AS displayName, broadcaster_login AS slug FROM channels ORDER BY created_at, id").all<ChannelSummary>()
    : await db.prepare("SELECT c.id, c.display_name AS displayName, c.broadcaster_login AS slug FROM channels c JOIN channel_memberships m ON m.channel_id = c.id WHERE m.user_id = ? ORDER BY c.created_at, c.id").bind(actor.id).all<ChannelSummary>();
  return result.results;
}

export async function createChannel(db: D1Database, input: unknown): Promise<ChannelSummary> {
  const parsed = ChannelInputSchema.parse(input);
  const id = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  if (await db.prepare("SELECT 1 AS present FROM channels WHERE broadcaster_login = ?").bind(parsed.slug).first()) throw new AuthError("That channel slug is already in use", 409);
  await db.batch([
    db.prepare("INSERT INTO channels (id, display_name, broadcaster_login, theme_json, active_session_id, scoring_rules_json) VALUES (?, ?, ?, ?, ?, ?)").bind(id, parsed.displayName, parsed.slug, JSON.stringify(DEFAULT_THEME), sessionId, JSON.stringify(ARCADE_SCORING_RULES)),
    db.prepare("INSERT INTO sessions (id, channel_id, status, mode, scoring_rules_json) VALUES (?, ?, 'live', 'open_queue', ?)").bind(sessionId, id, JSON.stringify(ARCADE_SCORING_RULES)),
  ]);
  return { id, ...parsed };
}

export async function updateScoringRules(db: D1Database, channelId: string, input: unknown): Promise<ScoringRules> {
  const rules = ScoringRulesSchema.parse(input);
  const serialized = JSON.stringify(rules);
  await db.batch([
    db.prepare("UPDATE channels SET scoring_rules_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(serialized, channelId),
    db.prepare(
      `UPDATE sessions SET scoring_rules_json = ?
       WHERE id = (SELECT active_session_id FROM channels WHERE id = ?) AND phase = 'collecting'
       AND NOT EXISTS (SELECT 1 FROM ballots WHERE ballots.session_id = sessions.id)
       AND NOT EXISTS (SELECT 1 FROM rounds WHERE rounds.session_id = sessions.id)`,
    ).bind(serialized, channelId),
  ]);
  return rules;
}

export async function updateChannel(db: D1Database, channelId: string, input: unknown): Promise<void> {
  const parsed = ChannelInputSchema.parse(input);
  if (await db.prepare("SELECT 1 AS present FROM channels WHERE broadcaster_login = ? AND id != ?").bind(parsed.slug, channelId).first()) throw new AuthError("That channel slug is already in use", 409);
  await db.prepare("UPDATE channels SET display_name = ?, broadcaster_login = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(parsed.displayName, parsed.slug, channelId).run();
}

export async function integrationStatus(db: D1Database, channelId: string) {
  return db.prepare("SELECT last_four AS lastFour, created_at AS createdAt FROM channel_integration_tokens WHERE channel_id = ?").bind(channelId).first<{ lastFour: string; createdAt: number }>();
}
export async function rotateIntegrationToken(db: D1Database, channelId: string) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  await db.prepare("INSERT INTO channel_integration_tokens (channel_id, token_hash, last_four, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(channel_id) DO UPDATE SET token_hash = excluded.token_hash, last_four = excluded.last_four, created_at = excluded.created_at")
    .bind(channelId, await sha256(token), token.slice(-4), Date.now()).run();
  return { token };
}

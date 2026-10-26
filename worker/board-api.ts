import type { BoardToolName } from "../shared/board-tools";
import type { ChannelScope } from "../shared/channels";
import {
  cancelSession,
  closeBallot,
  completeSession,
  createBallot,
  createNextSession,
  incrementAttempt,
  insertChallenge,
  loadState,
  readSessionSettings,
  readRoundNameHistory,
  reopenVoting,
  resolveChallenge,
  selectedChallengeSummaries,
  setChallengeStatus,
  setSubmissionsOpen,
  setChallengePaused,
  startChallenge,
  updateChallengeDraft,
  updateSessionName,
} from "./db";
import { generateRoundName, parseChallenge } from "./parser";
import { AuthError } from "./auth";

export interface BoardApiEnv {
  DB: D1Database;
  APP_MODE?: "demo" | "live";
  AI?: { run(model: string, input: unknown, options?: unknown): Promise<unknown>; aiGatewayLogId?: string };
  AI_MODEL?: string;
  AI_GATEWAY_ID?: string;
}

export interface BoardToolResult {
  data: unknown;
  mutated: boolean;
}

type Inputs = Record<string, unknown>;

function text(input: Inputs, key: string, options: { required?: boolean; max?: number } = {}): string {
  const value = input[key];
  if (value === undefined && !options.required) return "";
  if (typeof value !== "string" || (options.required && !value.trim())) throw new Error(`${key} is required`);
  const output = value.trim();
  if (options.max && output.length > options.max) throw new Error(`${key} must be ${options.max} characters or fewer`);
  return output;
}

function integer(input: Inputs, key: string, minimum: number, maximum: number, optional = false): number | undefined {
  const value = input[key];
  if (value === undefined && optional) return undefined;
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(`${key} must be an integer from ${minimum} to ${maximum}`);
  }
  return Number(value);
}

function stringList(input: Inputs, key: string, minimum: number, maximum: number): string[] {
  const value = input[key];
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum || value.some((item) => typeof item !== "string" || !item)) {
    throw new Error(`${key} must contain ${minimum}–${maximum} IDs`);
  }
  const output = [...new Set(value as string[])];
  if (output.length !== value.length) throw new Error(`${key} cannot contain duplicate IDs`);
  return output;
}

/** Execute one board operation inside an already authenticated ChannelScope. */
export async function executeBoardTool(
  name: BoardToolName,
  rawInput: unknown,
  env: BoardApiEnv,
  scope: ChannelScope,
  coordinator?: DurableObjectStub,
): Promise<BoardToolResult> {
  const input = rawInput && typeof rawInput === "object" && !Array.isArray(rawInput) ? rawInput as Inputs : {};

  if (name === "get_board") {
    return { data: await loadState(env.DB, scope, env.APP_MODE ?? "demo"), mutated: false };
  }

  if (name === "set_submissions") {
    if (typeof input.open !== "boolean") throw new Error("open is required");
    await setSubmissionsOpen(env.DB, scope, input.open);
    return { data: { ok: true, open: input.open }, mutated: true };
  }

  if (name === "create_challenge") {
    const challengeText = text(input, "text", { required: true, max: 500 });
    const displayName = text(input, "authorDisplayName", { required: true, max: 40 });
    const game = text(input, "game", { max: 100 }) || null;
    const settings = await readSessionSettings(env.DB, scope);
    const parsed = await parseChallenge(challengeText, game, env, {
      enabled: settings.aiParsing,
      writeTitle: settings.aiChallengeTitles,
    });
    const fallbackLogin = displayName.toLowerCase().replace(/[^a-z0-9_]/g, "") || "viewer";
    const authorLogin = text(input, "authorLogin", { max: 40 }) || fallbackLogin;
    const authorId = text(input, "authorId", { max: 100 }) || `api:${authorLogin}`;
    const id = await insertChallenge(env.DB, scope, parsed.challenge, { id: authorId, login: authorLogin, displayName }, parsed.parserStatus);
    return { data: { id, parserStatus: parsed.parserStatus, challenge: parsed.challenge }, mutated: true };
  }

  if (name === "set_challenge_status") {
    const challengeId = text(input, "challengeId", { required: true });
    const status = text(input, "status", { required: true });
    const allowed = ["approved", "queued", "rejected", "inbox", "pending_review"] as const;
    if (!allowed.includes(status as (typeof allowed)[number])) throw new Error("Invalid challenge status");
    await setChallengeStatus(env.DB, scope, challengeId, status as (typeof allowed)[number]);
    return { data: { ok: true }, mutated: true };
  }

  if (name === "update_challenge") {
    const challengeId = text(input, "challengeId", { required: true });
    const updates = input.updates;
    if (!updates || typeof updates !== "object" || Array.isArray(updates) || !Object.keys(updates).length) throw new Error("updates is required");
    const allowed = new Set([
      "rawText", "title", "objective", "game", "context", "targets", "constraints", "timeLimitSeconds", "maxAttempts",
      "failureConditions", "difficulty", "verificationMode", "warnings", "needsReview",
    ]);
    const unknown = Object.keys(updates).find((key) => !allowed.has(key));
    if (unknown) throw new Error(`Unknown challenge field: ${unknown}`);
    const state = await loadState(env.DB, scope, env.APP_MODE ?? "demo");
    const challenge = state.challenges.find((item) => item.id === challengeId);
    if (!challenge) throw new Error("Challenge not found in this board");
    await updateChallengeDraft(env.DB, scope, challengeId, { ...challenge, ...updates });
    return { data: { ok: true }, mutated: true };
  }

  if (name === "start_challenge") {
    const roundId = await startChallenge(env.DB, scope, text(input, "challengeId", { required: true }));
    return { data: { roundId }, mutated: true };
  }

  if (name === "set_challenge_paused") {
    if (typeof input.paused !== "boolean") throw new Error("paused is required");
    await setChallengePaused(env.DB, scope, text(input, "challengeId", { required: true }), input.paused);
    return { data: { ok: true, paused: input.paused }, mutated: true };
  }

  if (name === "adjust_attempts") {
    const delta = integer(input, "delta", -1, 1);
    if (delta !== -1 && delta !== 1) throw new Error("delta must be -1 or 1");
    await incrementAttempt(env.DB, scope, text(input, "challengeId", { required: true }), delta);
    return { data: { ok: true }, mutated: true };
  }

  if (name === "resolve_challenge") {
    const result = text(input, "result", { required: true });
    const allowed = ["streamer_won", "chat_won", "skipped", "voided"] as const;
    if (!allowed.includes(result as (typeof allowed)[number])) throw new Error("Invalid challenge result");
    await resolveChallenge(env.DB, scope, text(input, "challengeId", { required: true }), result as (typeof allowed)[number]);
    return { data: { ok: true }, mutated: true };
  }

  if (name === "open_vote") {
    const challengeIds = stringList(input, "challengeIds", 2, 10);
    const durationSeconds = integer(input, "durationSeconds", 10, 900)!;
    const winnersCount = integer(input, "winnersCount", 1, 10, true);
    const id = await createBallot(env.DB, scope, challengeIds, durationSeconds, winnersCount);
    return { data: { id }, mutated: true };
  }

  if (name === "reopen_vote") {
    const durationSeconds = integer(input, "durationSeconds", 10, 900)!;
    return { data: { id: await reopenVoting(env.DB, scope, durationSeconds) }, mutated: true };
  }

  if (name === "close_vote") {
    const winnerIds = await closeBallot(env.DB, scope, text(input, "ballotId", { required: true }));
    const settings = await readSessionSettings(env.DB, scope);
    let roundName: string | null = null;
    let namingStatus: "ai" | "fallback" | null = null;
    if (settings.aiTitles) {
      const generated = await generateRoundName(await selectedChallengeSummaries(env.DB, scope), settings.aiRoundNameTone, env);
      roundName = generated.name;
      namingStatus = generated.generatorStatus;
      await updateSessionName(env.DB, scope, roundName);
    }
    return { data: { winnerIds, roundName, namingStatus }, mutated: true };
  }

  if (name === "complete_round") {
    return { data: await completeSession(env.DB, scope), mutated: true };
  }

  if (name === "set_round_name") {
    const roundName = text(input, "name", { required: true, max: 60 });
    await updateSessionName(env.DB, scope, roundName);
    return { data: { name: roundName }, mutated: true };
  }

  if (name === "generate_round_name") {
    const settings = await readSessionSettings(env.DB, scope);
    if (!settings.aiTitles) throw new AuthError("AI round naming is disabled for this board. Enable it in Settings to generate a name.", 403);
    const challenges = await selectedChallengeSummaries(env.DB, scope);
    if (!challenges.length) throw new Error("Lock in the lineup before naming the round");
    const generated = await generateRoundName(challenges, settings.aiRoundNameTone, env, await readRoundNameHistory(env.DB, scope));
    await updateSessionName(env.DB, scope, generated.name);
    return { data: generated, mutated: true };
  }

  if (name === "cancel_round") {
    const result = await cancelSession(env.DB, scope);
    await coordinator?.fetch("https://coordinator/internal/session-replaced", { method: "POST" });
    return { data: result, mutated: true };
  }

  if (name === "start_next_round") {
    const id = await createNextSession(env.DB, scope);
    await coordinator?.fetch("https://coordinator/internal/session-replaced", { method: "POST" });
    return { data: { id }, mutated: true };
  }

  name satisfies never;
  throw new Error("Unknown board tool");
}

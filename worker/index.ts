import { ThemeSchema } from "../shared/contracts";
import { FRAMEWORK_API_VERSION } from "../shared/framework";
import { projectOverlayState } from "../shared/public-state";
import {
  castVote,
  ensureDemoData,
  closeBallot,
  completeSession,
  createBallot,
  createNextSession,
  incrementAttempt,
  insertChallenge,
  loadState,
  resetDemo,
  resolveChallenge,
  setChallengeStatus,
  startChallenge,
  updateChallengeDraft,
  updateOverlayConfig,
  updateSessionSettings,
  updateTheme,
} from "./db";
import { parseChallenge } from "./parser";
import {
  AuthError,
  authStatus,
  consumeModInvite,
  createMod,
  getActor,
  grantModAccess,
  hasIntegrationToken,
  hasSameOrigin,
  listMods,
  loginOwner,
  logout,
  regenerateModInvite,
  revokeMod,
  sessionCookie,
  setupOwner,
  type AuthEnv,
} from "./auth";
import { DEFAULT_CHANNEL_ID, type ChannelScope } from "../shared/channels";
import { channelScope, createChannel, integrationStatus, listChannels, requireChannelAccess, rotateIntegrationToken, updateChannel, updateScoringRules } from "./channel-store";
export { LiveSessionCoordinator } from "./live-session";

interface Env extends AuthEnv {
  ASSETS_BUCKET: R2Bucket;
  LIVE_SESSIONS: DurableObjectNamespace;
  APP_MODE?: "demo" | "live";
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

async function body<T>(request: Request): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Expected JSON request body");
  return request.json<T>();
}

function requestedChannel(request: Request): string {
  return new URL(request.url).searchParams.get("channel") || DEFAULT_CHANNEL_ID;
}

function liveSession(env: Env, scope: ChannelScope): DurableObjectStub {
  return env.LIVE_SESSIONS.getByName(scope.sessionId);
}

async function resolveScope(request: Request, env: Env, actor?: NonNullable<Awaited<ReturnType<typeof getActor>>>): Promise<ChannelScope> {
  await ensureDemoData(env.DB);
  const channelId = requestedChannel(request);
  if (actor) await requireChannelAccess(env.DB, actor, channelId);
  return channelScope(env.DB, channelId);
}

function requireSameOrigin(request: Request): Response | null {
  return hasSameOrigin(request) ? null : json({ error: "Request origin does not match this deployment" }, 403);
}

function authResponse(request: Request, data: unknown, token: string | null, status = 200): Response {
  const headers = new Headers(jsonHeaders);
  if (token !== null) headers.set("Set-Cookie", sessionCookie(request, token, token === ""));
  return new Response(JSON.stringify(data), { status, headers });
}

async function handleFrameworkApi(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/")) return null;

  if (request.method === "GET" && url.pathname === "/api/v1/capabilities") {
    return json({
      apiVersion: FRAMEWORK_API_VERSION,
      transports: ["http", "websocket"],
      metrics: ["counter", "gauge", "flag"],
      rules: ["compare", "timer_expired", "all", "any"],
      surfaces: ["control-panel", "overlay"],
    });
  }

  const isSocket = request.method === "GET" && url.pathname === "/api/v1/live/socket";
  const socketScope = url.searchParams.get("scope") === "admin" ? "admin" : "overlay";
  const eventMatch = url.pathname.match(/^\/api\/v1\/runs\/([^/]+)\/events$/);
  const actor = await getActor(request, env);
  if (!(isSocket && socketScope === "overlay")) {
    if (!actor) {
      if (!(request.method === "POST" && eventMatch && await hasIntegrationToken(request, env, requestedChannel(request)))) return json({ error: "Sign in or use a channel integration token" }, 401);
      const input = await request.clone().json() as { event?: { type?: string } };
      if (!input.event || !["metric.incremented", "metric.set"].includes(input.event.type ?? "")) return json({ error: "Integration tokens may report metrics only" }, 403);
    } else if (request.method !== "GET" || isSocket) {
      const denied = requireSameOrigin(request);
      if (denied) return denied;
    }
  }
  const scope = await resolveScope(request, env, isSocket && socketScope === "overlay" ? undefined : actor ?? undefined);
  const coordinator = liveSession(env, scope);
  if (isSocket) {
    const forwarded = new Request(request);
    if (socketScope === "admin" && actor) {
      forwarded.headers.set("X-Challenge-Actor-Id", actor.id);
      forwarded.headers.set("X-Challenge-Session-Hash", actor.sessionHash);
      forwarded.headers.set("X-Challenge-Session-Expires-At", String(actor.expiresAt));
    }
    return coordinator.fetch(forwarded);
  }
  if (request.method === "POST" && url.pathname === "/api/v1/runs") return coordinator.fetch(new Request("https://coordinator/framework/runs", request));
  if (request.method === "GET" && url.pathname === "/api/v1/runs/live") return coordinator.fetch("https://coordinator/framework/runs/live");
  if (request.method === "POST" && eventMatch) return coordinator.fetch(new Request(`https://coordinator/framework/runs/${encodeURIComponent(decodeURIComponent(eventMatch[1]))}/events`, request));
  return json({ error: "Not found" }, 404);
}

async function publishLegacyState(request: Request, env: Env): Promise<void> {
  const scope = await resolveScope(request, env);
  const state = await loadState(env.DB, scope, env.APP_MODE ?? "demo");
  await liveSession(env, scope).fetch("https://coordinator/internal/legacy-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  });
}

function idFrom(path: string, suffix: string): string | null {
  const match = path.match(new RegExp(`^/api/challenges/([^/]+)/${suffix}$`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/api/health") return json({ ok: true, service: "challenge-chat" });
  if (method === "GET" && (path === "/api/public/state" || path === "/api/public/leaderboard")) {
    const scope = await resolveScope(request, env);
    const publicState = projectOverlayState(await loadState(env.DB, scope, env.APP_MODE ?? "demo"));
    return path === "/api/public/leaderboard" ? json({ leaderboard: publicState.leaderboard }) : json(publicState);
  }
  if (method === "GET" && path === "/api/auth/session") return json(await authStatus(request, env));
  const trustedVoteMatch = path.match(/^\/api\/ballots\/([^/]+)\/vote$/);
  if (method === "POST" && trustedVoteMatch && request.headers.get("authorization")?.startsWith("Bearer ")) {
    if (!await hasIntegrationToken(request, env, requestedChannel(request))) return json({ error: "A channel integration token is required" }, 401);
    const scope = await resolveScope(request, env);
    const input = await body<{ challengeId?: string; voterId?: string }>(request);
    if (!input.challengeId || !input.voterId?.trim()) throw new Error("Challenge and verified viewer ID are required");
    await castVote(env.DB, scope, decodeURIComponent(trustedVoteMatch[1]), input.voterId.trim().slice(0, 100), input.challengeId);
    return json({ ok: true });
  }
  if (method === "POST" && path === "/api/auth/setup") {
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    const input = await body<{ password?: string; controlRoomName?: string }>(request);
    const token = await setupOwner(env, input.password ?? "", input.controlRoomName ?? "");
    return authResponse(request, {
      authenticated: true,
      role: "owner",
      displayName: input.controlRoomName?.trim() ?? "Owner",
      controlRoomName: input.controlRoomName?.trim() ?? "Control room",
      setup: "complete",
    }, token, 201);
  }
  if (method === "POST" && path === "/api/auth/owner/login") {
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    const input = await body<{ password?: string }>(request);
    const token = await loginOwner(request, env, input.password ?? "");
    const status = await authStatus(request, env);
    return authResponse(request, {
      ...status,
      authenticated: true,
      role: "owner",
      displayName: status.controlRoomName,
    }, token);
  }
  if (method === "POST" && path === "/api/auth/invites/consume") {
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    const input = await body<{ token?: string }>(request);
    const token = await consumeModInvite(env, input.token ?? "");
    return authResponse(request, { authenticated: true, role: "mod" }, token);
  }
  if (method === "DELETE" && path === "/api/auth/session") {
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    const signedOut = await logout(request, env);
    if (signedOut) {
      const channels = await listChannels(env.DB, signedOut);
      await Promise.all(channels.map(async (channel) => {
        const scope = await channelScope(env.DB, channel.id);
        await liveSession(env, scope).fetch("https://coordinator/internal/revoke-session", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionHash: signedOut.sessionHash }),
        });
      }));
    }
    return authResponse(request, { authenticated: false }, "");
  }
  if (method === "GET" && path.startsWith("/api/assets/")) {
    const key = decodeURIComponent(path.slice("/api/assets/".length));
    if (!key.startsWith("brand/")) return json({ error: "Asset not found" }, 404);
    const object = await env.ASSETS_BUCKET.get(key);
    if (!object) return json({ error: "Asset not found" }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return new Response(object.body, { headers });
  }
  const actor = await getActor(request, env);
  if (!actor) return json({ error: "Sign in to access the control panel" }, 401);
  if (path === "/api/channels") {
    await ensureDemoData(env.DB);
    if (method === "GET") return json({ channels: await listChannels(env.DB, actor) });
    if (method === "POST") {
      if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
      const denied = requireSameOrigin(request); if (denied) return denied;
      return json({ channel: await createChannel(env.DB, await body(request)) }, 201);
    }
  }
  const scope = await resolveScope(request, env, actor);
  if (method === "GET" && path === "/api/channel/integration") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    const token = await integrationStatus(env.DB, scope.channelId);
    return json({ token, environmentFallback: !token && scope.channelId === DEFAULT_CHANNEL_ID && Boolean(env.INTEGRATION_TOKEN) });
  }

  if (method === "GET" && path === "/api/auth/mods") {
    if (actor?.role !== "owner") return json({ error: "Owner access required" }, actor ? 403 : 401);
    return json({ mods: await listMods(env, scope.channelId, url.searchParams.get("all") === "1") });
  }
  if (method === "POST" && path === "/api/auth/mods") {
    if (actor?.role !== "owner") return json({ error: "Owner access required" }, actor ? 403 : 401);
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    const input = await body<{ displayName?: string }>(request);
    return json(await createMod(env, request, scope.channelId, input.displayName ?? ""), 201);
  }
  const modInviteMatch = path.match(/^\/api\/auth\/mods\/([^/]+)\/invite$/);
  if (method === "POST" && modInviteMatch) {
    if (actor?.role !== "owner") return json({ error: "Owner access required" }, actor ? 403 : 401);
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    return json(await regenerateModInvite(env, request, scope.channelId, decodeURIComponent(modInviteMatch[1])));
  }
  const modDeleteMatch = path.match(/^\/api\/auth\/mods\/([^/]+)$/);
  if (method === "DELETE" && modDeleteMatch) {
    if (actor?.role !== "owner") return json({ error: "Owner access required" }, actor ? 403 : 401);
    const denied = requireSameOrigin(request);
    if (denied) return denied;
    const modId = decodeURIComponent(modDeleteMatch[1]);
    await revokeMod(env, scope.channelId, modId);
    await liveSession(env, scope).fetch("https://coordinator/internal/revoke-user", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: modId }),
    });
    return json({ ok: true });
  }
  if (method === "GET" && path === "/api/state") {
    if (!actor) return json({ error: "Sign in to access the control panel" }, 401);
    return json(await loadState(env.DB, scope, env.APP_MODE ?? "demo"));
  }

  if (!actor) return json({ error: "Sign in to access the control panel" }, 401);
  const denied = requireSameOrigin(request);
  if (denied) return denied;

  if (path === "/api/channel" && method === "PATCH") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    await updateChannel(env.DB, scope.channelId, await body(request));
    return json({ ok: true });
  }
  if (path === "/api/scoring-rules" && method === "PATCH") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    const input = await body<{ rules?: unknown }>(request);
    return json({ rules: await updateScoringRules(env.DB, scope.channelId, input.rules) });
  }
  if (path === "/api/overlay-config" && method === "PATCH") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    const input = await body<{ config?: unknown }>(request);
    return json({ config: await updateOverlayConfig(env.DB, scope, input.config as never) });
  }
  if (path === "/api/session-settings" && method === "PATCH") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    const input = await body<{ settings?: unknown }>(request);
    return json({ settings: await updateSessionSettings(env.DB, scope, input.settings as never) });
  }
  if (path === "/api/session/complete" && method === "POST") {
    return json(await completeSession(env.DB, scope));
  }
  if (path === "/api/sessions" && method === "POST") {
    return json({ id: await createNextSession(env.DB, scope) }, 201);
  }
  if (path === "/api/channel/mods" && method === "POST") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    const input = await body<{ modId: string }>(request);
    return json(await grantModAccess(env, request, scope.channelId, input.modId), 201);
  }
  if (path === "/api/channel/integration" && method === "POST") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    return json(await rotateIntegrationToken(env.DB, scope.channelId), 201);
  }
  if (method === "POST" && path === "/api/demo/reset") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    if (env.APP_MODE !== "demo" || scope.channelId !== DEFAULT_CHANNEL_ID) return json({ error: "Demo reset is disabled" }, 403);
    await resetDemo(env.DB, scope);
    return json(await loadState(env.DB, scope, env.APP_MODE ?? "demo"));
  }

  if (method === "POST" && path === "/api/challenges") {
    const input = await body<{ text?: string; game?: string; author?: { id?: string; login?: string; displayName?: string } }>(request);
    const parsed = await parseChallenge(input.text ?? "", input.game?.trim() || null, env);
    const displayName = input.author?.displayName?.trim().slice(0, 40) || "DemoViewer";
    const login = input.author?.login?.trim().slice(0, 40) || displayName.toLowerCase().replace(/[^a-z0-9_]/g, "");
    const id = await insertChallenge(
      env.DB,
      scope,
      parsed.challenge,
      { id: input.author?.id?.slice(0, 100) || `demo:${login}`, login, displayName },
      parsed.parserStatus,
    );
    return json({ id, parserStatus: parsed.parserStatus, challenge: parsed.challenge }, 201);
  }

  const draftId = path.match(/^\/api\/challenges\/([^/]+)$/)?.[1];
  if (method === "PATCH" && draftId) {
    const input = await body<{ challenge: unknown }>(request);
    await updateChallengeDraft(env.DB, scope, decodeURIComponent(draftId), input.challenge as never);
    return json({ ok: true });
  }

  const statusId = idFrom(path, "status");
  if (method === "POST" && statusId) {
    const input = await body<{ status?: "approved" | "queued" | "rejected" }>(request);
    if (!input.status || !["approved", "queued", "rejected"].includes(input.status)) throw new Error("Invalid challenge status");
    await setChallengeStatus(env.DB, scope, statusId, input.status);
    return json({ ok: true });
  }

  const startId = idFrom(path, "start");
  if (method === "POST" && startId) return json({ roundId: await startChallenge(env.DB, scope, startId) }, 201);

  const attemptId = idFrom(path, "attempt");
  if (method === "POST" && attemptId) {
    const input = await body<{ delta?: number }>(request);
    await incrementAttempt(env.DB, scope, attemptId, input.delta === -1 ? -1 : 1);
    return json({ ok: true });
  }

  const resolveId = idFrom(path, "resolve");
  if (method === "POST" && resolveId) {
    const input = await body<{ result?: "streamer_won" | "chat_won" | "skipped" | "voided" }>(request);
    if (!input.result || !["streamer_won", "chat_won", "skipped", "voided"].includes(input.result)) {
      throw new Error("Invalid result");
    }
    await resolveChallenge(env.DB, scope, resolveId, input.result);
    return json({ ok: true });
  }

  if (method === "POST" && path === "/api/ballots") {
    const input = await body<{ challengeIds?: string[]; durationSeconds?: number; winnersCount?: number }>(request);
    if (input.winnersCount !== undefined && (!Number.isInteger(input.winnersCount) || input.winnersCount < 1 || input.winnersCount > 10)) {
      throw new Error("Winner count must be an integer from 1 to 10");
    }
    return json({
      id: await createBallot(env.DB, scope, input.challengeIds ?? [], input.durationSeconds ?? Number.NaN, input.winnersCount),
    }, 201);
  }

  const voteMatch = path.match(/^\/api\/ballots\/([^/]+)\/vote$/);
  if (method === "POST" && voteMatch) {
    const input = await body<{ challengeId?: string; voterId?: string }>(request);
    if (!input.challengeId || !input.voterId?.trim()) throw new Error("Challenge and viewer ID are required");
    await castVote(env.DB, scope, decodeURIComponent(voteMatch[1]), input.voterId.trim().slice(0, 100), input.challengeId);
    return json({ ok: true });
  }

  const closeMatch = path.match(/^\/api\/ballots\/([^/]+)\/close$/);
  if (method === "POST" && closeMatch) return json({ winnerIds: await closeBallot(env.DB, scope, decodeURIComponent(closeMatch[1])) });

  if (method === "PATCH" && path === "/api/theme") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    const input = await body<{ theme: unknown }>(request);
    await updateTheme(env.DB, scope, ThemeSchema.parse(input.theme));
    return json({ ok: true });
  }

  if (method === "POST" && path === "/api/assets") {
    if (actor.role !== "owner") return json({ error: "Owner access required" }, 403);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("Image file is required");
    if (!new Set(["image/png", "image/jpeg", "image/webp"]).has(file.type)) throw new Error("Use PNG, JPEG, or WebP");
    if (file.size > 3_000_000) throw new Error("Image must be under 3 MB");
    const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `brand/${scope.channelId}/${crypto.randomUUID()}.${extension}`;
    await env.ASSETS_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { originalName: file.name } });
    return json({ url: `/api/assets/${key}` }, 201);
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    try {
      const frameworkResponse = await handleFrameworkApi(request, env);
      if (frameworkResponse) return frameworkResponse;
      const response = await handleApi(request, env);
      if (response.ok && !["GET", "HEAD", "OPTIONS"].includes(request.method) && !new URL(request.url).pathname.startsWith("/api/auth/")) {
        if (new URL(request.url).pathname !== "/api/channels") context.waitUntil(publishLegacyState(request, env));
      }
      return response;
    } catch (error) {
      if (!(error instanceof AuthError)) console.error(error);
      return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, error instanceof AuthError ? error.status : 400);
    }
  },
} satisfies ExportedHandler<Env>;

import { applyChallengeEvent, createChallengeRun, projectLiveRun } from "../shared/engine";
import {
  ChallengeDefinitionSchema,
  ChallengeEventEnvelopeSchema,
  type ChallengeDefinition,
  type ChallengeRun,
} from "../shared/framework";
import type { AppState } from "../shared/contracts";
import { projectOverlayState, type PublicOverlayState } from "../shared/public-state";

interface StoredLiveRun {
  definition: ChallengeDefinition;
  run: ChallengeRun;
}

interface LegacyStateMessage {
  type: "state.changed";
  revision: number;
  state: AppState;
}

interface OverlayStateMessage {
  type: "overlay.changed";
  revision: number;
  state: PublicOverlayState;
}

interface FrameworkRunMessage {
  type: "framework.run.changed";
  projection: ReturnType<typeof projectLiveRun>;
}

type LiveMessage = LegacyStateMessage | OverlayStateMessage | FrameworkRunMessage;

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export class LiveSessionCoordinator {
  constructor(private readonly state: DurableObjectState) {}

  private broadcast(message: LiveMessage): void {
    const serialized = JSON.stringify(message);
    for (const socket of this.state.getWebSockets()) {
      const role = (socket.deserializeAttachment() as { role?: "admin" | "overlay" } | null)?.role ?? "overlay";
      const attachment = socket.deserializeAttachment() as { expiresAt?: number } | null;
      if (role === "admin" && (!attachment?.expiresAt || attachment.expiresAt <= Date.now())) {
        socket.close(4001, "Session expired");
        continue;
      }
      if (message.type === "state.changed" && role !== "admin") continue;
      if (message.type === "overlay.changed" && role !== "overlay") continue;
      try {
        socket.send(serialized);
      } catch {
        socket.close(1011, "Broadcast failed");
      }
    }
  }

  private async connect(request: Request): Promise<Response> {
    const role = new URL(request.url).searchParams.get("scope") === "admin" ? "admin" : "overlay";
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.state.acceptWebSocket(server);
    server.serializeAttachment({
      role,
      userId: role === "admin" ? request.headers.get("X-Challenge-Actor-Id") : null,
      sessionHash: role === "admin" ? request.headers.get("X-Challenge-Session-Hash") : null,
      expiresAt: role === "admin" ? Number(request.headers.get("X-Challenge-Session-Expires-At")) : null,
      connectedAt: new Date().toISOString(),
    });

    const [legacy, live] = await Promise.all([
      this.state.storage.get<LegacyStateMessage>("legacy"),
      this.state.storage.get<StoredLiveRun>("framework:live"),
    ]);
    // Pre-Channel cached snapshots lack the new contracts; the HTTP bootstrap
    // loads fresh state instead of replacing it with an old schema on connect.
    if (legacy && legacy.state.channel.slug && Array.isArray(legacy.state.leaderboard)) {
      server.send(JSON.stringify(role === "admin" ? legacy : {
        type: "overlay.changed",
        revision: legacy.revision,
        state: projectOverlayState(legacy.state),
      } satisfies OverlayStateMessage));
    }
    if (live) {
      server.send(JSON.stringify({ type: "framework.run.changed", projection: projectLiveRun(live.definition, live.run) }));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  private async publishLegacy(request: Request): Promise<Response> {
    const state = (await request.json()) as AppState;
    const revision = ((await this.state.storage.get<number>("legacy:revision")) ?? 0) + 1;
    const message: LegacyStateMessage = { type: "state.changed", revision, state };
    await this.state.storage.put({ legacy: message, "legacy:revision": revision });
    this.broadcast(message);
    this.broadcast({ type: "overlay.changed", revision, state: projectOverlayState(state) });
    return json({ ok: true, revision });
  }

  private async revokeUser(request: Request): Promise<Response> {
    const input = await request.json() as { userId?: string };
    if (!input.userId) return json({ error: "User id is required" }, 400);
    for (const socket of this.state.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as { userId?: string } | null;
      if (attachment?.userId === input.userId) socket.close(4001, "Access revoked");
    }
    return json({ ok: true });
  }

  private async revokeSession(request: Request): Promise<Response> {
    const input = await request.json() as { sessionHash?: string };
    if (!input.sessionHash) return json({ error: "Session hash is required" }, 400);
    for (const socket of this.state.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as { sessionHash?: string } | null;
      if (attachment?.sessionHash === input.sessionHash) socket.close(4001, "Signed out");
    }
    return json({ ok: true });
  }

  private async createRun(request: Request): Promise<Response> {
    const existing = await this.state.storage.get<StoredLiveRun>("framework:live");
    if (existing && ["countdown", "active", "paused"].includes(existing.run.status)) {
      return json({ error: "Finish or void the current run before starting another" }, 409);
    }
    const input = (await request.json()) as { definition?: unknown };
    const definition = ChallengeDefinitionSchema.parse(input.definition);
    const run = createChallengeRun(definition);
    const stored: StoredLiveRun = { definition, run };
    await this.state.storage.put("framework:live", stored);

    if (run.status === "countdown") await this.state.storage.setAlarm(new Date(run.startsAt).getTime());
    else if (run.endsAt) await this.state.storage.setAlarm(new Date(run.endsAt).getTime());

    const projection = projectLiveRun(definition, run);
    this.broadcast({ type: "framework.run.changed", projection });
    return json({ run, projection }, 201);
  }

  private async readRun(): Promise<Response> {
    const stored = await this.state.storage.get<StoredLiveRun>("framework:live");
    if (!stored) return json({ run: null, projection: null });
    return json({ run: stored.run, projection: projectLiveRun(stored.definition, stored.run) });
  }

  private async applyEvent(request: Request, runId: string): Promise<Response> {
    const envelope = ChallengeEventEnvelopeSchema.parse(await request.json());
    if (["run.started", "timer.expired"].includes(envelope.event.type)) {
      return json({ error: "Lifecycle timer events are managed by the engine" }, 403);
    }
    const idempotencyKey = `framework:idempotency:${runId}:${envelope.source}:${envelope.idempotencyKey}`;
    const prior = await this.state.storage.get<{ revision: number }>(idempotencyKey);
    const stored = await this.state.storage.get<StoredLiveRun>("framework:live");
    if (!stored || stored.run.id !== runId) return json({ error: "Live run not found" }, 404);
    if (prior) return json({ run: stored.run, projection: projectLiveRun(stored.definition, stored.run), duplicate: true });

    const now = new Date();
    if (stored.run.status === "active" && stored.run.endsAt && now.getTime() >= new Date(stored.run.endsAt).getTime()) {
      const expired = applyChallengeEvent(stored.definition, stored.run, { type: "timer.expired" }, now);
      await this.state.storage.put("framework:live", { ...stored, run: expired });
      await this.state.storage.deleteAlarm();
      this.broadcast({ type: "framework.run.changed", projection: projectLiveRun(stored.definition, expired) });
      return json({ error: "Run deadline has passed", projection: projectLiveRun(stored.definition, expired) }, 409);
    }

    const run = applyChallengeEvent(stored.definition, stored.run, envelope.event, now);
    const next: StoredLiveRun = { ...stored, run };
    await this.state.storage.put({ "framework:live": next, [idempotencyKey]: { revision: run.revision } });

    if (run.status === "active" && run.endsAt) await this.state.storage.setAlarm(new Date(run.endsAt).getTime());
    if (run.status === "paused") await this.state.storage.deleteAlarm();
    if (["succeeded", "failed", "voided"].includes(run.status)) await this.state.storage.deleteAlarm();

    const projection = projectLiveRun(stored.definition, run);
    this.broadcast({ type: "framework.run.changed", projection });
    return json({ run, projection, duplicate: false });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get("Upgrade")?.toLowerCase() === "websocket") return this.connect(request);
    if (request.method === "POST" && url.pathname === "/internal/legacy-state") return this.publishLegacy(request);
    if (request.method === "POST" && url.pathname === "/internal/revoke-user") return this.revokeUser(request);
    if (request.method === "POST" && url.pathname === "/internal/revoke-session") return this.revokeSession(request);
    if (request.method === "POST" && url.pathname === "/framework/runs") return this.createRun(request);
    if (request.method === "GET" && url.pathname === "/framework/runs/live") return this.readRun();

    const eventMatch = url.pathname.match(/^\/framework\/runs\/([^/]+)\/events$/);
    if (request.method === "POST" && eventMatch) return this.applyEvent(request, decodeURIComponent(eventMatch[1]));
    return json({ error: "Not found" }, 404);
  }

  async alarm(): Promise<void> {
    const stored = await this.state.storage.get<StoredLiveRun>("framework:live");
    if (!stored) return;

    const now = new Date();
    let event: { type: "run.started" } | { type: "timer.expired" } | null = null;
    if (stored.run.status === "countdown" && now.getTime() >= new Date(stored.run.startsAt).getTime()) event = { type: "run.started" };
    else if (stored.run.status === "active" && stored.run.endsAt && now.getTime() >= new Date(stored.run.endsAt).getTime()) event = { type: "timer.expired" };
    if (!event) return;

    const run = applyChallengeEvent(stored.definition, stored.run, event, now);
    await this.state.storage.put("framework:live", { ...stored, run });
    if (run.status === "active" && run.endsAt) await this.state.storage.setAlarm(new Date(run.endsAt).getTime());
    const projection = projectLiveRun(stored.definition, run, now);
    this.broadcast({ type: "framework.run.changed", projection });
  }

  webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): void {
    if (message === "ping") socket.send("pong");
  }

  webSocketError(socket: WebSocket): void {
    socket.close(1011, "Socket error");
  }
}

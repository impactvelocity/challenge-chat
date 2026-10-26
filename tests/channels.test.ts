import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import worker from "../worker/index";
import { LiveSessionCoordinator } from "../worker/live-session";

/** Actual SQLite schema/constraints, with the small D1 API used by the Worker. */
class TestD1 {
  sql = new DatabaseSync(":memory:");
  constructor() {
    for (const migration of ["0001_init.sql", "0002_auth.sql", "0003_channels.sql", "0004_session_rules.sql", "0005_single_leaderboard.sql", "0006_surface_settings.sql", "0007_owner_profile.sql", "0008_channel_setup.sql"]) {
      this.sql.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
    }
  }
  prepare(query: string) {
    let values: any[] = [];
    const sql = this.sql;
    const execute = () => ({ meta: { changes: Number(sql.prepare(query).run(...values).changes) } });
    return {
      bind(...input: any[]) { values = input; return this; },
      first: async () => sql.prepare(query).get(...values) ?? null,
      all: async () => ({ results: sql.prepare(query).all(...values) }),
      run: async () => execute(),
      execute,
    };
  }
  async batch(statements: ReturnType<TestD1["prepare"]>[]) {
    this.sql.exec("BEGIN");
    try { const results = statements.map((statement) => statement.execute()); this.sql.exec("COMMIT"); return results; }
    catch (error) { this.sql.exec("ROLLBACK"); throw error; }
  }
}

function liveNamespace() {
  const instances = new Map<string, { coordinator: LiveSessionCoordinator; sockets: any[] }>();
  return {
    instances,
    getByName(name: string) {
      if (!instances.has(name)) {
        const values = new Map<string, unknown>();
        const sockets: any[] = [];
        const state = {
          storage: {
            get: async (key: string) => values.get(key),
            put: async (key: string | Record<string, unknown>, value: unknown) => typeof key === "string" ? values.set(key, value) : Object.entries(key).forEach(([entry, item]) => values.set(entry, item)),
            setAlarm: async () => {}, deleteAlarm: async () => {},
          },
          getWebSockets: () => sockets,
        };
        instances.set(name, { coordinator: new LiveSessionCoordinator(state as never), sockets });
      }
      return { fetch: (input: Request | string, init?: RequestInit) => instances.get(name)!.coordinator.fetch(input instanceof Request ? input : new Request(input, init)) };
    },
  };
}

describe("channels and the Challenger leaderboard with persisted data", () => {
  let db: TestD1;
  let live: ReturnType<typeof liveNamespace>;
  let ownerCookie: string;
  const base = "https://creator.example";
  let env: any;
  const pending: Promise<unknown>[] = [];
  const context = { waitUntil: (promise: Promise<unknown>) => pending.push(promise) };
  const call = async (path: string, options: { method?: string; data?: unknown; cookie?: string; channel?: string; bearer?: string } = {}) => {
    const url = new URL(path, base);
    if (options.channel) url.searchParams.set("channel", options.channel);
    const response = await worker.fetch(new Request(url, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json", Origin: base, ...(options.cookie ? { Cookie: options.cookie } : {}), ...(options.bearer ? { Authorization: `Bearer ${options.bearer}` } : {}) },
      ...(options.data !== undefined ? { body: JSON.stringify(options.data) } : {}),
    }), env, context as never);
    await Promise.all(pending.splice(0));
    return response;
  };
  const create = async (slug: string) => {
    const response = await call("/api/channels", { method: "POST", cookie: ownerCookie, data: { displayName: slug, slug } });
    expect(response.status).toBe(201);
    return (await response.json() as any).channel.id as string;
  };
  const suggestion = async (channel: string, game = "Horror", name = "Alice") => {
    const response = await call("/api/challenges", { method: "POST", channel, cookie: ownerCookie, data: { text: "Get five kills in 90 seconds", game, author: { id: name, displayName: name } } });
    expect(response.status).toBe(201);
    return (await response.json() as any).id as string;
  };
  const approve = async (channel: string, id: string) => call(`/api/challenges/${id}/status`, { method: "POST", channel, cookie: ownerCookie, data: { status: "approved" } });
  const state = async (channel: string) => (await (await call("/api/state", { channel, cookie: ownerCookie })).json()) as any;

  beforeEach(async () => {
    db = new TestD1(); live = liveNamespace();
    env = { DB: db, LIVE_SESSIONS: live, OWNER_PASSWORD: "long-test-owner-password", APP_MODE: "demo", INTEGRATION_TOKEN: "legacy-default-channel-token" };
    const login = await call("/api/auth/owner/login", { method: "POST", data: { password: env.OWNER_PASSWORD } });
    ownerCookie = login.headers.get("set-cookie")!.split(";")[0];
  });
  afterEach(() => db.sql.close());

  it("migrates the existing channel, contributions, and moderator access without deleting them", () => {
    const legacy = new DatabaseSync(":memory:");
    for (const migration of ["0001_init.sql", "0002_auth.sql"]) legacy.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), "utf8"));
    legacy.exec(`INSERT INTO channels (id, display_name, broadcaster_login, theme_json) VALUES ('demo-channel', 'Original', 'original', '{}');
      INSERT INTO sessions (id, channel_id, status, mode) VALUES ('demo-session', 'demo-channel', 'live', 'open_queue');
      INSERT INTO auth_users (id, role, display_name, created_at) VALUES ('existing-mod', 'mod', 'Existing', 0);
      INSERT INTO points_ledger (id, session_id, user_id, display_name, reason, amount, idempotency_key) VALUES ('points', 'demo-session', 'alice', 'Alice', 'approved', 1, 'old-award');`);
    legacy.exec(readFileSync(new URL("../migrations/0003_channels.sql", import.meta.url), "utf8"));
    legacy.exec(readFileSync(new URL("../migrations/0004_session_rules.sql", import.meta.url), "utf8"));
    legacy.exec(readFileSync(new URL("../migrations/0005_single_leaderboard.sql", import.meta.url), "utf8"));
    legacy.exec(readFileSync(new URL("../migrations/0006_surface_settings.sql", import.meta.url), "utf8"));
    legacy.exec(readFileSync(new URL("../migrations/0007_owner_profile.sql", import.meta.url), "utf8"));
    legacy.exec(readFileSync(new URL("../migrations/0008_channel_setup.sql", import.meta.url), "utf8"));
    expect(legacy.prepare("SELECT active_session_id FROM channels").get()?.active_session_id).toBe("demo-session");
    expect(legacy.prepare("SELECT user_id FROM channel_memberships").get()?.user_id).toBe("existing-mod");
    expect(legacy.prepare("SELECT COUNT(*) AS total FROM points_ledger").get()?.total).toBe(1);
    expect(legacy.prepare("SELECT COUNT(*) AS total FROM sqlite_master WHERE type = 'table' AND name = 'leaderboards'").get()?.total).toBe(0);
    legacy.close();
  });

  it("keeps the bootstrap channel hidden until the owner creates their first board", async () => {
    const channelsBefore = await (await call("/api/channels", { cookie: ownerCookie })).json() as any;
    expect(channelsBefore.channels).toEqual([
      expect.objectContaining({ id: "demo-channel", displayName: "Unconfigured board", setupComplete: false }),
    ]);
    expect((await state("demo-channel")).channel).toMatchObject({ setupComplete: false });

    expect((await call("/api/channel", {
      method: "PATCH",
      channel: "demo-channel",
      cookie: ownerCookie,
      data: { displayName: "Dylan's Board", slug: "setup-pending-demo-channel" },
    })).status).toBe(200);

    const channelsAfter = await (await call("/api/channels", { cookie: ownerCookie })).json() as any;
    expect(channelsAfter.channels).toEqual([
      expect.objectContaining({ id: "demo-channel", displayName: "Dylan's Board", setupComplete: true }),
    ]);
  });

  it("creates the named control room and D1-backed owner password on first deployment", async () => {
    env.OWNER_PASSWORD = undefined;
    const before = await (await call("/api/auth/session")).json() as any;
    expect(before).toMatchObject({ authenticated: false, setup: "ready", controlRoomName: "Control room" });

    expect((await call("/api/auth/setup", {
      method: "POST",
      data: { password: "12345", controlRoomName: "Too Short" },
    })).status).toBe(400);

    const setup = await call("/api/auth/setup", {
      method: "POST",
      data: {
        password: "a-strong-owner-password",
        controlRoomName: "Friday Night Control Room",
      },
    });
    expect(setup.status).toBe(201);
    const setupCookie = setup.headers.get("set-cookie")!.split(";")[0];
    expect(db.sql.prepare("SELECT control_room_name FROM auth_owner_credentials WHERE id = 1").get()?.control_room_name).toBe("Friday Night Control Room");
    expect(db.sql.prepare("SELECT display_name FROM auth_users WHERE id = 'owner'").get()?.display_name).toBe("Friday Night Control Room");
    expect(await (await call("/api/auth/session", { cookie: setupCookie })).json()).toMatchObject({
      authenticated: true,
      role: "owner",
      displayName: "Friday Night Control Room",
      controlRoomName: "Friday Night Control Room",
      setup: "complete",
    });
    expect((await call("/api/auth/setup", {
      method: "POST",
      data: { password: "another-strong-password", controlRoomName: "Taken Over" },
    })).status).toBe(409);
  });

  it("creates independent channels and prevents cross-channel challenge and ballot mutations", async () => {
    const a = await create("horror"); const b = await create("racing");
    expect((await state(a)).challenges).toEqual([]);
    const first = await suggestion(a); const second = await suggestion(a, "Horror", "Bob");
    await approve(a, first); await approve(a, second);
    expect((await state(b)).challenges).toEqual([]);
    expect((await approve(b, first)).status).toBe(404);
    const draft = (await state(a)).challenges.find((item: any) => item.id === first);
    expect((await call(`/api/challenges/${first}`, { method: "PATCH", channel: b, cookie: ownerCookie, data: { challenge: draft } })).status).toBe(404);
    const ballotResponse = await call("/api/ballots", { method: "POST", channel: a, cookie: ownerCookie, data: { challengeIds: [first, second], durationSeconds: 60 } });
    const { id: ballotId } = await ballotResponse.json() as any;
    expect((await call(`/api/ballots/${ballotId}/vote`, { method: "POST", channel: b, cookie: ownerCookie, data: { challengeId: first, voterId: "viewer" } })).status).toBe(404);
    expect((await call(`/api/ballots/${ballotId}/close`, { method: "POST", channel: b, cookie: ownerCookie })).status).toBe(404);
    expect((await state(a)).ballot.status).toBe("open");
    expect((await call("/api/channels", { method: "POST", cookie: ownerCookie, data: { displayName: "Duplicate", slug: "horror" } })).status).toBe(409);
    const original = (await state(b)).theme.primary;
    const theme = { ...(await state(a)).theme, primary: "#123456" };
    expect((await call("/api/theme", { method: "PATCH", channel: a, cookie: ownerCookie, data: { theme } })).status).toBe(200);
    expect((await state(b)).theme.primary).toBe(original);
  });

  it("exposes one channel-scoped Challenger leaderboard and no multi-board API", async () => {
    const a = await create("leaderboard-a"); const b = await create("leaderboard-b");
    expect((await state(a)).leaderboard).toEqual([]);
    expect((await state(b)).leaderboard).toEqual([]);
    expect(await (await call("/api/public/leaderboard", { channel: a })).json()).toEqual({ leaderboard: [] });
    expect((await call("/api/public/leaderboards", { channel: a })).status).toBe(401);
    expect((await call("/api/leaderboards", { method: "POST", channel: a, cookie: ownerCookie, data: {} })).status).toBe(404);
  });

  it("persists channel-scoped overlay and session settings in the public projection", async () => {
    const a = await create("surface-a"); const b = await create("surface-b");
    const config = {
      theme: "neon",
      settings: { neon: { accent: "#33ff99", bloom: 0.75, scanlines: true } },
      elements: { scoreboard: true, "hype-meter": false },
    };
    const settings = { autoNext: false, autoNextSecs: 30, aiTitles: false, publicPage: false, twitchLogin: "surface_a" };
    expect((await call("/api/overlay-config", { method: "PATCH", channel: a, cookie: ownerCookie, data: { config } })).status).toBe(200);
    expect((await call("/api/session-settings", { method: "PATCH", channel: a, cookie: ownerCookie, data: { settings } })).status).toBe(200);

    const admin = await state(a);
    expect(admin.overlayConfig).toEqual(config);
    expect(admin.sessionSettings).toEqual(settings);
    const publicState = await (await call("/api/public/state", { channel: a })).json() as any;
    expect(publicState.overlayConfig).toEqual(config);
    expect(publicState.publicSettings).toEqual({ publicPage: false, twitchLogin: "surface_a" });
    expect(JSON.stringify(publicState)).not.toContain("aiTitles");
    expect((await state(b)).overlayConfig.theme).toBe("broadcast");

    const invalid = await call("/api/overlay-config", {
      method: "PATCH", channel: a, cookie: ownerCookie,
      data: { config: { theme: "../bad", settings: {}, elements: {} } },
    });
    expect(invalid.status).toBe(400);
  });

  it("snapshots the control room's per-round winner count on the ballot", async () => {
    const channel = await create("round-picks");
    const ids = await Promise.all([
      suggestion(channel, "Puzzle", "Alice"),
      suggestion(channel, "Puzzle", "Bob"),
      suggestion(channel, "Puzzle", "Carol"),
    ]);
    for (const id of ids) await approve(channel, id);
    const opened = await call("/api/ballots", {
      method: "POST",
      channel,
      cookie: ownerCookie,
      data: { challengeIds: ids, durationSeconds: 60, winnersCount: 1 },
    });
    expect(opened.status).toBe(201);
    const { id } = await opened.json() as any;
    expect((await state(channel)).ballot.winnersCount).toBe(1);
    expect((await (await call(`/api/ballots/${id}/close`, { method: "POST", channel, cookie: ownerCookie })).json() as any).winnerIds).toHaveLength(1);
  });

  it("applies custom voting, scoring, sweep labels, challenger awards, lifecycle history, and streaks", async () => {
    const channel = await create("custom-rules");
    const rules = {
      schemaVersion: 1,
      preset: "custom",
      team: { challengeWinPoints: 77, sessionWinBonus: 0, cleanSweep: { enabled: true, multiplierPercent: 150, label: "Flawless Victory" } },
      challenger: { selectedPoints: 77, defeatedStreamerPoints: 77 },
      voting: { shortlistSize: 3, winnersCount: 2, votesPerViewer: 2, durationSeconds: 300 },
      streaks: { trackChallengeWins: true, trackSessionWins: true, trackCleanSweeps: true, showOnOverlay: true },
    };
    expect((await call("/api/scoring-rules", { method: "PATCH", channel, cookie: ownerCookie, data: { rules } })).status).toBe(200);
    expect((await state(channel)).session.scoringRules.team.challengeWinPoints).toBe(77);

    const alice = await suggestion(channel, "Skate", "Alice");
    const bob = await suggestion(channel, "Skate", "Bob");
    const carol = await suggestion(channel, "Skate", "Carol");
    for (const id of [alice, bob, carol]) await approve(channel, id);
    const opened = await call("/api/ballots", { method: "POST", channel, cookie: ownerCookie, data: { challengeIds: [alice, bob, carol], durationSeconds: 300 } });
    expect(opened.status).toBe(201);
    const { id: ballotId } = await opened.json() as any;
    const { token: voteToken } = await (await call("/api/channel/integration", { method: "POST", channel, cookie: ownerCookie })).json() as any;
    for (const challengeId of [alice, bob]) {
      expect((await call(`/api/ballots/${ballotId}/vote`, { method: "POST", channel, cookie: ownerCookie, data: { challengeId, voterId: "viewer-1" } })).status).toBe(200);
    }
    expect((await call(`/api/ballots/${ballotId}/vote`, { method: "POST", channel, cookie: ownerCookie, data: { challengeId: carol, voterId: "viewer-1" } })).status).toBe(400);
    for (const challengeId of [bob, carol]) expect((await call(`/api/ballots/${ballotId}/vote`, { method: "POST", channel, bearer: voteToken, data: { challengeId, voterId: "twitch:viewer-2" } })).status).toBe(200);
    const closed = await call(`/api/ballots/${ballotId}/close`, { method: "POST", channel, cookie: ownerCookie });
    expect((await closed.json() as any).winnerIds).toEqual([bob, alice]);
    let current = await state(channel);
    expect(current.session.phase).toBe("ready");
    expect(current.ballot).toBeNull();
    expect(current.leaderboard.map((entry: any) => [entry.displayName, entry.points])).toEqual([["Alice", 77], ["Bob", 77]]);

    for (const challengeId of [bob, alice]) {
      expect((await call(`/api/challenges/${challengeId}/start`, { method: "POST", channel, cookie: ownerCookie })).status).toBe(201);
      expect((await call(`/api/challenges/${challengeId}/resolve`, { method: "POST", channel, cookie: ownerCookie, data: { result: "chat_won" } })).status).toBe(200);
    }
    const completed = await call("/api/session/complete", { method: "POST", channel, cookie: ownerCookie });
    expect(await completed.json()).toEqual({ winner: "chat", sweepWinner: "chat" });
    current = await state(channel);
    expect(current.session).toMatchObject({ phase: "complete", streamerScore: 0, chatScore: 231, winner: "chat", sweepWinner: "chat", sweepLabel: "Flawless Victory" });
    expect(current.streaks.chat).toMatchObject({ challenge: { current: 2, best: 2 }, session: { current: 1, best: 1 }, cleanSweep: { current: 1, best: 1, total: 1 } });
    expect(current.leaderboard.map((entry: any) => [entry.displayName, entry.points])).toEqual([["Alice", 154], ["Bob", 154]]);
    expect(current.sessionHistory[0]).toMatchObject({ streamerScore: 0, chatScore: 231, streamerChallengeWins: 0, chatChallengeWins: 2, sweepLabel: "Flawless Victory" });

    expect((await call("/api/sessions", { method: "POST", channel, cookie: ownerCookie })).status).toBe(201);
    current = await state(channel);
    expect(current.session).toMatchObject({ phase: "collecting", streamerScore: 0, chatScore: 0 });
    expect(current.session.scoringRules).toEqual(rules);
    expect(current.sessionHistory).toHaveLength(1);
  });

  it("scopes moderator memberships, one-use invitations, and live access to a channel", async () => {
    const a = await create("mods-a"); const b = await create("mods-b");
    const inviteResponse = await call("/api/auth/mods", { method: "POST", channel: a, cookie: ownerCookie, data: { displayName: "Moderator" } });
    expect(inviteResponse.status).toBe(201);
    const invite = await inviteResponse.json() as any;
    const token = new URLSearchParams(new URL(invite.link).hash.slice(1)).get("token");
    const consumed = await call("/api/auth/invites/consume", { method: "POST", data: { token } });
    expect(consumed.status).toBe(200);
    expect((await call("/api/auth/invites/consume", { method: "POST", data: { token } })).status).toBe(400);
    const modCookie = consumed.headers.get("set-cookie")!.split(";")[0];
    const modChannels = await (await call("/api/channels", { cookie: modCookie })).json() as any;
    expect(modChannels.channels.map((channel: any) => channel.id)).toEqual([a]);
    expect((await call("/api/state", { channel: b, cookie: modCookie })).status).toBe(403);
    expect((await call("/api/v1/live/socket?scope=admin", { channel: b, cookie: modCookie })).status).toBe(403);
    expect((await call("/api/channels", { method: "POST", cookie: modCookie, data: { displayName: "Bad", slug: "bad" } })).status).toBe(403);
    const grant = await call("/api/channel/mods", { method: "POST", channel: b, cookie: ownerCookie, data: { modId: invite.mod.id } });
    const secondInvite = await grant.json() as any;
    expect((await call("/api/state", { channel: b, cookie: modCookie })).status).toBe(200);
    const session = (await state(a)).session.id;
    live.getByName(session);
    let closed = false;
    live.instances.get(session)!.sockets.push({ deserializeAttachment: () => ({ userId: invite.mod.id }), close: () => { closed = true; } });
    expect((await call(`/api/auth/mods/${invite.mod.id}`, { method: "DELETE", channel: a, cookie: ownerCookie })).status).toBe(200);
    expect(closed).toBe(true);
    expect((await call("/api/state", { channel: a, cookie: modCookie })).status).toBe(403);
    expect((await call("/api/state", { channel: b, cookie: modCookie })).status).toBe(200);
    await call(`/api/auth/mods/${invite.mod.id}`, { method: "DELETE", channel: b, cookie: ownerCookie });
    const removedToken = new URLSearchParams(new URL(secondInvite.link).hash.slice(1)).get("token");
    expect((await call("/api/auth/invites/consume", { method: "POST", data: { token: removedToken } })).status).toBe(400);
  });

  it("isolates Durable Object runs and channel integration tokens, including rotation", async () => {
    const a = await create("runs-a"); const b = await create("runs-b");
    const definition = { schemaVersion: 1, title: "Kills", objective: "Count kills", metrics: [{ id: "kills", kind: "counter", label: "Kills" }], rules: {}, countdownSeconds: 0 };
    const first = await (await call("/api/v1/runs", { method: "POST", channel: a, cookie: ownerCookie, data: { definition } })).json() as any;
    const second = await (await call("/api/v1/runs", { method: "POST", channel: b, cookie: ownerCookie, data: { definition } })).json() as any;
    expect(first.run.id).not.toBe(second.run.id);
    const { token } = await (await call("/api/channel/integration", { method: "POST", channel: a, cookie: ownerCookie })).json() as any;
    const data = { source: "game", idempotencyKey: "game:kill-1", event: { type: "metric.incremented", metric: "kills", by: 1 } };
    const report = await call(`/api/v1/runs/${first.run.id}/events`, { method: "POST", channel: a, bearer: token, data });
    expect(report.status).toBe(200);
    expect((await report.json() as any).run.metrics.kills).toBe(1);
    expect((await call(`/api/v1/runs/${second.run.id}/events`, { method: "POST", channel: b, bearer: token, data })).status).toBe(401);
    expect((await call(`/api/v1/runs/${second.run.id}/events`, { method: "POST", channel: a, bearer: token, data })).status).toBe(404);
    expect((await call(`/api/v1/runs/${first.run.id}/events`, { method: "POST", channel: a, bearer: env.INTEGRATION_TOKEN, data })).status).toBe(401);
    expect((await call(`/api/v1/runs/${first.run.id}/events`, { method: "POST", channel: a, bearer: token, data: { ...data, event: { type: "run.voided" } } })).status).toBe(403);
    await call("/api/channel/integration", { method: "POST", channel: a, cookie: ownerCookie });
    expect((await call(`/api/v1/runs/${first.run.id}/events`, { method: "POST", channel: a, bearer: token, data })).status).toBe(401);
    const publicState = JSON.stringify(await (await call("/api/public/state", { channel: a })).json());
    expect(publicState).not.toContain(token);
    expect(publicState).not.toContain("pending_review");
  });
});

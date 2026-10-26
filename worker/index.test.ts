import { describe, expect, it } from "vitest";
import worker from "./index";

const context = { waitUntil: () => undefined } as unknown as ExecutionContext;
const sessionToken = "a".repeat(64);

function fakeDatabase(role: "owner" | "mod" = "owner") {
  return {
    prepare(sql: string) {
      let values: unknown[] = [];
      return {
        bind(...input: unknown[]) { values = input; return this; },
        first: async () => {
          if (sql.includes("auth_sessions s")) return { id: role === "owner" ? "owner" : "mod-1", role, displayName: role, expiresAt: Date.now() + 60_000 };
          if (sql.includes("SELECT c.id AS channelId")) return { channelId: values[0], sessionId: "demo-session" };
          if (sql.includes("FROM channel_memberships")) return { present: 1 };
          return null;
        },
        run: async () => ({ meta: { changes: 1 } }),
      };
    },
    batch: async () => [],
  };
}

describe("creator and moderator access", () => {
  it("locks the control plane while leaving capabilities public", async () => {
    const env = { DB: fakeDatabase(), APP_MODE: "demo" };
    const state = await worker.fetch(new Request("https://creator.example/api/state"), env as never, context);
    expect(state.status).toBe(401);
    const write = await worker.fetch(new Request("https://creator.example/api/challenges", { method: "POST" }), env as never, context);
    expect(write.status).toBe(401);
    const capabilities = await worker.fetch(new Request("https://creator.example/api/v1/capabilities"), env as never, context);
    expect(capabilities.status).toBe(200);
  });

  it("issues an opaque HTTP-only session after owner password login", async () => {
    const env = { DB: fakeDatabase(), OWNER_PASSWORD: "correct horse battery staple" };
    const request = (password: string, origin = "https://creator.example") => new Request("https://creator.example/api/auth/owner/login", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify({ password }),
    });
    expect((await worker.fetch(request("correct horse battery staple", "https://elsewhere.example"), env as never, context)).status).toBe(403);
    expect((await worker.fetch(request("incorrect password"), env as never, context)).status).toBe(401);
    const login = await worker.fetch(request("correct horse battery staple"), env as never, context);
    expect(login.status).toBe(200);
    const cookie = login.headers.get("Set-Cookie") ?? "";
    expect(cookie).toContain("__Host-challenge_session=");
    expect(cookie).toContain("HttpOnly; SameSite=Strict; Path=/");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain(env.OWNER_PASSWORD);
  });

  it("prevents moderators from managing other moderators or changing owner-only surface settings", async () => {
    const env = { DB: fakeDatabase("mod") };
    const headers = { Cookie: `__Host-challenge_session=${sessionToken}`, Origin: "https://creator.example" };
    const mods = await worker.fetch(new Request("https://creator.example/api/auth/mods", { headers }), env as never, context);
    expect(mods.status).toBe(403);
    const theme = await worker.fetch(new Request("https://creator.example/api/theme", { method: "PATCH", headers }), env as never, context);
    expect(theme.status).toBe(403);
    const overlay = await worker.fetch(new Request("https://creator.example/api/overlay-config", { method: "PATCH", headers }), env as never, context);
    expect(overlay.status).toBe(403);
    const session = await worker.fetch(new Request("https://creator.example/api/session-settings", { method: "PATCH", headers }), env as never, context);
    expect(session.status).toBe(403);
    const reset = await worker.fetch(new Request("https://creator.example/api/demo/reset", { method: "POST", headers }), env as never, context);
    expect(reset.status).toBe(403);
    const tokens = await worker.fetch(new Request("https://creator.example/api/channel/api-tokens", { headers }), env as never, context);
    expect(tokens.status).toBe(403);
    const createToken = await worker.fetch(new Request("https://creator.example/api/channel/api-tokens", { method: "POST", headers }), env as never, context);
    expect(createToken.status).toBe(403);
  });

  it("limits integration credentials to metric events", async () => {
    const env = {
      DB: fakeDatabase(),
      INTEGRATION_TOKEN: "adapter-only-token",
      LIVE_SESSIONS: { getByName: () => ({ fetch: () => new Response(JSON.stringify({ accepted: true })) }) },
    };
    const request = (type: string) => new Request("https://creator.example/api/v1/runs/run-1/events", {
      method: "POST",
      headers: { Authorization: "Bearer adapter-only-token", "Content-Type": "application/json" },
      body: JSON.stringify({ source: "game", idempotencyKey: "event-1", event: { type } }),
    });
    const lifecycle = await worker.fetch(request("run.resolved"), env as never, context);
    expect(lifecycle.status).toBe(403);
    const metric = await worker.fetch(request("metric.incremented"), env as never, context);
    expect(metric.status).toBe(200);
    const withoutToken = await worker.fetch(new Request("https://creator.example/api/v1/runs/run-1/events", { method: "POST" }), env as never, context);
    expect(withoutToken.status).toBe(401);
  });
});

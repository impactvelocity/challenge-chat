import { describe, expect, it, vi } from "vitest";
import { ChallengeChatReportError, createChallengeChatReporter } from "../reporter";
import { reportHorrorGameEvent } from "./horror-kills";

const event = { eventId: "match-27-kill-8", type: "enemy_defeated", occurredAt: "2026-10-24T20:00:00.000Z" };

describe("example horror-game adapter", () => {
  it("reports a normalized kill and keeps retries idempotent", async () => {
    const requests: string[] = [];
    const fetchSpy = vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      requests.push(String(init?.body));
      return new Response(JSON.stringify({ run: {}, projection: {}, duplicate: requests.length > 1 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    });
    const fetchImpl = fetchSpy as typeof fetch;
    const reporter = createChallengeChatReporter({ baseUrl: "https://creator.example", source: "horror-game", channelId: "horror-channel", integrationToken: "secret", fetchImpl });
    await reportHorrorGameEvent(reporter, "run-1", event);
    const duplicate = await reportHorrorGameEvent(reporter, "run-1", event);
    expect(duplicate).toMatchObject({ duplicate: true });
    expect(requests).toHaveLength(2);
    expect(JSON.parse(requests[0])).toMatchObject({
      source: "horror-game",
      idempotencyKey: "horror-game:match-27-kill-8",
      event: { type: "metric.incremented", metric: "kills", by: 1 },
    });
    expect(JSON.parse(requests[1]).idempotencyKey).toBe(JSON.parse(requests[0]).idempotencyKey);
    expect(fetchSpy.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(new URL(String(fetchSpy.mock.calls[0][0])).searchParams.get("channel")).toBe("horror-channel");
  });

  it("rejects malformed payloads before publishing", async () => {
    const fetchImpl = vi.fn() as typeof fetch;
    const reporter = createChallengeChatReporter({ baseUrl: "https://creator.example", source: "horror-game", integrationToken: "secret", fetchImpl });
    await expect(reportHorrorGameEvent(reporter, "run-1", { type: "enemy_defeated" })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("surfaces an inactive-run response to the adapter", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ error: "The run is already resolved" }), { status: 400 })) as typeof fetch;
    const reporter = createChallengeChatReporter({ baseUrl: "https://creator.example", source: "horror-game", integrationToken: "secret", fetchImpl });
    await expect(reportHorrorGameEvent(reporter, "run-1", event)).rejects.toBeInstanceOf(ChallengeChatReportError);
  });
});

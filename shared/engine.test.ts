import { describe, expect, it } from "vitest";
import { applyChallengeEvent, createChallengeRun, projectLiveRun } from "./engine";
import { ChallengeDefinitionSchema } from "./framework";

const killChallenge = ChallengeDefinitionSchema.parse({
  schemaVersion: 1,
  title: "Ten Before Midnight",
  objective: "Get ten kills before time expires",
  metrics: [{ id: "kills", kind: "counter", label: "Kills", initial: 0, public: true }],
  rules: {
    success: { type: "compare", metric: "kills", operator: "gte", value: 10 },
    failure: { type: "timer_expired" },
  },
  countdownSeconds: 0,
  timeLimitSeconds: 300,
  verification: "automatic",
  presentation: [
    { component: "progress_bar", metric: "kills", maximum: 10 },
    { component: "countdown" },
  ],
});

describe("headless challenge engine", () => {
  it("resolves a generic counter challenge from normalized events", () => {
    const now = new Date("2026-10-24T20:00:00.000Z");
    let run = createChallengeRun(killChallenge, now);
    run = applyChallengeEvent(killChallenge, run, { type: "metric.incremented", metric: "kills", by: 9 }, now);
    expect(run.status).toBe("active");
    run = applyChallengeEvent(killChallenge, run, { type: "metric.incremented", metric: "kills", by: 1 }, now);
    expect(run.status).toBe("succeeded");
    expect(projectLiveRun(killChallenge, run, now).metrics[0]).toMatchObject({ value: 10, target: 10 });
  });

  it("fails an active timed challenge when its deadline expires", () => {
    const start = new Date("2026-10-24T20:00:00.000Z");
    const run = createChallengeRun(killChallenge, start);
    const expired = applyChallengeEvent(
      killChallenge,
      run,
      { type: "timer.expired" },
      new Date("2026-10-24T20:05:00.000Z"),
    );
    expect(expired.status).toBe("failed");
  });

  it("preserves remaining time while paused and rejects late metrics", () => {
    const start = new Date("2026-10-24T20:00:00.000Z");
    const run = createChallengeRun(killChallenge, start);
    const paused = applyChallengeEvent(killChallenge, run, { type: "run.paused" }, new Date("2026-10-24T20:01:00.000Z"));
    expect(paused.status).toBe("paused");
    const resumed = applyChallengeEvent(killChallenge, paused, { type: "run.resumed" }, new Date("2026-10-24T20:02:00.000Z"));
    expect(resumed.endsAt).toBe("2026-10-24T20:06:00.000Z");
    expect(() => applyChallengeEvent(killChallenge, resumed, { type: "metric.incremented", metric: "kills", by: 1 }, new Date("2026-10-24T20:06:00.000Z"))).toThrow("deadline");
  });

  it("rejects rule and presentation references to invalid metrics", () => {
    const invalid = ChallengeDefinitionSchema.safeParse({
      schemaVersion: 1,
      title: "Invalid",
      objective: "Invalid metric reference",
      metrics: [{ id: "secret", kind: "counter", label: "Secret", initial: 0, public: false }],
      rules: { success: { type: "compare", metric: "missing", operator: "gte", value: 1 } },
      presentation: [{ component: "counter", metric: "secret" }],
    });
    expect(invalid.success).toBe(false);
  });
});

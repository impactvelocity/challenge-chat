import { describe, expect, it, vi } from "vitest";
import { fallbackParseChallenge, generateRoundName, parseChallenge } from "./parser";

describe("fallbackParseChallenge", () => {
  it("rejects punctuation/case-only repeats without another model call", async () => {
    const run = vi.fn(async () => ({ choices: [{ message: { content: JSON.stringify({ name: "PISTOLS AT DAWN!!!" }) } }] }));
    const result = await generateRoundName([{ title: "Pistol Purist", objective: "Use pistols", game: "Fortnite" }], "hype", { AI: { run } }, ["Pistols at Dawn", "Pistol Purist Gauntlet"]);
    expect(result.name).toBe("Pistol Purist Gauntlet Remix");
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("extracts the core primitives from a messy viewer request", () => {
    const result = fallbackParseChallenge(
      "Do five kickflips in a row on the waterslide, three attempts, in 90 seconds",
      "Skate",
    );

    expect(result.game).toBe("Skate");
    expect(result.timeLimitSeconds).toBe(90);
    expect(result.maxAttempts).toBe(3);
    expect(result.targets[0]).toMatchObject({ value: 5, requiresStreak: true });
    expect(result.needsReview).toBe(true);
  });

  it("recognizes one-shot challenges", () => {
    expect(fallbackParseChallenge("Win the round, one shot attempt", "Fortnite").maxAttempts).toBe(1);
  });

  it("routes challenge cleanup through the configured AI Gateway", async () => {
    const calls: unknown[][] = [];
    const fallback = fallbackParseChallenge("get 3 elimz with pistl only", "Fortnite");
    const result = await parseChallenge("get 3 elimz with pistl only", "Fortnite", {
      AI_MODEL: "openai/test-model",
      AI_GATEWAY_ID: "challenge-chat",
      AI: {
        run: async (...args: unknown[]) => {
          calls.push(args);
          return { choices: [{ message: { content: JSON.stringify({ ...fallback, title: "Pistol Purist", objective: "Get 3 eliminations using pistols only." }) } }] };
        },
      },
    });

    expect(result.parserStatus).toBe("ai");
    expect(result.challenge).toMatchObject({ title: "Pistol Purist", objective: "Get 3 eliminations using pistols only.", rawText: "get 3 elimz with pistl only" });
    expect(calls[0]?.[0]).toBe("openai/test-model");
    expect(calls[0]?.[2]).toMatchObject({ gateway: { id: "challenge-chat", skipCache: true, collectLog: true } });
  });

  it("uses AI Gateway for round naming and falls back safely", async () => {
    const challenges = [{ title: "Pistol Purist", objective: "Use pistols only", game: "Fortnite" }];
    const named = await generateRoundName(challenges, "hype", {
      AI: { run: async () => ({ choices: [{ message: { content: JSON.stringify({ name: "Pistols at Dawn" }) } }] }) },
    });
    expect(named).toEqual({ name: "Pistols at Dawn", generatorStatus: "ai" });

    const fallback = await generateRoundName(challenges, "hype", {
      AI: { run: async () => { throw new Error("offline"); } },
    });
    expect(fallback).toEqual({ name: "Pistol Purist Gauntlet", generatorStatus: "fallback" });
  });
});

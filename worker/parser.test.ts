import { describe, expect, it } from "vitest";
import { fallbackParseChallenge } from "./parser";

describe("fallbackParseChallenge", () => {
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
});

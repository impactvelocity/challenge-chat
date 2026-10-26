import { describe, expect, it } from "vitest";
import { OverlayConfigSchema, SessionSettingsSchema } from "./surface-config";

describe("surface configuration", () => {
  it("accepts primitive per-theme settings and rejects executable or nested values", () => {
    expect(OverlayConfigSchema.parse({
      theme: "creator-neon",
      settings: { "creator-neon": { glow: true, intensity: 0.8, accent: "#ff4d2e", image: null } },
      elements: { scoreboard: true, "hype-meter": false },
    }).theme).toBe("creator-neon");

    expect(() => OverlayConfigSchema.parse({
      theme: "broadcast",
      settings: { broadcast: { unsafe: { expression: "window.alert(1)" } } },
      elements: {},
    })).toThrow();
    expect(() => OverlayConfigSchema.parse({ theme: "../theme", settings: {}, elements: {} })).toThrow();
  });

  it("bounds session timing and Twitch login values", () => {
    const valid = { autoNext: true, autoNextSecs: 45, aiTitles: false, aiParsing: true, aiChallengeTitles: true, aiRoundNameTone: "playful" as const, publicPage: true, twitchLogin: "night_shift" };
    expect(SessionSettingsSchema.parse(valid)).toEqual(valid);
    expect(() => SessionSettingsSchema.parse({ ...valid, autoNextSecs: 4 })).toThrow();
    expect(() => SessionSettingsSchema.parse({ ...valid, twitchLogin: "not a login" })).toThrow();
  });
});

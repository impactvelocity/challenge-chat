import { describe, expect, it } from "vitest";
import type { AppState } from "./contracts";
import { projectOverlayState } from "./public-state";

describe("public overlay state", () => {
  it("omits moderation and creator-only data", () => {
    const state = {
      session: { streamerScore: 2, chatScore: 1 },
      activeRound: null,
      challenges: [{ id: "private-draft", title: "Secret", status: "pending_review", rawText: "private suggestion" }],
      ballot: null,
      theme: { preset: "arcade", primary: "#ff4d2e" },
      leaderboard: [{ displayName: "Creator", points: 3 }],
      channel: { displayName: "Creator" },
    } as unknown as AppState;

    const publicState = projectOverlayState(state);
    expect(publicState.session).toEqual({ streamerScore: 2, chatScore: 1 });
    expect(publicState.activeChallenge).toBeNull();
    expect(JSON.stringify(publicState)).not.toContain("private suggestion");
    expect(publicState.leaderboard).toEqual([{ displayName: "Creator", points: 3 }]);
    expect(JSON.stringify(publicState)).not.toContain("pending_review");
  });
});

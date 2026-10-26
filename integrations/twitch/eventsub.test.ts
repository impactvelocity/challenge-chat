import { describe, expect, it } from "vitest";
import { normalizeTwitchEvent } from "./eventsub";

const metadata = { messageId: "eventsub-message-1", occurredAt: "2026-10-26T20:00:00.000Z" };
const chatter = {
  broadcaster_user_id: "broadcaster-1",
  chatter_user_id: "viewer-1",
  chatter_user_login: "alice",
  chatter_user_name: "Alice",
  message_id: "chat-message-1",
};

describe("Twitch EventSub normalization", () => {
  it("maps challenge and vote commands to the smallest trusted facts", () => {
    expect(normalizeTwitchEvent("channel.chat.message", { ...chatter, message: { text: "!challenge Win without healing" } }, metadata)).toEqual([{
      type: "challenge.submitted",
      text: "Win without healing",
      author: { id: "twitch:viewer-1", login: "alice", displayName: "Alice" },
    }]);
    expect(normalizeTwitchEvent("channel.chat.message", { ...chatter, message: { text: "!vote 2" } }, metadata)).toEqual([{
      type: "ballot.vote",
      position: 2,
      voterId: "twitch:viewer-1",
    }]);
  });

  it("ignores ordinary chat and malformed or inactive-position commands", () => {
    for (const text of ["hello chat", "!challenge", "!vote", "!vote 0", "!vote 999", "!vote two"]) {
      expect(normalizeTwitchEvent("channel.chat.message", { ...chatter, message: { text } }, metadata)).toEqual([]);
    }
    expect(() => normalizeTwitchEvent("channel.chat.message", { message: { text: "!vote 1" } }, metadata)).toThrow();
  });

  it("normalizes public overlay moments without provider payload leakage", () => {
    expect(normalizeTwitchEvent("channel.follow", { user_name: "Bob", followed_at: metadata.occurredAt }, metadata)).toEqual([{
      type: "twitch.moment",
      moment: { kind: "follow", user: "Bob", occurredAt: metadata.occurredAt, providerEventId: metadata.messageId },
    }]);
    expect(normalizeTwitchEvent("channel.cheer", { user_name: "Carol", is_anonymous: false, bits: 500 }, metadata)).toEqual([{
      type: "twitch.moment",
      moment: { kind: "cheer", user: "Carol", amount: 500, occurredAt: metadata.occurredAt, providerEventId: metadata.messageId },
    }]);
  });
});

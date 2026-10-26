export type MockChatCommand =
  | { type: 'challenge'; text: string }
  | { type: 'vote'; position: number }
  | { type: 'message'; text: string }
  | { type: 'invalid'; error: string };

/** Parses the small command vocabulary supported by the local developer chat. */
export function parseMockChatMessage(input: string): MockChatCommand {
  const text = input.trim();
  const challenge = text.match(/^!challenge(?:\s+(.*))?$/i);
  if (challenge) {
    const idea = challenge[1]?.trim();
    return idea ? { type: 'challenge', text: idea } : { type: 'invalid', error: 'Add an idea after !challenge' };
  }

  const vote = text.match(/^!vote(?:\s+(.*))?$/i);
  if (vote) {
    const position = Number(vote[1]);
    return Number.isInteger(position) && position > 0
      ? { type: 'vote', position }
      : { type: 'invalid', error: 'Use !vote followed by a positive number' };
  }

  // A real Twitch channel contains bot commands for many tools. Anything other
  // than Challenge.chat's two commands stays ordinary chat and never hits the Worker.
  return { type: 'message', text };
}

/** Stable within a ballot, so repeated messages behave like one real viewer. */
export function mockViewerId(displayName: string): string {
  const normalized = displayName.toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return `dev:${normalized || 'viewer'}`;
}

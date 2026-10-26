import { describe, expect, it } from 'vitest';
import { mockViewerId, parseMockChatMessage } from './mock-chat';

describe('mock chat commands', () => {
  it('parses challenge, vote, and ordinary chat messages', () => {
    expect(parseMockChatMessage(' !challenge  Win without healing ')).toEqual({ type: 'challenge', text: 'Win without healing' });
    expect(parseMockChatMessage('!VOTE 2')).toEqual({ type: 'vote', position: 2 });
    expect(parseMockChatMessage('hello chat')).toEqual({ type: 'message', text: 'hello chat' });
  });

  it('rejects malformed supported commands and ignores unrelated bot commands', () => {
    expect(parseMockChatMessage('!challenge')).toEqual({ type: 'invalid', error: 'Add an idea after !challenge' });
    expect(parseMockChatMessage('!vote 0')).toEqual({ type: 'invalid', error: 'Use !vote followed by a positive number' });
    expect(parseMockChatMessage('!ban viewer')).toEqual({ type: 'message', text: '!ban viewer' });
  });

  it('creates a stable, bounded mock viewer id', () => {
    expect(mockViewerId('Test Viewer')).toBe('dev:test-viewer');
    expect(mockViewerId('***')).toBe('dev:viewer');
    expect(mockViewerId('A'.repeat(200)).length).toBeLessThanOrEqual(84);
  });
});

import { describe, expect, it } from 'vitest';
import type { ChannelSummary } from '../../shared/channels';
import { creatorEntry } from './creator-entry';

const draft: ChannelSummary = { id: 'demo-channel', displayName: 'Default', slug: 'default', setupComplete: false };
const first: ChannelSummary = { id: 'first-board', displayName: 'First', slug: 'first', setupComplete: true };
const second: ChannelSummary = { id: 'second-board', displayName: 'Second', slug: 'second', setupComplete: true };
const location = (pathname = '/', search = '', hash = '') => ({ pathname, search, hash });

describe('creator entry after authentication', () => {
  it('opens the first completed board instead of the unfinished seeded board', () => {
    expect(creatorEntry([draft, first, second], location())).toEqual({
      channelId: first.id, setupRequired: false, redirectTo: '/?channel=first-board',
    });
  });

  it('leaves setup after login when a completed board exists, even with the default channel query', () => {
    expect(creatorEntry([draft, first], location('/setup', '?channel=demo-channel')).redirectTo)
      .toBe('/?channel=first-board');
  });

  it('keeps an explicitly selected completed board and its route', () => {
    expect(creatorEntry([draft, first, second], location('/settings/ai', '?channel=second-board')))
      .toEqual({ channelId: second.id, setupRequired: false, redirectTo: null });
    expect(creatorEntry([first, second], location('/setup', '?channel=second-board')).redirectTo)
      .toBe('/?channel=second-board');
  });

  it('recovers a stale or inaccessible board link using only the accessible board list', () => {
    expect(creatorEntry([second], location('/', '?channel=deleted-board')).redirectTo)
      .toBe('/?channel=second-board');
  });

  it('keeps first-time creators in setup until they have a completed board', () => {
    expect(creatorEntry([draft], location()).redirectTo).toBe('/setup?channel=demo-channel');
    expect(creatorEntry([draft], location('/setup', '?channel=demo-channel')))
      .toEqual({ channelId: draft.id, setupRequired: true, redirectTo: null });
    expect(creatorEntry([], location()).setupRequired).toBe(true);
  });

  it('preserves deep links, unrelated query parameters, and fragments', () => {
    expect(creatorEntry([first], location('/overlay/studio', '?preview=1', '#theme')).redirectTo)
      .toBe('/overlay/studio?preview=1&channel=first-board#theme');
  });
});

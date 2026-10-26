import { DEFAULT_CHANNEL_ID, type ChannelSummary } from '../../shared/channels';

/** Resolve an accessible board before loading any board-scoped creator state. */
export function creatorEntry(
  channels: ChannelSummary[],
  location: { pathname: string; search: string; hash: string },
) {
  const query = new URLSearchParams(location.search);
  const requested = channels.find((channel) => channel.id === query.get('channel'));
  // The seeded, unfinished default board must not hide an existing creator board.
  const selected = (requested?.setupComplete ? requested : undefined)
    ?? channels.find((channel) => channel.setupComplete)
    ?? requested
    ?? channels[0];
  const channelId = selected?.id ?? DEFAULT_CHANNEL_ID;
  const setupRequired = !selected?.setupComplete;
  const pathname = setupRequired ? '/setup' : location.pathname === '/setup' ? '/' : location.pathname;
  query.set('channel', channelId);
  const destination = `${pathname}?${query}${location.hash}`;
  const current = `${location.pathname}${location.search}${location.hash}`;
  return { channelId, setupRequired, redirectTo: destination === current ? null : destination };
}

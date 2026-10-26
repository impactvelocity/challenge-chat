/** A video the canvas can play behind the overlay: the player URL and what it is, in a few words. */
export type Embed = { src: string; label: string };

/**
 * A Twitch channel, VOD or clip link, or a YouTube video or live link, as a muted autoplaying player.
 * Twitch only plays inside pages it's told about, so `parent` is this page's hostname. Null for anything else.
 */
export function embedFor(input: string, { sound = false, parent = window.location.hostname } = {}): Embed | null {
  const raw = input.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m)\./, '');
  const path = url.pathname.split('/').filter(Boolean);

  const twitch = (params: Record<string, string>, label: string) => ({
    src: `https://player.twitch.tv/?${new URLSearchParams({ ...params, parent, autoplay: 'true', muted: String(!sound) })}`,
    label,
  });
  const clip = (slug: string) => ({
    src: `https://clips.twitch.tv/embed?${new URLSearchParams({ clip: slug, parent, autoplay: 'true', muted: String(!sound) })}`,
    label: 'Twitch clip',
  });
  const youtube = (id: string) => {
    const start = parseInt(url.searchParams.get('t') ?? url.searchParams.get('start') ?? '', 10);
    const params = new URLSearchParams({ autoplay: '1', mute: sound ? '0' : '1', controls: '0', loop: '1', playlist: id, playsinline: '1', rel: '0', iv_load_policy: '3', cc_load_policy: '0' });
    if (start > 0) params.set('start', String(start));
    return { src: `https://www.youtube-nocookie.com/embed/${id}?${params}`, label: 'YouTube video' };
  };

  if (host === 'youtu.be' && path[0]) return youtube(path[0]);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id = url.searchParams.get('v') ?? (['live', 'shorts', 'embed'].includes(path[0]) ? path[1] : null);
    if (id) return youtube(id);
  }
  if (host === 'clips.twitch.tv' && path[0]) return clip(path[0]);
  if (host === 'twitch.tv') {
    if (path[0] === 'videos' && path[1]) return twitch({ video: path[1] }, 'Twitch VOD');
    if (path[1] === 'clip' && path[2]) return clip(path[2]);
    if (path[0]) return twitch({ channel: path[0] }, `Twitch · ${path[0]}`);
  }
  return null;
}

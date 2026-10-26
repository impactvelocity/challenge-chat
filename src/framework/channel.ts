import { DEFAULT_CHANNEL_ID } from "../../shared/channels";

export function selectedChannelId(): string {
  return new URLSearchParams(window.location.search).get("channel") || DEFAULT_CHANNEL_ID;
}

/** Explicit channel routing works for custom surfaces, browser sources, and API calls. */
export function channelPath(path: string, channelId = selectedChannelId()): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("channel", channelId);
  return `${url.pathname}${url.search}${url.hash}`;
}

import { z } from "zod";

export const DEFAULT_CHANNEL_ID = "demo-channel";
export const ChannelInputSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens"),
});
export const ChannelCreateInputSchema = ChannelInputSchema.extend({
  twitchLogin: z.string().trim().min(1).max(25).regex(/^[a-zA-Z0-9_]+$/, "Use a Twitch channel name"),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export interface ChannelSummary {
  id: string;
  displayName: string;
  slug: string;
  setupComplete: boolean;
}
export interface ChannelScope {
  channelId: string;
  sessionId: string;
}

import { z } from "zod";

export const DEFAULT_CHANNEL_ID = "demo-channel";
export const TWITCH_LOGIN_MIN_LENGTH = 4;
export const TWITCH_LOGIN_MAX_LENGTH = 25;
export const TwitchLoginSchema = z.string().trim()
  .min(TWITCH_LOGIN_MIN_LENGTH, `Twitch channel names need at least ${TWITCH_LOGIN_MIN_LENGTH} characters`)
  .max(TWITCH_LOGIN_MAX_LENGTH, `Twitch channel names can be at most ${TWITCH_LOGIN_MAX_LENGTH} characters`)
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, or underscores");
export const ChannelInputSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens"),
});
export const ChannelCreateInputSchema = ChannelInputSchema.extend({
  twitchLogin: TwitchLoginSchema,
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

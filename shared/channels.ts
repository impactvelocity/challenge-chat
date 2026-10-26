import { z } from "zod";

export const DEFAULT_CHANNEL_ID = "demo-channel";
export const ChannelInputSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens"),
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

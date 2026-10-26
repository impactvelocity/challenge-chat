import { z } from "zod";

export const TWITCH_REQUIRED_SCOPES = [
  "user:read:chat",
  "user:bot",
  "channel:bot",
  "moderator:read:followers",
  "bits:read",
] as const;

export const TwitchMomentSchema = z.object({
  kind: z.enum(["follow", "sub", "gift", "raid", "cheer"]),
  user: z.string().min(1).max(80),
  amount: z.number().int().nonnegative().optional(),
  occurredAt: z.string().datetime(),
  providerEventId: z.string().min(1).max(200),
});

export type TwitchMoment = z.infer<typeof TwitchMomentSchema>;

export interface TwitchSubscriptionStatus {
  id: string;
  type: string;
  status: string;
}

export interface TwitchConnectionStatus {
  configuration: {
    ready: boolean;
    missing: string[];
    source: "database" | "worker" | "none";
    clientId: string;
    applicationUrl: string;
    callbackUrl: string;
    eventsubUrl: string;
    requiredScopes: string[];
  };
  connection: null | {
    broadcasterUserId: string;
    broadcasterLogin: string;
    broadcasterDisplayName: string;
    status: string;
    connectedAt: number;
    lastEventAt: number | null;
    lastError: string | null;
    scopes: string[];
    subscriptions: TwitchSubscriptionStatus[];
  };
}

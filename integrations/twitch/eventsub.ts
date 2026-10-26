import { z } from "zod";
import type { TwitchMoment } from "../../shared/twitch";

const ChatMessageEventSchema = z.object({
  broadcaster_user_id: z.string().min(1),
  chatter_user_id: z.string().min(1),
  chatter_user_login: z.string().min(1),
  chatter_user_name: z.string().min(1),
  message_id: z.string().min(1),
  message: z.object({ text: z.string() }),
});

const FollowEventSchema = z.object({
  user_name: z.string().min(1),
  followed_at: z.string().datetime(),
});

const CheerEventSchema = z.object({
  user_name: z.string().nullable().optional(),
  is_anonymous: z.boolean().optional(),
  bits: z.number().int().nonnegative(),
});

const ChatNotificationEventSchema = z.object({
  chatter_user_name: z.string().nullable().optional(),
  notice_type: z.string(),
  sub: z.object({ sub_tier: z.string().optional(), is_prime: z.boolean().optional(), duration_months: z.number().int().optional() }).nullable().optional(),
  resub: z.object({ cumulative_months: z.number().int().optional(), duration_months: z.number().int().optional() }).nullable().optional(),
  sub_gift: z.object({ duration_months: z.number().int().optional() }).nullable().optional(),
  community_sub_gift: z.object({ total: z.number().int().optional() }).nullable().optional(),
  raid: z.object({ user_name: z.string().optional(), viewer_count: z.number().int().optional() }).nullable().optional(),
}).passthrough();

export type TwitchFact =
  | {
      type: "challenge.submitted";
      text: string;
      author: { id: string; login: string; displayName: string };
    }
  | {
      type: "ballot.vote";
      position: number;
      voterId: string;
    }
  | { type: "twitch.moment"; moment: TwitchMoment };

function moment(kind: TwitchMoment["kind"], user: string | null | undefined, amount: number | undefined, occurredAt: string, providerEventId: string): TwitchFact {
  return {
    type: "twitch.moment",
    moment: {
      kind,
      user: user?.trim() || "Anonymous",
      ...(amount === undefined ? {} : { amount }),
      occurredAt,
      providerEventId,
    },
  };
}

/** Map provider payloads to bounded facts; this adapter never mutates board or overlay state. */
export function normalizeTwitchEvent(
  subscriptionType: string,
  payload: unknown,
  metadata: { messageId: string; occurredAt: string },
): TwitchFact[] {
  if (subscriptionType === "channel.chat.message") {
    const event = ChatMessageEventSchema.parse(payload);
    const text = event.message.text.trim();
    const challenge = text.match(/^!challenge(?:\s+(.+))?$/i);
    if (challenge) {
      const request = challenge[1]?.trim();
      if (!request) return [];
      return [{
        type: "challenge.submitted",
        text: request.slice(0, 500),
        author: {
          id: `twitch:${event.chatter_user_id}`,
          login: event.chatter_user_login.slice(0, 40),
          displayName: event.chatter_user_name.slice(0, 40),
        },
      }];
    }
    const vote = text.match(/^!vote\s+(\d+)$/i);
    if (vote) {
      const position = Number(vote[1]);
      if (!Number.isSafeInteger(position) || position < 1 || position > 10) return [];
      return [{ type: "ballot.vote", position, voterId: `twitch:${event.chatter_user_id}` }];
    }
    return [];
  }

  if (subscriptionType === "channel.follow") {
    const event = FollowEventSchema.parse(payload);
    return [moment("follow", event.user_name, undefined, event.followed_at, metadata.messageId)];
  }

  if (subscriptionType === "channel.cheer") {
    const event = CheerEventSchema.parse(payload);
    return [moment("cheer", event.is_anonymous ? "Anonymous" : event.user_name, event.bits, metadata.occurredAt, metadata.messageId)];
  }

  if (subscriptionType === "channel.chat.notification") {
    const event = ChatNotificationEventSchema.parse(payload);
    if (event.notice_type === "sub") {
      return [moment("sub", event.chatter_user_name, event.sub?.duration_months ?? 1, metadata.occurredAt, metadata.messageId)];
    }
    if (event.notice_type === "resub") {
      return [moment("sub", event.chatter_user_name, event.resub?.cumulative_months ?? event.resub?.duration_months ?? 1, metadata.occurredAt, metadata.messageId)];
    }
    if (event.notice_type === "sub_gift") {
      return [moment("gift", event.chatter_user_name, 1, metadata.occurredAt, metadata.messageId)];
    }
    if (event.notice_type === "community_sub_gift") {
      return [moment("gift", event.chatter_user_name, event.community_sub_gift?.total ?? 1, metadata.occurredAt, metadata.messageId)];
    }
    if (event.notice_type === "raid") {
      return [moment("raid", event.raid?.user_name ?? event.chatter_user_name, event.raid?.viewer_count ?? 0, metadata.occurredAt, metadata.messageId)];
    }
  }

  return [];
}

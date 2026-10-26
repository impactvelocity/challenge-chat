import { z } from "zod";
import { createChallengeChatReporter } from "../reporter";

/** Example provider payload. Replace this schema/mapping for a specific game's actual API. */
export const HorrorGameEventSchema = z.object({
  eventId: z.string().min(1).max(160),
  type: z.enum(["enemy_defeated", "player_died"]),
  occurredAt: z.string().datetime(),
});

export async function reportHorrorGameEvent(
  reporter: ReturnType<typeof createChallengeChatReporter>,
  runId: string,
  payload: unknown,
) {
  const event = HorrorGameEventSchema.parse(payload);
  if (event.type !== "enemy_defeated") return { ignored: true as const };
  return reporter.report(runId, event.eventId, { type: "metric.incremented", metric: "kills", by: 1 }, event.occurredAt);
}

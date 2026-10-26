import { ChallengeDefinitionSchema } from "../../shared/framework";

export const KILL_CHALLENGE_EXAMPLE = ChallengeDefinitionSchema.parse({
  schemaVersion: 1,
  title: "Ten Before Midnight",
  objective: "Get ten kills before the timer expires",
  metrics: [{ id: "kills", kind: "counter", label: "Kills", initial: 0, public: true }],
  rules: {
    success: { type: "compare", metric: "kills", operator: "gte", value: 10 },
    failure: { type: "timer_expired" },
  },
  countdownSeconds: 3,
  timeLimitSeconds: 300,
  verification: "automatic",
  presentation: [
    { component: "progress_bar", metric: "kills", maximum: 10 },
    { component: "countdown" },
  ],
});

import { z } from "zod";

export const scoringPresetValues = ["classic", "arcade", "custom"] as const;

export const ScoringRulesSchema = z.object({
  schemaVersion: z.literal(1),
  preset: z.enum(scoringPresetValues),
  team: z.object({
    challengeWinPoints: z.number().int().min(0).max(1_000_000),
    sessionWinBonus: z.number().int().min(0).max(1_000_000),
    cleanSweep: z.object({
      enabled: z.boolean(),
      multiplierPercent: z.number().int().min(100).max(1000),
      label: z.string().trim().min(1).max(40),
    }),
  }),
  challenger: z.object({
    selectedPoints: z.number().int().min(0).max(1_000_000),
    defeatedStreamerPoints: z.number().int().min(0).max(1_000_000),
  }),
  voting: z.object({
    shortlistSize: z.number().int().min(2).max(10),
    winnersCount: z.number().int().min(1).max(10),
    votesPerViewer: z.number().int().min(1).max(5),
    durationSeconds: z.number().int().min(10).max(900),
  }),
  streaks: z.object({
    trackChallengeWins: z.boolean(),
    trackSessionWins: z.boolean(),
    trackCleanSweeps: z.boolean(),
    showOnOverlay: z.boolean(),
  }),
}).superRefine((rules, context) => {
  if (rules.voting.winnersCount >= rules.voting.shortlistSize) {
    context.addIssue({ code: "custom", path: ["voting", "winnersCount"], message: "Final challenges must be fewer than shortlisted challenges" });
  }
  if (rules.voting.votesPerViewer > rules.voting.shortlistSize) {
    context.addIssue({ code: "custom", path: ["voting", "votesPerViewer"], message: "Votes per viewer cannot exceed the shortlist" });
  }
});

export type ScoringRules = z.infer<typeof ScoringRulesSchema>;
export type ScoringPreset = (typeof scoringPresetValues)[number];

const shared = {
  schemaVersion: 1 as const,
  voting: { shortlistSize: 10, winnersCount: 5, votesPerViewer: 3, durationSeconds: 600 },
  streaks: { trackChallengeWins: true, trackSessionWins: true, trackCleanSweeps: true, showOnOverlay: true },
};

export const CLASSIC_SCORING_RULES: ScoringRules = {
  ...shared,
  preset: "classic",
  team: { challengeWinPoints: 1, sessionWinBonus: 0, cleanSweep: { enabled: false, multiplierPercent: 150, label: "Clean Sweep" } },
  challenger: { selectedPoints: 1, defeatedStreamerPoints: 1 },
};

export const ARCADE_SCORING_RULES: ScoringRules = {
  ...shared,
  preset: "arcade",
  team: { challengeWinPoints: 100, sessionWinBonus: 0, cleanSweep: { enabled: false, multiplierPercent: 150, label: "Clean Sweep" } },
  challenger: { selectedPoints: 100, defeatedStreamerPoints: 100 },
};

export function scoringPreset(preset: Exclude<ScoringPreset, "custom">): ScoringRules {
  return structuredClone(preset === "classic" ? CLASSIC_SCORING_RULES : ARCADE_SCORING_RULES);
}

export function parseScoringRules(value: unknown, fallback: ScoringRules = ARCADE_SCORING_RULES): ScoringRules {
  const parsed = ScoringRulesSchema.safeParse(value);
  return parsed.success ? parsed.data : structuredClone(fallback);
}

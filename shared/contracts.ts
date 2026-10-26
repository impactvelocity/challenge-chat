import { z } from "zod";
import type { ScoringRules } from "./scoring";
import type { OverlayConfig, SessionSettings } from "./surface-config";

export const CHALLENGE_COUNTDOWN_SECONDS = 10;

export const difficultyValues = ["easy", "medium", "hard", "ridiculous"] as const;
export const verificationValues = ["moderator", "streamer", "chat-review"] as const;
export const challengeStatusValues = [
  "inbox",
  "pending_review",
  "approved",
  "voting",
  "queued",
  "active",
  "streamer_won",
  "chat_won",
  "skipped",
  "voided",
  "rejected",
] as const;

export const ChallengeContextSchema = z.object({
  scope: z.enum(["game", "match", "round", "run", "level", "map", "location", "other"]),
  label: z.string().max(120),
});

export const ChallengeTargetSchema = z.object({
  label: z.string().max(120),
  value: z.number().int().min(1).max(999),
  comparison: z.enum(["exactly", "at_least", "at_most"]),
  requiresStreak: z.boolean(),
});

export const ChallengeConstraintSchema = z.object({
  kind: z.enum(["loadout", "technique", "movement", "location", "input", "sequence", "other"]),
  label: z.string().max(180),
});

export const ChallengeDraftSchema = z.object({
  schemaVersion: z.literal(1),
  rawText: z.string().min(1).max(500),
  title: z.string().min(1).max(64),
  objective: z.string().min(1).max(240),
  game: z.string().max(100).nullable(),
  context: ChallengeContextSchema.nullable(),
  targets: z.array(ChallengeTargetSchema).max(4),
  constraints: z.array(ChallengeConstraintSchema).max(8),
  timeLimitSeconds: z.number().int().min(5).max(3600).nullable(),
  maxAttempts: z.number().int().min(1).max(99).nullable(),
  failureConditions: z.array(z.string().max(180)).max(6),
  difficulty: z.enum(difficultyValues),
  verificationMode: z.enum(verificationValues),
  warnings: z.array(z.string().max(180)).max(6),
  needsReview: z.boolean(),
});

export const ThemeSchema = z.object({
  preset: z.enum(["broadcast", "arcade", "neon"]),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  success: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  failure: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  density: z.enum(["compact", "cinematic"]),
  motion: z.enum(["snap", "slide", "slam"]),
  logoUrl: z.string().max(500).nullable(),
  frameUrl: z.string().max(500).nullable(),
  control: z
    .object({
      background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      panel: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      panelElevated: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      muted: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      border: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      radius: z.enum(["square", "soft", "round"]),
    })
    .optional(),
});

export const DEFAULT_CONTROL_THEME = {
  background: "#0d0e10",
  panel: "#111216",
  panelElevated: "#1a1b20",
  text: "#f4f1e8",
  muted: "#8f9198",
  border: "#34363b",
  radius: "square",
} as const;

export const DEFAULT_THEME: Theme = {
  preset: "arcade",
  primary: "#ff4d2e",
  accent: "#e7ff3c",
  success: "#58f29b",
  failure: "#ff4d6d",
  density: "cinematic",
  motion: "slam",
  logoUrl: null,
  frameUrl: null,
  control: DEFAULT_CONTROL_THEME,
};

export type ChallengeDraft = z.infer<typeof ChallengeDraftSchema>;
export type ChallengeStatus = (typeof challengeStatusValues)[number];
export type Theme = z.infer<typeof ThemeSchema>;

export interface Challenge extends ChallengeDraft {
  id: string;
  authorId: string;
  authorLogin: string;
  authorDisplayName: string;
  status: ChallengeStatus;
  roundValue: number;
  parserStatus: "ai" | "fallback";
  createdAt: string;
  voteCount: number;
}

export interface ActiveRound {
  id: string;
  challengeId: string;
  status: "active" | "resolved";
  startedAt: string;
  endsAt: string | null;
  attemptsUsed: number;
  result: "streamer_won" | "chat_won" | null;
}

export interface BallotEntry {
  challenge: Challenge;
  position: number;
  votes: number;
}

export interface Ballot {
  id: string;
  status: "open" | "closed";
  endsAt: string;
  winnersCount: number;
  votesPerViewer: number;
  entries: BallotEntry[];
}

export type ContestSide = "streamer" | "chat";
export type SessionPhase = "collecting" | "voting" | "ready" | "live" | "complete";

export interface SideStreaks {
  challenge: { current: number; best: number };
  session: { current: number; best: number };
  cleanSweep: { current: number; best: number; total: number };
}

export interface SessionHistoryEntry {
  id: string;
  streamerScore: number;
  chatScore: number;
  streamerChallengeWins: number;
  chatChallengeWins: number;
  winner: ContestSide | null;
  sweepWinner: ContestSide | null;
  sweepLabel: string | null;
  completedAt: string | null;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  points: number;
}

export interface AppState {
  mode: "demo" | "live";
  channel: {
    id: string;
    displayName: string;
    broadcasterLogin: string;
    slug: string;
    setupComplete: boolean;
    scoringRules: ScoringRules;
  };
  session: {
    id: string;
    status: "live" | "ended";
    streamerScore: number;
    chatScore: number;
    mode: "open_queue" | "blitz" | "hype";
    phase: SessionPhase;
    submissionsOpen: boolean;
    scoringRules: ScoringRules;
    winner: ContestSide | null;
    sweepWinner: ContestSide | null;
    sweepLabel: string | null;
  };
  challenges: Challenge[];
  activeRound: ActiveRound | null;
  ballot: Ballot | null;
  leaderboard: LeaderboardEntry[];
  streaks: Record<ContestSide, SideStreaks>;
  sessionHistory: SessionHistoryEntry[];
  overallScore: { streamer: number; chat: number; streamerSessionWins: number; chatSessionWins: number };
  theme: Theme;
  overlayConfig: OverlayConfig;
  sessionSettings: SessionSettings;
}

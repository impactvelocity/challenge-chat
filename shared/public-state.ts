import type { ActiveRound, AppState, Ballot, Challenge, Theme } from "./contracts";
import { DEFAULT_OVERLAY_CONFIG, type OverlayConfig } from "./surface-config";

export type PublicChallenge = Pick<
  Challenge,
  "id" | "title" | "objective" | "authorLogin" | "maxAttempts" | "roundValue" | "status" | "difficulty" | "timeLimitSeconds" | "game"
>;

export type PublicSubmission = Pick<
  Challenge,
  "id" | "title" | "objective" | "authorLogin" | "maxAttempts" | "roundValue" | "difficulty" | "timeLimitSeconds" | "game" | "createdAt"
>;

export interface PublicOverlayState {
  channel: Pick<AppState["channel"], "id" | "displayName" | "broadcasterLogin">;
  session: Pick<AppState["session"], "id" | "name" | "streamerScore" | "chatScore" | "phase" | "submissionsOpen" | "winner" | "sweepWinner" | "sweepLabel" | "scoringRules">;
  submissions: PublicSubmission[];
  activeRound: Pick<ActiveRound, "challengeId" | "startedAt" | "endsAt" | "pausedAt" | "attemptsUsed"> | null;
  activeChallenge: PublicChallenge | null;
  ballot: { endsAt: string; winnersCount: number; votesPerViewer: number; entries: { challenge: PublicChallenge; votes: number }[] } | null;
  recentResult: PublicChallenge | null;
  lineup: PublicChallenge[];
  theme: Theme;
  overlayConfig: OverlayConfig;
  publicSettings: Pick<AppState["sessionSettings"], "publicPage" | "twitchLogin">;
  leaderboard: AppState["leaderboard"];
  streaks: AppState["streaks"];
  sessionHistory: AppState["sessionHistory"];
  overallScore: AppState["overallScore"];
}

function publicChallenge(challenge: Challenge): PublicChallenge {
  const { id, title, objective, authorLogin, maxAttempts, roundValue, status, difficulty, timeLimitSeconds, game } = challenge;
  return { id, title, objective, authorLogin, maxAttempts, roundValue, status, difficulty, timeLimitSeconds, game };
}

function publicSubmission(challenge: Challenge): PublicSubmission {
  const { id, title, objective, authorLogin, maxAttempts, roundValue, difficulty, timeLimitSeconds, game, createdAt } = challenge;
  return { id, title, objective, authorLogin, maxAttempts, roundValue, difficulty, timeLimitSeconds, game, createdAt };
}

export function projectOverlayState(state: AppState): PublicOverlayState {
  const active = state.challenges.find((challenge) => challenge.id === state.activeRound?.challengeId);
  const recentResult = [...state.challenges].reverse().find((challenge) =>
    challenge.status === "streamer_won" || challenge.status === "chat_won",
  );

  return {
    channel: {
      id: state.channel.id,
      displayName: state.channel.displayName,
      broadcasterLogin: state.channel.broadcasterLogin,
    },
    session: {
      id: state.session.id,
      name: state.session.name,
      streamerScore: state.session.streamerScore,
      chatScore: state.session.chatScore,
      phase: state.session.phase,
      submissionsOpen: state.session.submissionsOpen,
      winner: state.session.winner,
      sweepWinner: state.session.sweepWinner,
      sweepLabel: state.session.sweepLabel,
      scoringRules: state.session.scoringRules,
    },
    submissions: [...state.challenges]
      .filter((challenge) => challenge.status === "pending_review" || challenge.status === "approved")
      .reverse()
      .map(publicSubmission),
    activeRound: state.activeRound
      ? {
          challengeId: state.activeRound.challengeId,
          startedAt: state.activeRound.startedAt,
          endsAt: state.activeRound.endsAt,
          pausedAt: state.activeRound.pausedAt ?? null,
          attemptsUsed: state.activeRound.attemptsUsed,
        }
      : null,
    activeChallenge: active ? publicChallenge(active) : null,
    ballot: state.ballot
      ? {
          winnersCount: state.ballot.winnersCount,
          votesPerViewer: state.ballot.votesPerViewer,
          endsAt: state.ballot.endsAt,
          entries: state.ballot.entries.map((entry: Ballot["entries"][number]) => ({
            challenge: publicChallenge(entry.challenge),
            votes: entry.votes,
          })),
        }
      : null,
    recentResult: recentResult ? publicChallenge(recentResult) : null,
    lineup: state.challenges
      .filter((challenge) => ["queued", "active", "streamer_won", "chat_won", "skipped", "voided"].includes(challenge.status))
      .map(publicChallenge),
    theme: state.theme,
    overlayConfig: state.overlayConfig ?? DEFAULT_OVERLAY_CONFIG,
    publicSettings: {
      publicPage: state.sessionSettings?.publicPage ?? true,
      twitchLogin: state.sessionSettings?.twitchLogin ?? null,
    },
    leaderboard: state.leaderboard ?? [],
    streaks: state.streaks,
    sessionHistory: state.sessionHistory,
    overallScore: state.overallScore,
  };
}

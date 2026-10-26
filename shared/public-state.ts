import type { ActiveRound, AppState, Ballot, Challenge, Theme } from "./contracts";

export type PublicChallenge = Pick<
  Challenge,
  "id" | "title" | "objective" | "authorLogin" | "maxAttempts" | "roundValue" | "status"
>;

export interface PublicOverlayState {
  session: Pick<AppState["session"], "streamerScore" | "chatScore" | "phase" | "winner" | "sweepWinner" | "sweepLabel" | "scoringRules">;
  activeRound: Pick<ActiveRound, "challengeId" | "startedAt" | "endsAt" | "attemptsUsed"> | null;
  activeChallenge: PublicChallenge | null;
  ballot: { endsAt: string; winnersCount: number; votesPerViewer: number; entries: { challenge: PublicChallenge; votes: number }[] } | null;
  recentResult: PublicChallenge | null;
  theme: Theme;
  leaderboard: AppState["leaderboard"];
  streaks: AppState["streaks"];
  sessionHistory: AppState["sessionHistory"];
  overallScore: AppState["overallScore"];
}

function publicChallenge(challenge: Challenge): PublicChallenge {
  const { id, title, objective, authorLogin, maxAttempts, roundValue, status } = challenge;
  return { id, title, objective, authorLogin, maxAttempts, roundValue, status };
}

export function projectOverlayState(state: AppState): PublicOverlayState {
  const active = state.challenges.find((challenge) => challenge.id === state.activeRound?.challengeId);
  const recentResult = [...state.challenges].reverse().find((challenge) =>
    challenge.status === "streamer_won" || challenge.status === "chat_won",
  );

  return {
    session: {
      streamerScore: state.session.streamerScore,
      chatScore: state.session.chatScore,
      phase: state.session.phase,
      winner: state.session.winner,
      sweepWinner: state.session.sweepWinner,
      sweepLabel: state.session.sweepLabel,
      scoringRules: state.session.scoringRules,
    },
    activeRound: state.activeRound
      ? {
          challengeId: state.activeRound.challengeId,
          startedAt: state.activeRound.startedAt,
          endsAt: state.activeRound.endsAt,
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
    theme: state.theme,
    leaderboard: state.leaderboard ?? [],
    streaks: state.streaks,
    sessionHistory: state.sessionHistory,
    overallScore: state.overallScore,
  };
}

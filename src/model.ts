import type { AppState, Challenge as ApiChallenge, Theme } from '../shared/contracts';
import type { ScoringRules } from '../shared/scoring';

export type Role = 'owner' | 'mod';
export type Difficulty = ApiChallenge['difficulty'];

export const DIFFICULTIES: { value: Difficulty; label: string; points: number }[] = [
  { value: 'easy', label: 'Easy', points: 250 },
  { value: 'medium', label: 'Medium', points: 500 },
  { value: 'hard', label: 'Hard', points: 750 },
  { value: 'ridiculous', label: 'Ridiculous', points: 1000 },
];

export const VOTE_LENGTHS = [
  { value: '60', label: '1 min' },
  { value: '180', label: '3 min' },
  { value: '300', label: '5 min' },
  { value: '600', label: '10 min' },
];

export const SITE = 'https://challenge.chat';
export const ORIGIN = typeof window === 'undefined' ? '' : window.location.origin;

export type Challenge = {
  id: string;
  title: string;
  objective: string;
  rawText: string;
  by: string;
  game: string | null;
  difficulty: Difficulty;
  timeLimit: number | null;
  maxAttempts: number | null;
  roundValue: number;
  parser: 'ai' | 'fallback';
  constraints: string[];
  warnings: string[];
};

export type Channel = {
  id: string;
  displayName: string;
  slug: string;
  broadcasterLogin: string;
  setupComplete: boolean;
  live: boolean;
  review: number;
  ready: number;
  mods: number;
  score: { streamer: number; chat: number };
  lastActive: string;
  assignedToMod: boolean;
  scoringRules?: ScoringRules;
  theme?: Theme;
};

export type Moderator = {
  id: string;
  name: string;
  role: 'Moderator';
  channels: number;
  active: boolean;
  added: string;
  online: boolean;
  lastSeen: string;
};

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

export function challengeFromState(value: ApiChallenge): Challenge {
  return {
    id: value.id,
    title: value.title,
    objective: value.objective,
    rawText: value.rawText,
    by: value.authorDisplayName || value.authorLogin,
    game: value.game,
    difficulty: value.difficulty,
    timeLimit: value.timeLimitSeconds,
    maxAttempts: value.maxAttempts,
    roundValue: value.roundValue,
    parser: value.parserStatus,
    constraints: value.constraints.map((constraint) => constraint.label),
    warnings: value.warnings,
  };
}

export function channelFromState(state: AppState, mods = 0): Channel {
  return {
    id: state.channel.id,
    displayName: state.channel.displayName,
    slug: state.channel.slug,
    broadcasterLogin: state.sessionSettings.twitchLogin ?? state.channel.broadcasterLogin,
    setupComplete: state.channel.setupComplete,
    live: state.session.phase === 'live',
    review: state.challenges.filter((challenge) => challenge.status === 'pending_review').length,
    ready: state.challenges.filter((challenge) => ['approved', 'queued'].includes(challenge.status)).length,
    mods,
    score: { streamer: state.overallScore.streamer, chat: state.overallScore.chat },
    lastActive: state.session.phase === 'live' ? 'Live now' : 'Current board',
    assignedToMod: true,
    scoringRules: state.channel.scoringRules,
    theme: state.theme,
  };
}

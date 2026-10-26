import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../../../shared/contracts';
import { ARCADE_SCORING_RULES } from '../../../shared/scoring';
import type { PublicOverlayState } from '../../../shared/public-state';
import { FRAMEWORK_API_VERSION, type LiveRunProjection } from '../../../shared/framework';
import { mapPublicOverlayState } from './live';

const challenge = {
  id: 'challenge-1',
  title: 'Knife only',
  objective: 'Win without a firearm',
  authorLogin: 'viewer',
  maxAttempts: 3,
  roundValue: 100,
  status: 'active' as const,
  difficulty: 'hard' as const,
  timeLimitSeconds: 90,
  game: 'Example',
};

const state: PublicOverlayState = {
  channel: { id: 'channel-1', displayName: 'Night Shift', broadcasterLogin: 'nightshift' },
  session: {
    id: 'session-1', streamerScore: 200, chatScore: 100, phase: 'live', winner: null,
    sweepWinner: null, sweepLabel: null, scoringRules: ARCADE_SCORING_RULES,
  },
  activeRound: { challengeId: challenge.id, startedAt: '2026-10-25T20:00:00.000Z', endsAt: '2026-10-25T20:01:30.000Z', attemptsUsed: 1 },
  activeChallenge: challenge,
  ballot: null,
  recentResult: null,
  lineup: [challenge],
  theme: DEFAULT_THEME,
  overlayConfig: { theme: 'neon', settings: { neon: { glow: 80 } }, elements: { scoreboard: true } },
  publicSettings: { publicPage: true, twitchLogin: null },
  leaderboard: [{ userId: 'viewer', displayName: 'Viewer', points: 100 }],
  streaks: { streamer: { challenge: { current: 1, best: 1 }, session: { current: 0, best: 0 }, cleanSweep: { current: 0, best: 0, total: 0 } }, chat: { challenge: { current: 0, best: 0 }, session: { current: 0, best: 0 }, cleanSweep: { current: 0, best: 0, total: 0 } } },
  sessionHistory: [],
  overallScore: { streamer: 200, chat: 100, streamerSessionWins: 0, chatSessionWins: 0 },
};

const run: LiveRunProjection = {
  apiVersion: FRAMEWORK_API_VERSION,
  runId: '11111111-1111-4111-8111-111111111111',
  revision: 3,
  status: 'active',
  title: challenge.title,
  objective: challenge.objective,
  startsAt: '2026-10-25T20:00:00.000Z',
  pausedAt: null,
  endsAt: '2026-10-25T20:01:30.000Z',
  serverTime: '2026-10-25T20:00:20.000Z',
  metrics: [{ id: 'kills', kind: 'counter', label: 'Kills', value: 2, target: 5 }],
  presentation: [],
  resolutionReason: null,
};

describe('live overlay source mapping', () => {
  it('maps public state, clocks, framework metrics, and persisted display config', () => {
    const snapshot = mapPublicOverlayState(state, run, 7, Date.parse(run.serverTime));
    expect(snapshot.session?.stage).toBe('live');
    expect(snapshot.session?.round?.clock).toEqual({
      startsAt: Date.parse(state.activeRound!.startedAt),
      endsAt: Date.parse(state.activeRound!.endsAt!),
      pausedAt: null,
    });
    expect(snapshot.session?.round?.attempt).toBe(2);
    expect(snapshot.metrics).toEqual([{ id: 'kills', kind: 'counter', label: 'Kills', value: 2, target: 5 }]);
    expect(snapshot.display).toEqual({ theme: 'neon', settings: { glow: 80 }, elements: { scoreboard: true } });
    expect(snapshot.channel.id).toBe('channel-1');
  });

  it('falls back to the first registered theme for unknown stored ids', () => {
    const snapshot = mapPublicOverlayState({ ...state, overlayConfig: { ...state.overlayConfig, theme: 'missing-theme' } });
    expect(snapshot.display.theme).toBe('broadcast');
  });
});

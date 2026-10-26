import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME } from '../../../shared/contracts';
import { ARCADE_SCORING_RULES } from '../../../shared/scoring';
import type { PublicOverlayState } from '../../../shared/public-state';
import { FRAMEWORK_API_VERSION, type LiveRunProjection } from '../../../shared/framework';
import { deriveBoard, deriveRound } from '../sdk/derive';
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
    id: 'session-1', name: 'The Knife Gauntlet', streamerScore: 200, chatScore: 100, phase: 'live', winner: null,
    submissionsOpen: false, sweepWinner: null, sweepLabel: null, scoringRules: ARCADE_SCORING_RULES,
  },
  submissions: [],
  activeRound: { challengeId: challenge.id, startedAt: '2026-10-25T20:00:00.000Z', endsAt: '2026-10-25T20:01:30.000Z', attemptsUsed: 1 },
  activeChallenge: challenge,
  ballot: null,
  recentResult: null,
  lineup: [challenge],
  theme: DEFAULT_THEME,
  overlayConfig: { theme: 'neon', settings: { neon: { glow: 80 } }, elements: { scoreboard: true } },
  publicSettings: { publicPage: true, twitchLogin: null },
  leaderboard: [{ userId: 'viewer', displayName: 'Viewer', points: 100, played: 1, won: 0 }],
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
  it('does not call a round with skipped challenges a clean sweep', () => {
    const lineup = [
      { ...challenge, id: 'won', status: 'chat_won' as const },
      { ...challenge, id: 'skip-1', status: 'skipped' as const },
      { ...challenge, id: 'skip-2', status: 'skipped' as const },
    ];
    const snapshot = mapPublicOverlayState({ ...state, session: { ...state.session, phase: 'complete' }, activeRound: null, activeChallenge: null, lineup });
    expect(deriveRound(snapshot).sweep).toBeNull();
  });
  it('does not add current awards a second time to authoritative live standings', () => {
    const snapshot = mapPublicOverlayState(state, run);
    const board = deriveBoard(snapshot, deriveRound(snapshot));
    expect(board.leaderboard.find((item) => item.id === 'viewer')?.points).toBe(100);
  });

  it('does not count an already-persisted completed round twice in season history', () => {
    const snapshot = mapPublicOverlayState({ ...state, activeRound: null, activeChallenge: null, session: { ...state.session, phase: 'complete' } });
    snapshot.history = [{ id: state.session.id, name: 'Completed', endedAt: Date.now(), points: {streamer: 200, chat: 100}, wins: {streamer: 2, chat: 1} }];
    const board = deriveBoard(snapshot, deriveRound(snapshot));
    expect(board.history).toHaveLength(1);
    expect(board.totals.streamer.points).toBe(200);
    expect(board.totals.chat.points).toBe(100);
  });
  it('uses the persisted creator pause time rather than an unrelated framework run', () => {
    const pausedAt = '2026-10-25T20:00:20.000Z';
    const snapshot = mapPublicOverlayState({ ...state, activeRound: { ...state.activeRound!, pausedAt } }, run, 8, Date.parse('2026-10-25T20:00:50.000Z'));
    expect(snapshot.session?.round?.clock.pausedAt).toBe(Date.parse(pausedAt));
    const resumed = mapPublicOverlayState({ ...state, activeRound: { ...state.activeRound!, pausedAt: null } }, { ...run, pausedAt }, 9);
    expect(resumed.session?.round?.clock.pausedAt).toBeNull();
  });
  it('maps public state, clocks, framework metrics, and persisted display config', () => {
    const snapshot = mapPublicOverlayState(state, run, 7, Date.parse(run.serverTime));
    expect(snapshot.session?.stage).toBe('live');
    expect(snapshot.session?.name).toBe('The Knife Gauntlet');
    expect(snapshot.session?.round?.clock).toEqual({
      startsAt: Date.parse(state.activeRound!.startedAt),
      endsAt: Date.parse(state.activeRound!.endsAt!),
      pausedAt: null,
    });
    expect(snapshot.session?.round?.attempt).toBe(2);
    expect(snapshot.metrics).toEqual([{ id: 'kills', kind: 'counter', label: 'Kills', value: 2, target: 5 }]);
    expect(snapshot.display).toEqual({ theme: 'neon', settings: { glow: 80 }, elements: { scoreboard: true } });
    expect(snapshot.channel.id).toBe('channel-1');
    expect(snapshot.sides.streamer.name).toBe('Night Shift');
  });

  it('falls back to the first registered theme for unknown stored ids', () => {
    const snapshot = mapPublicOverlayState({ ...state, overlayConfig: { ...state.overlayConfig, theme: 'missing-theme' } });
    expect(snapshot.display.theme).toBe('broadcast');
  });

  it('maps a fresh closed session to the idle OBS scene', () => {
    const snapshot = mapPublicOverlayState({
      ...state,
      session: { ...state.session, phase: 'collecting', submissionsOpen: false },
      activeRound: null,
      activeChallenge: null,
      lineup: [],
    });
    expect(snapshot.session?.stage).toBe('idle');
    expect(deriveRound(snapshot).scene).toBe('idle');
  });

  it('does not double-count a persisted result while its OBS result card is showing', () => {
    const resolved = { ...challenge, status: 'streamer_won' as const };
    const snapshot = mapPublicOverlayState({
      ...state,
      activeRound: null,
      activeChallenge: null,
      recentResult: resolved,
      lineup: [resolved],
    }, null, 8, Date.parse(run.serverTime));
    const round = deriveRound(snapshot);
    expect(round.score.streamer).toEqual({ points: 100, wins: 1 });
    expect(round.score.chat).toEqual({ points: 0, wins: 0 });
  });

  it('maps live challenge submissions for the OBS ideas scene', () => {
    const createdAt = '2026-10-25T20:00:10.000Z';
    const submission = { ...challenge, createdAt };
    const snapshot = mapPublicOverlayState({
      ...state,
      session: { ...state.session, phase: 'collecting', submissionsOpen: true },
      submissions: [submission],
      activeChallenge: null,
      activeRound: null,
      lineup: [],
    });

    expect(snapshot.session?.stage).toBe('open');
    expect(snapshot.session?.submissions).toEqual({
      open: true,
      clock: null,
      command: '!challenge',
      ideas: [{
        at: Date.parse(createdAt),
        challenge: expect.objectContaining({ id: challenge.id, title: challenge.title, by: challenge.authorLogin }),
      }],
    });
  });
});

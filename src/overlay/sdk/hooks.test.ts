import { createElement, Fragment, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ElementOutlet,
  OverlayProvider,
  OverlayRenderer,
  OverlayStore,
  SceneOutlet,
  defineTheme,
  registerTheme,
  unregisterTheme,
  useAttempts,
  useBallot,
  useBoard,
  useChallenge,
  useChannel,
  useClock,
  useConnection,
  useDisplay,
  useElementOn,
  useLeaderboard,
  useLineup,
  useMetric,
  useMetrics,
  useNow,
  useOverlay,
  useOverlayEvent,
  useOverlaySelector,
  useOverlayStore,
  useRound,
  useScene,
  useSceneKey,
  useScore,
  useSeason,
  useSideName,
  useSides,
  useSnapshot,
  useSponsors,
  useStage,
  useStreak,
  useSubmissions,
  useThemeContext,
  useThemeSettings,
  useThemes,
  type OverlayEvent,
  type OverlaySnapshot,
  type SourceSink,
} from './index';
import { Counter } from '../themes/broadcast/elements';

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  requestAnimationFrame: (callback: FrameRequestCallback) => {
    callback(performance.now() + 1_000);
    return 1;
  },
  cancelAnimationFrame: () => undefined,
});

const NOW = 1_800_000_000_000;

const first = {
  id: 'challenge-1',
  title: 'Win with one hand',
  objective: 'Finish the level using only one hand.',
  by: 'Alba',
  difficulty: 'hard' as const,
  points: 100,
  timeLimit: 60,
  maxAttempts: 3,
  game: 'Example Game',
};

const second = {
  id: 'challenge-2',
  title: 'No healing',
  objective: 'Finish without using a healing item.',
  by: 'Boris',
  difficulty: 'ridiculous' as const,
  points: 200,
  timeLimit: 90,
  maxAttempts: 2,
  game: 'Example Game',
};

const third = {
  id: 'challenge-3',
  title: 'Take the long route',
  objective: 'Finish by taking the longest route.',
  by: 'Casey',
  difficulty: 'medium' as const,
  points: 75,
  timeLimit: null,
  maxAttempts: null,
  game: null,
};

function snapshot(revision = 1): OverlaySnapshot {
  return {
    revision,
    serverTime: NOW,
    channel: { id: 'board-1234', name: 'Night Shift', login: 'nightshift' },
    sides: {
      streamer: { name: 'Night Shift', color: '#ff5522' },
      chat: { name: 'Chat', color: '#22ccff' },
    },
    session: {
      id: 'session-1',
      name: 'Sunday Gauntlet',
      stage: 'live',
      startedAt: NOW - 120_000,
      submissions: {
        open: true,
        clock: { startsAt: NOW - 30_000, endsAt: NOW + 90_000, pausedAt: null },
        ideas: [{ challenge: third, at: NOW - 2_000 }],
        command: '!challenge',
      },
      ballot: {
        clock: { startsAt: NOW - 10_000, endsAt: NOW + 50_000, pausedAt: null },
        winners: 1,
        votesPerViewer: 2,
        entries: [
          { challenge: first, votes: 3 },
          { challenge: second, votes: 1 },
        ],
        command: '!vote',
      },
      lineup: [first, second],
      results: [{ challengeId: first.id, winner: 'streamer', attempts: 2, took: 42 }],
      round: {
        index: 1,
        clock: { startsAt: NOW - 5_000, endsAt: NOW + 85_000, pausedAt: null },
        attempt: 2,
        call: null,
      },
    },
    history: [{
      id: 'session-0',
      name: 'Previous show',
      endedAt: NOW - 86_400_000,
      points: { streamer: 50, chat: 100 },
      wins: { streamer: 1, chat: 1 },
    }],
    challengers: [
      { id: 'viewer-1', name: 'Alba', points: 40, played: 2, won: 1 },
      { id: 'viewer-2', name: 'Boris', points: 30, played: 1, won: 0 },
    ],
    scoring: { selectedPoints: 10, defeatedPoints: 25 },
    metrics: [
      { id: 'kills', kind: 'counter', label: 'Kills', value: 4, target: 5 },
      { id: 'boss', kind: 'flag', label: 'Boss defeated', value: false, target: true },
    ],
    sponsors: [{ id: 'sponsor-1', name: 'Arcade Co', logoUrl: 'https://example.com/logo.svg' }],
    display: {
      theme: 'sdk-contract-test',
      settings: { density: 99, accent: 'not-a-color', label: 'A label that is too long' },
      elements: { badge: true },
    },
  };
}

type ProbeValue = ReturnType<typeof readHooks>;
let probe: ProbeValue | null = null;
let themeProbe: Record<string, unknown> | null = null;
let seen: OverlayEvent[] = [];
let metricEvents: OverlayEvent[] = [];

function readHooks() {
  const store = useOverlayStore();
  const round = useRound();
  const board = useBoard();
  const raw = useSnapshot();
  const selectedRevision = useOverlaySelector((state) => state.snapshot.revision);
  const selectedReady = useOverlay((state) => state.ready);
  const stage = useStage();
  const scene = useScene();
  const connection = useConnection();
  const display = useDisplay();
  const sides = useSides();
  const channel = useChannel();
  const sponsors = useSponsors();
  const streamerName = useSideName('streamer');
  const score = useScore();
  const streak = useStreak();
  const lineup = useLineup();
  const challenge = useChallenge();
  const roundClock = useClock();
  const nextClock = useClock('next');
  const ballotClock = useClock('ballot');
  const submissionsClock = useClock('submissions');
  const attempts = useAttempts();
  const ballot = useBallot();
  const submissions = useSubmissions();
  const leaderboard = useLeaderboard(1);
  const season = useSeason();
  const metric = useMetric('kills');
  const missingMetric = useMetric('missing');
  const metrics = useMetrics();
  const now = useNow();

  useOverlayEvent('*', (event) => seen.push(event));
  useOverlayEvent(['metric', 'goal'], (event) => metricEvents.push(event));

  return {
    store,
    round,
    board,
    raw,
    selectedRevision,
    selectedReady,
    stage,
    scene,
    connection,
    display,
    sides,
    channel,
    sponsors,
    streamerName,
    score,
    streak,
    lineup,
    challenge,
    roundClock,
    nextClock,
    ballotClock,
    submissionsClock,
    attempts,
    ballot,
    submissions,
    leaderboard,
    season,
    metric,
    missingMetric,
    metrics,
    now,
  };
}

function Probe() {
  probe = readHooks();
  return null;
}

const testTheme = defineTheme({
  id: 'sdk-contract-test',
  name: 'SDK contract test',
  settings: {
    density: { type: 'number', label: 'Density', default: 4, min: 1, max: 10 },
    accent: { type: 'color', label: 'Accent', default: '#123456' },
    label: { type: 'text', label: 'Label', default: 'Default', maxLength: 8 },
  },
  Layout: function Layout() {
    const context = useThemeContext();
    const settings = testTheme.useSettings();
    const untypedSettings = useThemeSettings();
    const badgeOn = useElementOn('badge');
    const sceneKey = useSceneKey();
    const themes = useThemes();
    const placed: unknown[] = [];
    themeProbe = { context, settings, untypedSettings, badgeOn, sceneKey, themes, placed };
    return createElement(
      Fragment,
      null,
      createElement(SceneOutlet),
      createElement(ElementOutlet, {
        region: 'hud',
        children: (element: unknown) => {
          placed.push(element);
          return null;
        },
      }),
    );
  },
  scenes: {
    live: () => createElement('span', null, 'live scene'),
    result: () => createElement('span', null, 'result scene'),
  },
  elements: {
    badge: { label: 'Badge', region: 'hud', Component: () => createElement('span', null, 'badge') },
    hidden: { label: 'Hidden', region: 'hud', Component: () => createElement('span', null, 'hidden') },
  },
});

describe('React overlay SDK contract', () => {
  let renderer: ReactTestRenderer | null = null;
  let sink: SourceSink | null = null;
  let stopped = false;

  beforeEach(() => {
    probe = null;
    themeProbe = null;
    seen = [];
    metricEvents = [];
    stopped = false;
    registerTheme(testTheme);
  });

  afterEach(() => {
    if (renderer) act(() => renderer?.unmount());
    renderer = null;
    unregisterTheme(testTheme.id);
  });

  it('feeds every public data hook from a source and resolves theme hooks', async () => {
    const source = {
      connect(next: SourceSink) {
        sink = next;
        next.status('live');
        next.snapshot(snapshot());
        return () => { stopped = true; };
      },
    };

    await act(async () => {
      renderer = create(createElement(
        OverlayProvider,
        {
          source,
          fallback: createElement('span', null, 'loading'),
          children: createElement(Fragment, null, createElement(Probe), createElement(OverlayRenderer)),
        },
      ));
    });

    expect(probe).not.toBeNull();
    expect(probe!.store.get().ready).toBe(true);
    expect(probe!.selectedReady).toBe(true);
    expect(probe!.selectedRevision).toBe(1);
    expect(probe!.connection).toBe('live');
    expect(probe!.stage).toBe('live');
    expect(probe!.scene).toBe('live');
    expect(probe!.raw.channel).toEqual({ id: 'board-1234', name: 'Night Shift', login: 'nightshift' });
    expect(probe!.channel.name).toBe('Night Shift');
    expect(probe!.streamerName).toBe('Night Shift');
    expect(probe!.sides.chat.name).toBe('Chat');
    expect(probe!.sponsors[0].name).toBe('Arcade Co');
    expect(probe!.display.theme).toBe(testTheme.id);

    expect(probe!.round.phase).toBe('playing');
    expect(probe!.round.challenge?.id).toBe(second.id);
    expect(probe!.challenge.challenge?.id).toBe(second.id);
    expect(probe!.challenge.phase).toBe('playing');
    expect(probe!.roundClock?.duration).toBe(90);
    expect(probe!.nextClock).toBeNull();
    expect(probe!.ballotClock?.duration).toBe(60);
    expect(probe!.submissionsClock?.duration).toBe(120);
    expect(probe!.attempts).toEqual({ current: 2, max: 2, left: 0, last: true });
    expect(probe!.lineup.progress).toEqual({ played: 1, total: 2, number: 2, remaining: 1 });
    expect(probe!.lineup.slots.map((slot) => slot.status)).toEqual(['done', 'live']);
    expect(probe!.ballot?.total).toBe(4);
    expect(probe!.ballot?.leader?.challenge.id).toBe(first.id);
    expect(probe!.submissions.count).toBe(1);
    expect(probe!.submissions.latest?.challenge.id).toBe(third.id);

    expect(probe!.score.score).toEqual({ streamer: { points: 100, wins: 1 }, chat: { points: 0, wins: 0 } });
    expect(probe!.score.leader).toBe('streamer');
    expect(probe!.streak.current).toEqual({ side: 'streamer', count: 1 });
    expect(probe!.board.totals.streamer.points).toBe(150);
    expect(probe!.board.totals.chat.points).toBe(100);
    expect(probe!.leaderboard).toHaveLength(1);
    expect(probe!.leaderboard[0].name).toBe('Alba');
    expect(probe!.season.history[0].name).toBe('Previous show');
    expect(probe!.metric).toMatchObject({ id: 'kills', progress: 0.8, reached: false });
    expect(probe!.missingMetric).toBeNull();
    expect(probe!.metrics.boss.reached).toBe(false);
    expect(probe!.now).toBeGreaterThanOrEqual(NOW);

    expect(themeProbe).not.toBeNull();
    expect(themeProbe!.badgeOn).toBe(true);
    expect(themeProbe!.sceneKey).toBe('live-1');
    expect(themeProbe!.settings).toEqual({ density: 10, accent: '#123456', label: 'A label ' });
    expect(themeProbe!.untypedSettings).toEqual(themeProbe!.settings);
    expect((themeProbe!.themes as { id: string }[]).some((theme) => theme.id === testTheme.id)).toBe(true);
    expect((themeProbe!.placed as { id: string; on: boolean }[]).map(({ id, on }) => ({ id, on }))).toEqual([
      { id: 'badge', on: true },
      { id: 'hidden', on: false },
    ]);
    expect(renderer!.toJSON()).toEqual({ type: 'span', props: {}, children: ['live scene'] });
  });

  it('pushes Cloudflare-shaped source updates through hooks, derived data, scenes, and events', async () => {
    const source = {
      connect(next: SourceSink) {
        sink = next;
        next.status('live');
        next.snapshot(snapshot());
        return () => { stopped = true; };
      },
    };

    await act(async () => {
      renderer = create(createElement(
        OverlayProvider,
        { source, children: createElement(Fragment, null, createElement(Probe), createElement(OverlayRenderer)) },
      ));
    });

    const update = snapshot(2);
    update.serverTime = NOW + 1_000;
    update.session = {
      ...update.session!,
      submissions: {
        ...update.session!.submissions,
        ideas: [{ challenge: { ...third, id: 'challenge-4', title: 'Fresh idea' }, at: NOW + 1_000 }, ...update.session!.submissions.ideas],
      },
      ballot: {
        ...update.session!.ballot!,
        entries: [
          { challenge: first, votes: 3 },
          { challenge: second, votes: 2 },
        ],
      },
      round: {
        ...update.session!.round!,
        call: { winner: 'chat', at: NOW + 1_000, next: { startsAt: NOW + 6_000, endsAt: NOW + 6_000, pausedAt: null } },
      },
    };
    update.metrics = update.metrics.map((metric) => metric.id === 'kills' ? { ...metric, value: 5 } : metric);

    await act(async () => sink!.snapshot(update));
    await act(async () => sink!.event({ type: 'custom', name: 'enemy_defeated', data: { enemy: 'crawler' } }));

    expect(probe!.selectedRevision).toBe(2);
    expect(probe!.scene).toBe('result');
    expect(probe!.round.phase).toBe('called');
    expect(probe!.challenge.call).toEqual({ winner: 'chat', points: 200, at: NOW + 1_000 });
    expect(probe!.challenge.next?.startsIn).toBe(5);
    expect(probe!.score.score).toEqual({ streamer: { points: 100, wins: 1 }, chat: { points: 200, wins: 1 } });
    expect(probe!.score.leader).toBe('chat');
    expect(probe!.ballot?.total).toBe(5);
    expect(probe!.submissions.count).toBe(2);
    expect(probe!.metric).toMatchObject({ value: 5, progress: 1, reached: true });
    expect(themeProbe!.sceneKey).toBe('result-1-chat');
    expect(renderer!.toJSON()).toEqual({ type: 'span', props: {}, children: ['result scene'] });

    expect(seen.map((event) => event.type)).toEqual(['idea', 'votes', 'round.call', 'lead', 'metric', 'goal', 'custom']);
    expect(metricEvents.map((event) => event.type)).toEqual(['metric', 'goal']);

    await act(async () => renderer?.unmount());
    renderer = null;
    expect(stopped).toBe(true);
  });

  it('renders the real kill-counter element and updates it from SDK metrics', async () => {
    const initial = snapshot();
    const store = new OverlayStore(initial);

    await act(async () => {
      renderer = create(createElement(OverlayProvider, { store, children: createElement(Counter) }));
    });

    expect(JSON.stringify(renderer!.toJSON())).toContain('04');

    const update = snapshot(2);
    update.metrics = update.metrics.map((metric) => metric.id === 'kills' ? { ...metric, value: 5 } : metric);
    await act(async () => store.setSnapshot(update));

    expect(JSON.stringify(renderer!.toJSON())).toContain('05');
  });
});

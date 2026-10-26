import { deriveBoard, deriveRound } from '@/overlay/sdk/derive';
import type { Display, Metric, OverlaySnapshot, OverlaySource, Scene, Session, Side, SourceSink } from '@/overlay/sdk/types';
import { FOLLOWERS, KILLS, mockBoard, POOL, seedSession } from './data';
import * as engine from './engine';
import { DEFAULT_OPTIONS, type EngineOptions } from './engine';

/**
 * A stand-in for the Worker connection: holds the board, runs the game loop from `engine.ts`, and keeps
 * chat busy (ideas arriving, votes climbing, a kill counter ticking). `controls` are the control room's
 * buttons; `setAutoplay(true)` plays whole sessions on its own, back to back.
 */

export type MockControls = {
  /** Drop in at any scene with plausible data, like the control room's stage switcher. */
  seed(scene: Scene, winner?: Side): void;
  setAutoplay(on: boolean): void;
  setOptions(patch: Partial<EngineOptions>): void;
  setDisplay(patch: Partial<Display>): void;

  open(): void;
  setIdeasOpen(open: boolean): void;
  addIdea(): void;
  vote(): void;
  closeVote(): void;
  start(): void;
  call(side: Side): void;
  undo(): void;
  fail(): void;
  pause(): void;
  resume(): void;
  next(): void;
  skip(): void;
  end(): void;
  /** File a finished session into the season and clear the board for the next. */
  reset(): void;

  bumpMetric(id: string, by: number): void;
  setMetric(id: string, value: number | boolean): void;
};

export type MockSource = OverlaySource & { controls: MockControls };

/** Autoplay runs a shorter session than the real defaults so it loops in a couple of minutes. */
const AUTOPLAY: Partial<EngineOptions> = { voteSecs: 20, countdownSecs: 3, autoNext: true, autoNextSecs: 7 };
/** How long autoplay sits on each stage before pressing on (ms). Vote and live move on their own clocks. */
const DWELL = { idle: 3000, open: 14000, lock: 6000, done: 12000 };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** How close to running out a held preview's clock gets before its scene starts over (ms). */
const HOLD_MARGIN = 5000;

/**
 * A clock the current stage shows will run out within the margin. Only the stage's own clocks count:
 * a seeded session carries finished ones from earlier stages, which no re-seed would bring back.
 */
function runsOut(s: Session | null, now: number) {
  if (!s) return false;
  const clocks = s.stage === 'open' ? [s.submissions.clock] : s.stage === 'vote' ? [s.ballot?.clock] : s.stage === 'live' ? [s.round?.clock, s.round?.call?.next] : [];
  return clocks.some((c) => c && c.pausedAt == null && c.endsAt != null && now < c.endsAt && c.endsAt - now < HOLD_MARGIN);
}

/**
 * `hold` keeps the session on the scene it's seeded at (for previews): chat stays busy, but no clock moves
 * it on, and the scene starts over before any of its clocks runs out, so a preview never sits at time up.
 */
export function createMockSource(init: { scene?: Scene; winner?: Side; display: Display; channelName?: string; options?: Partial<EngineOptions>; hold?: boolean }): MockSource {
  let opts: EngineOptions = { ...DEFAULT_OPTIONS, ...init.options };
  let autoplay = false;
  const o = () => (autoplay ? { ...opts, ...AUTOPLAY } : opts);
  /** The scene last seeded, which a held preview starts over. */
  let held: { scene: Scene; winner?: Side } = { scene: init.scene ?? 'live', winner: init.winner };

  const now0 = Date.now();
  const board = mockBoard(now0);
  if (init.channelName) {
    board.channel = { ...board.channel, name: init.channelName };
    board.sides = { ...board.sides, streamer: { ...board.sides.streamer, name: init.channelName } };
  }
  let snap: OverlaySnapshot = { ...board, session: seedSession(init.scene ?? 'live', now0, opts, init.winner), display: init.display };
  snap = withMetric(snap, 'kills', snap.session?.stage === 'live' || snap.session?.stage === 'done' ? 2 : 0);

  const sinks = new Set<SourceSink>();
  let timer: ReturnType<typeof setInterval> | null = null;
  /** The stage autoplay last saw and when it started, for its dwell times. */
  let stageAt = { stage: snap.session?.stage ?? 'idle', since: now0 };
  let nextIdeaAt = 0;
  let nextVotesAt = 0;
  let nextKillAt = 0;
  let nextFollowAt = 0;
  /** When autoplay next decides something about the live challenge. */
  let beatAt = 0;

  function commit(next: OverlaySnapshot) {
    if (next === snap) return;
    const now = Date.now();
    if (next.session?.round?.index !== snap.session?.round?.index || (snap.session?.round?.call && !next.session?.round?.call)) beatAt = 0;
    snap = { ...next, revision: snap.revision + 1, serverTime: now };
    for (const s of sinks) s.snapshot(snap);
  }

  const withSession = (s: Session | null) => (s === snap.session ? snap : { ...snap, session: s });
  const act = (fn: (s: Session, now: number) => Session) => snap.session && commit(withSession(fn(snap.session, Date.now())));

  function withMetric(base: OverlaySnapshot, id: string, value: number | boolean | ((m: Metric) => number | boolean)) {
    return { ...base, metrics: base.metrics.map((m) => (m.id === id ? { ...m, value: typeof value === 'function' ? value(m) : value } : m)) };
  }

  /** Tonight into the season: a history row and the challengers' new standings. */
  function filed(): OverlaySnapshot {
    const s = snap.session;
    if (!s || !s.results.some((r) => r.winner)) return { ...snap, session: null };
    const round = deriveRound(snap);
    const board = deriveBoard(snap, round);
    const played = new Set(s.results.map((r) => r.challengeId));
    const beat = new Set(s.results.filter((r) => r.winner === 'chat').map((r) => r.challengeId));
    return {
      ...snap,
      session: null,
      history: [
        {
          id: s.id,
          name: s.name ?? 'Untitled round',
          endedAt: Date.now(),
          points: { streamer: round.score.streamer.points, chat: round.score.chat.points },
          wins: { streamer: round.score.streamer.wins, chat: round.score.chat.wins },
        },
        ...snap.history,
      ],
      challengers: board.leaderboard.map((c) => {
        const mine = s.lineup.filter((x) => x.by.toLowerCase() === c.name.toLowerCase());
        return {
          id: c.id,
          name: c.name,
          points: c.points,
          played: c.played + mine.filter((x) => played.has(x.id)).length,
          won: c.won + mine.filter((x) => beat.has(x.id)).length,
        };
      }),
    };
  }

  function openFresh(base: OverlaySnapshot): OverlaySnapshot {
    const now = Date.now();
    return withMetric({ ...base, session: engine.openSession(now, o()) }, 'kills', 0);
  }

  /** What autoplay does next, given how long the stage has run. */
  function direct(base: OverlaySnapshot, now: number): OverlaySnapshot {
    const s = base.session;
    const stage = s?.stage ?? 'idle';
    // A stage the engine moved to in this same tick starts its dwell now
    if (stage !== stageAt.stage) stageAt = { stage, since: now };
    const since = now - stageAt.since;
    if (!s) return since > DWELL.idle ? openFresh(base) : base;
    switch (s.stage) {
      case 'open':
        return since > DWELL.open && s.submissions.ideas.length >= 5 ? withSession(engine.openVote(s, now, o())) : base;
      case 'lock':
        return since > DWELL.lock ? withSession(engine.start(s, now, o())) : base;
      case 'done':
        return since > DWELL.done ? filed() : base;
      case 'live': {
        const r = s.round;
        if (!r || r.call || r.clock.pausedAt != null || now < r.clock.startsAt) return base;
        if (!beatAt) beatAt = now + rand(5000, 11000);
        if (now < beatAt) return base;
        beatAt = 0;
        const c = s.lineup[r.index];
        const timeUp = r.clock.endsAt != null && now >= r.clock.endsAt;
        const roll = Math.random();
        if (!timeUp && roll < 0.3 && c.maxAttempts !== 1) return withSession(engine.fail(s, now, o()));
        const side: Side = timeUp ? 'chat' : roll < 0.68 ? 'streamer' : 'chat';
        return withSession(engine.call(s, side, now, o()));
      }
      default:
        return base;
    }
  }

  /** Chat being chat, plus the engine's own timers. */
  function loop() {
    const now = Date.now();
    if (init.hold && runsOut(snap.session, now)) return controls.seed(held.scene, held.winner);
    let next = snap;
    let s = next.session;
    if (s && !init.hold) next = withSession((s = engine.tick(s, now, o())));

    if (s?.stage === 'open' && s.submissions.open && now >= nextIdeaAt) {
      const idea = POOL.find((c) => !s!.submissions.ideas.some((i) => i.challenge.id === c.id));
      if (idea && nextIdeaAt) next = { ...next, session: (s = engine.addIdea(s, idea, now)) };
      nextIdeaAt = now + (autoplay ? 2000 : 4000);
    }
    if (s?.stage === 'vote' && s.ballot && now >= nextVotesAt) {
      const votes = Object.fromEntries(s.ballot.entries.map((e, i) => [e.challenge.id, Math.random() < 0.55 ? Math.ceil(Math.random() * (i % 3 === 0 ? 4 : 2)) : 0]));
      next = { ...next, session: (s = engine.castVotes(s, votes)) };
      nextVotesAt = now + 1000;
    }
    const playing = s?.stage === 'live' && s.round && !s.round.call && s.round.clock.pausedAt == null && now >= s.round.clock.startsAt;
    if (playing && now >= nextKillAt) {
      if (nextKillAt) next = withMetric(next, KILLS.id, (m) => (m.value as number) + 1);
      nextKillAt = now + rand(6000, 12000);
    }
    if (now >= nextFollowAt) {
      if (nextFollowAt) next = withMetric(next, FOLLOWERS.id, (m) => Math.min((m.target as number) + 40, (m.value as number) + 1));
      nextFollowAt = now + rand(4000, 8000);
    }

    if (autoplay) next = direct(next, now);
    commit(next);
  }

  const controls: MockControls = {
    seed(scene, winner) {
      const now = Date.now();
      held = { scene, winner };
      const session = seedSession(scene, now, o(), winner);
      commit(withMetric({ ...snap, session }, 'kills', session?.stage === 'live' || session?.stage === 'done' ? 2 : 0));
      stageAt = { stage: session?.stage ?? 'idle', since: now };
    },
    setAutoplay(on) {
      autoplay = on;
      stageAt = { stage: snap.session?.stage ?? 'idle', since: Date.now() };
      beatAt = 0;
    },
    setOptions(patch) {
      opts = { ...opts, ...patch };
    },
    setDisplay(patch) {
      commit({ ...snap, display: { ...snap.display, ...patch } });
    },

    open: () => commit(openFresh(snap.session?.stage === 'done' ? filed() : { ...snap, session: null })),
    setIdeasOpen: (open) => act((s) => engine.setSubmissionsOpen(s, open)),
    addIdea: () =>
      act((s, now) => {
        const idea = POOL.find((c) => !s.submissions.ideas.some((i) => i.challenge.id === c.id));
        return idea ? engine.addIdea(s, idea, now) : s;
      }),
    vote: () => act((s, now) => engine.openVote(s, now, o())),
    closeVote: () => act((s, now) => engine.closeVote(s, now)),
    start: () => act((s, now) => engine.start(s, now, o())),
    call: (side) => act((s, now) => engine.call(s, side, now, o())),
    undo: () => act((s, now) => engine.undo(s, now)),
    fail: () => act((s, now) => engine.fail(s, now, o())),
    pause: () => act((s, now) => engine.pause(s, now)),
    resume: () => act((s, now) => engine.resume(s, now)),
    next: () => act((s, now) => engine.next(s, now, o())),
    skip: () => act((s, now) => engine.skip(s, now, o())),
    end: () => act((s) => engine.end(s)),
    reset: () => commit(filed()),

    bumpMetric: (id, by) => commit(withMetric(snap, id, (m) => (typeof m.value === 'number' ? Math.max(0, m.value + by) : !m.value))),
    setMetric: (id, value) => commit(withMetric(snap, id, value)),
  };

  return {
    controls,
    connect(sink) {
      sinks.add(sink);
      sink.status('live');
      sink.snapshot(snap);
      timer ??= setInterval(loop, 500);
      return () => {
        sinks.delete(sink);
        if (!sinks.size && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}

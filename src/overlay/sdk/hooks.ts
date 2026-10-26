import { useEffect, useMemo, useRef } from 'react';
import { viewClock, type ClockView } from './clock';
import type { BallotRow, BoardModel, ChallengerRow, LineupSlot, MetricView, RoundModel } from './derive';
import { useOverlay, useOverlayStore, type Selection } from './provider';
import type { Challenge, Display, EventOf, OverlayEventType, OverlaySnapshot, Session, Side } from './types';

/*
 * The public hooks. `useRound` and `useBoard` hand over everything; the narrow ones exist so an element
 * that only shows the score doesn't re-render every second with the clock.
 */

/** What the live challenge is doing right now. */
export type RoundPhase = 'countdown' | 'playing' | 'paused' | 'timeup' | 'called';

type Clocks = {
  round: ClockView | null;
  next: ClockView | null;
  ballot: ClockView | null;
  submissions: ClockView | null;
};

function clocksOf(session: Session | null, now: number): Clocks {
  return {
    round: session?.round ? viewClock(session.round.clock, now) : null,
    next: session?.round?.call?.next ? viewClock(session.round.call.next, now) : null,
    ballot: session?.ballot ? viewClock(session.ballot.clock, now) : null,
    submissions: session?.submissions.clock ? viewClock(session.submissions.clock, now) : null,
  };
}

function phaseOf(round: RoundModel, clock: ClockView | null): RoundPhase | null {
  if (!round.challenge || !clock) return null;
  if (round.call) return 'called';
  if (clock.paused) return 'paused';
  if (clock.pending) return 'countdown';
  if (clock.expired) return 'timeup';
  return 'playing';
}

export type RoundView = Omit<RoundModel, 'submissions' | 'ballot'> & {
  submissions: RoundModel['submissions'] & { clock: ClockView | null };
  ballot: (NonNullable<RoundModel['ballot']> & { clock: ClockView | null }) | null;
  phase: RoundPhase | null;
  /** The live challenge's clock: time left (or elapsed when untimed). */
  clock: ClockView | null;
  /** Seconds until the live challenge starts, during its countdown. */
  countdown: number | null;
  /** Counting down to the next challenge once a winner's called, when auto-next is on. */
  next: ClockView | null;
};

/**
 * The game loop: stage, lineup, the live challenge with its clock and attempts, tonight's score and
 * streaks. Re-renders once a second while any clock runs.
 */
export function useRound(): RoundView {
  const [model, round, next, ballot, submissions] = useOverlay(
    (s) => {
      const c = clocksOf(s.snapshot.session, s.now);
      return [s.round, c.round, c.next, c.ballot, c.submissions] as const;
    },
    { time: true },
  );
  return useMemo(
    () => ({
      ...model,
      submissions: { ...model.submissions, clock: submissions },
      ballot: model.ballot && { ...model.ballot, clock: ballot },
      phase: phaseOf(model, round),
      clock: round,
      countdown: round?.pending ? round.startsIn : null,
      next,
    }),
    [model, round, next, ballot, submissions],
  );
}

/** The whole board: season totals with tonight folded in, records, streaks, history, leaderboard, metrics. */
export function useBoard(): BoardModel {
  return useOverlay((s) => s.board);
}

/** The raw snapshot, for anything the models don't cover. */
export function useSnapshot(): OverlaySnapshot {
  return useOverlay((s) => s.snapshot);
}

/** Pick anything from the derived state with your own selector. Pass `time` for clock-driven values. */
export function useOverlaySelector<T>(select: (s: Selection) => T, opts?: { time?: boolean; equal?: (a: T, b: T) => boolean }) {
  return useOverlay(select, opts);
}

export const useStage = () => useOverlay((s) => s.round.stage);
export const useScene = () => useOverlay((s) => s.round.scene);
export const useConnection = () => useOverlay((s) => s.status);
export const useDisplay = (): Display => useOverlay((s) => s.snapshot.display);
export const useSides = () => useOverlay((s) => s.snapshot.sides);
export const useChannel = () => useOverlay((s) => s.snapshot.channel);
export const useSponsors = () => useOverlay((s) => s.snapshot.sponsors);

/** What a side is called on screen. */
export function useSideName(side: Side) {
  return useOverlay((s) => s.snapshot.sides[side].name);
}

/** Tonight's score, counting a called winner straight away. */
export function useScore() {
  return useOverlay((s) => ({ score: s.round.score, leader: s.round.leader, lead: s.round.lead, momentum: s.round.momentum, leadChanges: s.round.leadChanges }));
}

/** Tonight's run of challenge wins, and each side's best. */
export function useStreak() {
  return useOverlay((s) => ({ current: s.round.streak, best: s.round.bestStreak }));
}

export function useLineup(): { slots: LineupSlot[]; progress: RoundModel['progress'] } {
  return useOverlay((s) => ({ slots: s.round.lineup, progress: s.round.progress }));
}

/** The live challenge, its clock and attempts. Null between challenges. */
export function useChallenge(): {
  challenge: Challenge | null;
  slot: LineupSlot | null;
  phase: RoundPhase | null;
  clock: ClockView | null;
  countdown: number | null;
  attempts: RoundModel['attempts'];
  call: RoundModel['call'];
  next: ClockView | null;
  upNext: Challenge | null;
} {
  const [model, clock, next] = useOverlay(
    (s) => {
      const c = clocksOf(s.snapshot.session, s.now);
      return [s.round, c.round, c.next] as const;
    },
    { time: true },
  );
  return useMemo(
    () => ({
      challenge: model.challenge,
      slot: model.slot,
      phase: phaseOf(model, clock),
      clock,
      countdown: clock?.pending ? clock.startsIn : null,
      attempts: model.attempts,
      call: model.call,
      next,
      upNext: model.upNext,
    }),
    [model, clock, next],
  );
}

/** One of the session's clocks, read live. */
export function useClock(which: keyof Clocks = 'round'): ClockView | null {
  return useOverlay((s) => clocksOf(s.snapshot.session, s.now)[which], { time: true });
}

export function useAttempts() {
  return useOverlay((s) => s.round.attempts);
}

/** The vote: rows in ballot order with shares and ranks, plus its clock. */
export function useBallot(): { rows: BallotRow[]; total: number; winners: number; leader: BallotRow | null; command: string; clock: ClockView | null } | null {
  const [ballot, clock] = useOverlay((s) => [s.round.ballot, clocksOf(s.snapshot.session, s.now).ballot] as const, { time: true });
  return useMemo(() => ballot && { ...ballot, clock }, [ballot, clock]);
}

export function useSubmissions() {
  const [subs, clock] = useOverlay((s) => [s.round.submissions, clocksOf(s.snapshot.session, s.now).submissions] as const, { time: true });
  return useMemo(() => ({ ...subs, clock }), [subs, clock]);
}

/** Top challengers, season plus tonight. */
export function useLeaderboard(limit?: number): ChallengerRow[] {
  const rows = useOverlay((s) => s.board.leaderboard);
  return useMemo(() => (limit ? rows.slice(0, limit) : rows), [rows, limit]);
}

export function useSeason() {
  return useOverlay((s) => ({ totals: s.board.totals, record: s.board.record, streaks: s.board.streaks, history: s.board.history }));
}

export function useMetric(id: string): MetricView | null {
  return useOverlay((s) => s.board.metrics[id] ?? null);
}

export function useMetrics(): Record<string, MetricView> {
  return useOverlay((s) => s.board.metrics);
}

/** Server time, ticking. Prefer the clock hooks; this re-renders four times a second. */
export function useNow() {
  return useOverlay((s) => s.now, { time: true });
}

/**
 * Run `handler` for overlay moments: `'round.call'`, `['idea', 'votes']`, or `'*'` for all of them.
 * The handler can change between renders without re-subscribing.
 */
export function useOverlayEvent<T extends OverlayEventType>(type: T | T[] | '*', handler: (e: EventOf<T>) => void) {
  const store = useOverlayStore();
  const fn = useRef(handler);
  useEffect(() => {
    fn.current = handler;
  });
  const key = Array.isArray(type) ? type.join() : type;
  useEffect(() => {
    const types = key === '*' ? null : new Set(key.split(','));
    return store.onEvent((e) => {
      if (!types || types.has(e.type)) fn.current(e as never);
    });
  }, [store, key]);
}

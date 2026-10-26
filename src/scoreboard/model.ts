import { useEffect, useMemo, useReducer } from 'react';
import type { Difficulty } from '@/model';

/**
 * One night of Streamer vs. Chat. Chat sets challenges ("bouts"); the streamer
 * clearing one scores its points for the streamer, failing it scores them for chat.
 * Bouts are grouped into periods (like innings or quarters).
 */

export type Side = 'streamer' | 'chat';
export const SIDES: Side[] = ['streamer', 'chat'];
export const SIDE_LABEL: Record<Side, string> = { streamer: 'Streamer', chat: 'Chat' };

export const STREAMER_HANDLE = 'nova_plays';
export const PERIODS = 4;
/** "First to" target for the race view. */
export const TARGET = 5000;

export type Bout = {
  n: number;
  period: number;
  title: string;
  objective: string;
  by: string;
  difficulty: Difficulty;
  points: number;
  /** Seconds, or null for untimed. */
  limit: number | null;
  /** Steps to clear (kills, rounds…). */
  goal: number;
  maxTries: number | null;
  winner: Side | null;
  /** Seconds it took, once resolved. */
  took?: number;
};

const NIGHT: Bout[] = [
  { n: 1, period: 1, title: 'Pistol Purist', objective: 'Win the next round using only pistols.', by: 'nova_rx', difficulty: 'medium', points: 500, limit: 600, goal: 1, maxTries: 3, winner: 'streamer', took: 344 },
  { n: 2, period: 1, title: 'Inverted 10', objective: 'Play for 10 minutes with inverted look.', by: 'kodawan', difficulty: 'medium', points: 500, limit: 600, goal: 1, maxTries: null, winner: 'chat', took: 600 },
  { n: 3, period: 1, title: 'Nature Doc', objective: 'Narrate the round like a wildlife documentary.', by: 'birb_watch', difficulty: 'easy', points: 250, limit: 240, goal: 1, maxTries: null, winner: 'streamer', took: 240 },
  { n: 4, period: 2, title: 'No Heals Run', objective: 'Finish the match without a healing item.', by: 'pixelbrat', difficulty: 'hard', points: 750, limit: null, goal: 1, maxTries: 1, winner: 'chat', took: 1140 },
  { n: 5, period: 2, title: 'Crouch Walk Only', objective: 'Win a round without ever standing up.', by: 'lowkeyleo', difficulty: 'medium', points: 500, limit: 300, goal: 1, maxTries: 3, winner: 'streamer', took: 212 },
  { n: 6, period: 2, title: 'Knife Only Round', objective: 'Win one round using only your melee weapon.', by: 'mossgirl', difficulty: 'hard', points: 750, limit: 300, goal: 1, maxTries: 3, winner: 'chat', took: 300 },
  { n: 7, period: 3, title: 'Silent Round', objective: 'Win a round without saying a single word.', by: 'quietqueen', difficulty: 'medium', points: 500, limit: 300, goal: 1, maxTries: 2, winner: 'streamer', took: 268 },
  { n: 8, period: 3, title: 'Five Stack Streak', objective: 'Get 5 eliminations in a row without dying.', by: 'teaandtoast', difficulty: 'hard', points: 750, limit: 900, goal: 5, maxTries: 3, winner: null },
  { n: 9, period: 3, title: 'Chat Picks Agent', objective: 'Win the next match on the agent chat picks.', by: 'kodawan', difficulty: 'easy', points: 250, limit: null, goal: 1, maxTries: 1, winner: null },
  { n: 10, period: 4, title: 'No Minimap', objective: 'Win a round with the minimap turned off.', by: 'nova_rx', difficulty: 'medium', points: 500, limit: 600, goal: 1, maxTries: 3, winner: null },
  { n: 11, period: 4, title: 'Eco Every Round', objective: 'Win 3 rounds without buying a rifle.', by: 'pixelbrat', difficulty: 'hard', points: 750, limit: 900, goal: 3, maxTries: 2, winner: null },
  { n: 12, period: 4, title: 'Ace Attempt', objective: 'Eliminate the whole enemy team yourself.', by: 'nova_rx', difficulty: 'ridiculous', points: 1000, limit: 900, goal: 1, maxTries: 5, winner: null },
];

export type Night = { date: string; game: string; streamer: number; chat: number; bouts: [number, number] };

/** Previous nights this season, newest first. */
export const SEASON: Night[] = [
  { date: 'Oct 22', game: 'Valorant', streamer: 4250, chat: 3500, bouts: [7, 5] },
  { date: 'Oct 20', game: 'Apex Legends', streamer: 2750, chat: 4000, bouts: [4, 7] },
  { date: 'Oct 17', game: 'Valorant', streamer: 5000, chat: 2250, bouts: [9, 3] },
  { date: 'Oct 15', game: 'Celeste', streamer: 1500, chat: 3250, bouts: [3, 6] },
  { date: 'Oct 13', game: 'Valorant', streamer: 3750, chat: 3500, bouts: [6, 6] },
  { date: 'Oct 10', game: 'Elden Ring', streamer: 2000, chat: 4500, bouts: [3, 8] },
];

/* ───────────────────────── State ───────────────────────── */

export type Live = { index: number; elapsed: number; tries: number; progress: number; running: boolean };
type Core = { bouts: Bout[]; live: Live };
type State = Core & { past: Core[] };

export type Action =
  | { type: 'resolve'; side: Side }
  | { type: 'fail' }
  | { type: 'progress' }
  | { type: 'tick' }
  | { type: 'toggle' }
  | { type: 'undo' }
  | { type: 'reset' };

const fresh = (index: number, running: boolean): Live => ({ index, elapsed: 0, tries: 0, progress: 0, running });

function init(): State {
  return { bouts: NIGHT, live: { index: 7, elapsed: 488, tries: 1, progress: 3, running: true }, past: [] };
}

function resolve({ bouts, live }: Core, side: Side): Core {
  if (!bouts[live.index]) return { bouts, live };
  return {
    bouts: bouts.map((b, i) => (i === live.index ? { ...b, winner: side, took: live.elapsed } : b)),
    live: fresh(live.index + 1, live.running),
  };
}

function step(core: Core, action: Action): Core {
  const { bouts, live } = core;
  const bout = bouts[live.index];
  switch (action.type) {
    case 'resolve':
      return resolve(core, action.side);
    case 'fail': {
      if (!bout) return core;
      const tries = live.tries + 1;
      return bout.maxTries && tries >= bout.maxTries ? resolve(core, 'chat') : { bouts, live: { ...live, tries } };
    }
    case 'progress': {
      if (!bout) return core;
      const progress = live.progress + 1;
      return progress >= bout.goal ? resolve(core, 'streamer') : { bouts, live: { ...live, progress } };
    }
    case 'tick': {
      if (!bout || !live.running) return core;
      const elapsed = live.elapsed + 1;
      return bout.limit && elapsed >= bout.limit ? resolve(core, 'chat') : { bouts, live: { ...live, elapsed } };
    }
    case 'toggle':
      return { bouts, live: { ...live, running: !live.running } };
    default:
      return core;
  }
}

function reducer(state: State, action: Action): State {
  if (action.type === 'reset') return init();
  if (action.type === 'undo') {
    const prev = state.past.at(-1);
    return prev ? { ...prev, live: { ...prev.live, running: state.live.running }, past: state.past.slice(0, -1) } : state;
  }
  const next = step(state, action);
  if (next === state) return state;
  const record = action.type === 'resolve' || action.type === 'fail' || action.type === 'progress';
  return { ...next, past: record ? [...state.past.slice(-19), { bouts: state.bouts, live: state.live }] : state.past };
}

/* ───────────────────────── Derived board ───────────────────────── */

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function longestRun(done: Bout[], side: Side) {
  let best = 0;
  let run = 0;
  for (const b of done) {
    run = b.winner === side ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

export type PeriodStatus = 'done' | 'live' | 'next';

function derive({ bouts, live }: Core) {
  const active = bouts[live.index] ?? null;
  const done = bouts.filter((b) => b.winner);

  const score = (side: Side) => {
    const won = done.filter((b) => b.winner === side);
    return {
      pts: sum(won.map((b) => b.points)),
      wins: won.length,
      hard: won.filter((b) => b.difficulty === 'hard' || b.difficulty === 'ridiculous').length,
      best: longestRun(done, side),
    };
  };
  const totals = { streamer: score('streamer'), chat: score('chat') };

  const periods = Array.from({ length: PERIODS }, (_, i) => {
    const n = i + 1;
    const list = bouts.filter((b) => b.period === n);
    const side = (s: Side) => {
      const won = list.filter((b) => b.winner === s);
      return { pts: sum(won.map((b) => b.points)), wins: won.length };
    };
    const streamer = side('streamer');
    const chat = side('chat');
    const status: PeriodStatus = list.every((b) => b.winner) ? 'done' : active?.period === n ? 'live' : 'next';
    const diff = streamer.pts - chat.pts || streamer.wins - chat.wins;
    const winner: Side | null = status === 'done' && diff ? (diff > 0 ? 'streamer' : 'chat') : null;
    return { n, bouts: list, streamer, chat, status, winner };
  });
  const periodsWon = {
    streamer: periods.filter((p) => p.winner === 'streamer').length,
    chat: periods.filter((p) => p.winner === 'chat').length,
  };

  /** Cumulative streamer − chat points, starting at 0, one entry per resolved bout. */
  const momentum = done.reduce<number[]>((acc, b) => [...acc, acc.at(-1)! + (b.winner === 'streamer' ? b.points : -b.points)], [0]);
  let leadChanges = 0;
  let lastSign = 0;
  for (const v of momentum) {
    const s = Math.sign(v);
    if (s && lastSign && s !== lastSign) leadChanges++;
    if (s) lastSign = s;
  }

  const lead = totals.streamer.pts - totals.chat.pts;
  const leader: Side | null = lead > 0 ? 'streamer' : lead < 0 ? 'chat' : null;

  const last = done.at(-1);
  let streakN = 0;
  for (let i = done.length - 1; i >= 0 && done[i].winner === last?.winner; i--) streakN++;

  const timed = active?.limit != null;
  return {
    bouts,
    live,
    active,
    done,
    totals,
    periods,
    periodsWon,
    momentum,
    leadChanges,
    lead,
    leader,
    streak: { side: last?.winner ?? null, n: streakN },
    over: !active,
    period: active?.period ?? PERIODS,
    timed,
    /** Seconds left when timed, seconds elapsed when not. */
    clock: active ? (active.limit != null ? Math.max(0, active.limit - live.elapsed) : live.elapsed) : 0,
    timeFrac: active?.limit ? live.elapsed / active.limit : 0,
    progFrac: active ? live.progress / active.goal : 0,
    triesLeft: active?.maxTries != null ? active.maxTries - live.tries : null,
  };
}

export type Board = ReturnType<typeof derive>;

/** The simulated night every board on the page reads from. The clock ticks once a second. */
export function useBoard() {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  useEffect(() => {
    const id = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(id);
  }, []);
  const board = useMemo(() => derive(state), [state]);
  return { board, dispatch, canUndo: state.past.length > 0 };
}

import type { Challenge, ChallengerStanding, Idea, Metric, OverlaySnapshot, Result, Scene, SessionRecord, Side, Stage } from './types';
import { SIDES } from './types';

/**
 * Pure game maths: everything a theme shows that isn't stored. Computed once per snapshot revision
 * (see store.ts) and read through the hooks, never by themes directly.
 */

export type SideScore = { points: number; wins: number };
export type Score = Record<Side, SideScore>;
export type Streak = { side: Side | null; count: number };

export type LineupSlot = {
  challenge: Challenge;
  index: number;
  /** From 1. */
  number: number;
  /** done: decided (or skipped, when `winner` is null) · live: being played · next: still to come. */
  status: 'done' | 'live' | 'next';
  /** Who took it; on the live slot, set once a winner is called. */
  winner: Side | null;
  skipped: boolean;
  /** Seconds it took, once done. */
  took: number | null;
};

export type BallotRow = {
  challenge: Challenge;
  /** What chat types to vote for it. Fixed while votes come in. */
  key: number;
  votes: number;
  /** Of all votes, 0–1. */
  share: number;
  /** Against the leader's votes, 0–1: bar widths. */
  ofTop: number;
  /** 1 = most votes. */
  rank: number;
  leading: boolean;
  /** Inside the cut for the lineup right now. */
  making: boolean;
};

export type ChallengerRow = ChallengerStanding & {
  rank: number;
  /** Points earned tonight, already in `points`. */
  tonight: number;
  /** Places climbed since the start of the night (negative: dropped). */
  move: number;
};

export type MetricView = Metric & {
  /** 0–1 toward a numeric target, else null. */
  progress: number | null;
  reached: boolean;
};

export type SessionSummary = SessionRecord & { winner: Side | null; sweep: boolean };

export type RoundModel = {
  stage: Stage;
  scene: Scene;
  session: { id: string; name: string | null; startedAt: number } | null;

  submissions: { open: boolean; ideas: Idea[]; count: number; latest: Idea | null; command: string };
  ballot: { rows: BallotRow[]; total: number; winners: number; votesPerViewer: number; leader: BallotRow | null; command: string } | null;

  lineup: LineupSlot[];
  progress: { played: number; total: number; /** The slot in play (or next up), from 1. */ number: number; remaining: number };

  /** The challenge in play, from the start countdown until the next one starts. */
  challenge: Challenge | null;
  slot: LineupSlot | null;
  upNext: Challenge | null;
  attempts: { current: number; max: number | null; left: number | null; /** On the final try. */ last: boolean } | null;
  call: { winner: Side; points: number; at: number } | null;

  /** Tonight, counting a called winner straight away. */
  score: Score;
  leader: Side | null;
  lead: number;
  streak: Streak;
  bestStreak: Record<Side, number>;
  /** Streamer − chat points after each decided challenge, from 0. */
  momentum: number[];
  leadChanges: number;
  /** Once the session's over. */
  winner: Side | null;
  /** A side that took every challenge decided tonight. */
  sweep: Side | null;
  /** Whose ideas earned the most tonight. */
  mvp: { name: string; points: number } | null;
};

export type BoardModel = {
  channel: OverlaySnapshot['channel'];
  sides: OverlaySnapshot['sides'];
  /** Season plus tonight so far: the overall board score. */
  totals: Record<Side, SideScore & { sessions: number }>;
  leader: Side | null;
  lead: number;
  /** Streamer's share of all points, 0–1 (0.5 when nothing's scored). */
  share: number;
  /** The streamer's session record. */
  record: { played: number; won: number; lost: number; drawn: number };
  streaks: Record<Side, { session: { current: number; best: number }; challenge: { current: number; best: number }; sweeps: number }>;
  /** Finished sessions, newest first; tonight's joins once it's over. */
  history: SessionSummary[];
  leaderboard: ChallengerRow[];
  metrics: Record<string, MetricView>;
  sponsors: OverlaySnapshot['sponsors'];
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const other = (s: Side): Side => (s === 'streamer' ? 'chat' : 'streamer');
const leaderOf = (a: number, b: number): Side | null => (a > b ? 'streamer' : b > a ? 'chat' : null);

/** Decided results in play order, with a called-but-not-filed winner on the end. */
function decided(snap: OverlaySnapshot): { challenge: Challenge; winner: Side }[] {
  const s = snap.session;
  if (!s) return [];
  const byId = new Map(s.lineup.map((c) => [c.id, c]));
  const list = s.results.flatMap((r) => (r.winner && byId.has(r.challengeId) ? [{ challenge: byId.get(r.challengeId)!, winner: r.winner }] : []));
  const live = s.round && s.lineup[s.round.index];
  if (live && s.round?.call && !s.results.some((result) => result.challengeId === live.id)) {
    list.push({ challenge: live, winner: s.round.call.winner });
  }
  return list;
}

function scoreOf(list: { challenge: Challenge; winner: Side }[]): Score {
  const side = (x: Side) => {
    const won = list.filter((d) => d.winner === x);
    return { points: sum(won.map((d) => d.challenge.points)), wins: won.length };
  };
  return { streamer: side('streamer'), chat: side('chat') };
}

function runs(winners: Side[]) {
  const best = { streamer: 0, chat: 0 };
  let run = 0;
  let prev: Side | null = null;
  for (const w of winners) {
    run = w === prev ? run + 1 : 1;
    prev = w;
    best[w] = Math.max(best[w], run);
  }
  return { current: { side: prev, count: prev ? run : 0 } as Streak, best };
}

function lineupSlots(snap: OverlaySnapshot): LineupSlot[] {
  const s = snap.session;
  if (!s) return [];
  return s.lineup.map((challenge, index) => {
    const r: Result | undefined = s.results[index];
    const live = s.round?.index === index;
    return {
      challenge,
      index,
      number: index + 1,
      status: r ? 'done' : live ? 'live' : 'next',
      winner: r ? r.winner : live ? (s.round?.call?.winner ?? null) : null,
      skipped: !!r && r.winner === null,
      took: r ? r.took : null,
    };
  });
}

/** Challenger points earned tonight, by lowercased name. */
function earnings(snap: OverlaySnapshot): Map<string, { name: string; points: number }> {
  const s = snap.session;
  const out = new Map<string, { name: string; points: number }>();
  if (!s) return out;
  const add = (name: string, pts: number) => {
    const k = name.toLowerCase();
    out.set(k, { name, points: (out.get(k)?.points ?? 0) + pts });
  };
  // The lineup only counts once it's locked and playing
  if (s.stage === 'live' || s.stage === 'done') for (const c of s.lineup) add(c.by, snap.scoring.selectedPoints);
  for (const d of decided(snap)) if (d.winner === 'chat') add(d.challenge.by, snap.scoring.defeatedPoints);
  return out;
}

export function deriveRound(snap: OverlaySnapshot): RoundModel {
  const s = snap.session;
  const stage: Stage = s?.stage ?? 'idle';
  const list = decided(snap);
  const score = scoreOf(list);
  const { current: streak, best: bestStreak } = runs(list.map((d) => d.winner));

  const momentum = list.reduce<number[]>((acc, d) => [...acc, acc.at(-1)! + (d.winner === 'streamer' ? d.challenge.points : -d.challenge.points)], [0]);
  let leadChanges = 0;
  let sign = 0;
  for (const v of momentum) {
    const x = Math.sign(v);
    if (x && sign && x !== sign) leadChanges++;
    if (x) sign = x;
  }

  const lineup = lineupSlots(snap);
  const round = s?.round ?? null;
  const slot = round ? (lineup[round.index] ?? null) : null;
  const challenge = slot?.challenge ?? null;
  const played = s?.results.length ?? 0;
  const total = s?.lineup.length ?? 0;

  let ballot: RoundModel['ballot'] = null;
  if (s?.ballot) {
    const b = s.ballot;
    const totalVotes = sum(b.entries.map((e) => e.votes));
    const top = Math.max(0, ...b.entries.map((e) => e.votes));
    const order = [...b.entries].sort((x, y) => y.votes - x.votes);
    const rows = b.entries.map((e, i) => {
      const rank = order.indexOf(e) + 1;
      return {
        challenge: e.challenge,
        key: i + 1,
        votes: e.votes,
        share: totalVotes ? e.votes / totalVotes : 0,
        ofTop: top ? e.votes / top : 0,
        rank,
        leading: top > 0 && e.votes === top,
        making: rank <= b.winners,
      };
    });
    ballot = {
      rows,
      total: totalVotes,
      winners: b.winners,
      votesPerViewer: b.votesPerViewer,
      leader: rows.find((r) => r.rank === 1 && r.votes > 0) ?? null,
      command: b.command,
    };
  }

  const finalLead = score.streamer.points - score.chat.points;
  const winner = stage === 'done' ? leaderOf(score.streamer.points, score.chat.points) : null;
  const sweepSide = total > 0 && list.length === total && list.every((d) => d.winner === list[0].winner) ? list[0].winner : null;
  const mvp = [...earnings(snap).values()].sort((a, b) => b.points - a.points)[0] ?? null;

  return {
    stage,
    scene: s ? (stage === 'live' && round?.call ? 'result' : stage) : 'idle',
    session: s ? { id: s.id, name: s.name, startedAt: s.startedAt } : null,
    submissions: {
      open: !!s?.submissions.open,
      ideas: s?.submissions.ideas ?? [],
      count: s?.submissions.ideas.length ?? 0,
      latest: s?.submissions.ideas[0] ?? null,
      command: s?.submissions.command ?? '!challenge',
    },
    ballot,
    lineup,
    progress: { played, total, number: Math.min(total, (round?.index ?? played) + 1), remaining: total - played },
    challenge,
    slot,
    upNext: s && round ? (s.lineup[round.index + 1] ?? null) : (s?.lineup[played] ?? null),
    attempts:
      challenge && round
        ? {
            current: round.attempt,
            max: challenge.maxAttempts,
            left: challenge.maxAttempts == null ? null : Math.max(0, challenge.maxAttempts - round.attempt),
            last: challenge.maxAttempts != null && round.attempt >= challenge.maxAttempts,
          }
        : null,
    call: challenge && round?.call ? { winner: round.call.winner, points: challenge.points, at: round.call.at } : null,
    score,
    leader: leaderOf(score.streamer.points, score.chat.points),
    lead: Math.abs(finalLead),
    streak,
    bestStreak,
    momentum,
    leadChanges,
    winner,
    sweep: stage === 'done' || stage === 'live' ? sweepSide : null,
    mvp: mvp && mvp.points > 0 ? mvp : null,
  };
}

function summarize(r: SessionRecord): SessionSummary {
  const winner = leaderOf(r.points.streamer, r.points.chat);
  return { ...r, winner, sweep: !!winner && r.wins[winner] > 0 && r.wins[other(winner)] === 0 };
}

export function deriveBoard(snap: OverlaySnapshot, round: RoundModel): BoardModel {
  const s = snap.session;
  // Tonight files into the season once its results are up
  const tonight: SessionRecord | null =
    s && round.stage === 'done'
      ? {
          id: s.id,
          name: s.name ?? 'Tonight',
          endedAt: snap.serverTime,
          points: { streamer: round.score.streamer.points, chat: round.score.chat.points },
          wins: { streamer: round.score.streamer.wins, chat: round.score.chat.wins },
        }
      : null;
  const history = [...(tonight && !snap.history.some((item) => item.id === tonight.id) ? [tonight] : []), ...snap.history].map(summarize);
  const live = tonight ? null : round.score;

  const totals = Object.fromEntries(
    SIDES.map((side) => [
      side,
      {
        points: sum(history.map((h) => h.points[side])) + (live?.[side].points ?? 0),
        wins: sum(history.map((h) => h.wins[side])) + (live?.[side].wins ?? 0),
        sessions: history.filter((h) => h.winner === side).length,
      },
    ]),
  ) as BoardModel['totals'];

  const streaks = Object.fromEntries(
    SIDES.map((side) => {
      let current = 0;
      for (const h of history) {
        if (h.winner !== side) break;
        current++;
      }
      const best = runs([...history].reverse().flatMap((h) => (h.winner ? [h.winner] : []))).best[side];
      return [
        side,
        {
          session: { current, best },
          challenge: { current: round.streak.side === side ? round.streak.count : 0, best: round.bestStreak[side] },
          sweeps: history.filter((h) => h.sweep && h.winner === side).length,
        },
      ];
    }),
  ) as BoardModel['streaks'];

  // Season standings plus tonight's earnings, re-ranked
  const before = [...snap.challengers].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  const earned = earnings(snap);
  const rows = new Map(before.map((c) => [c.name.toLowerCase(), { ...c, tonight: 0 }]));
  if (snap.challengerPointsIncludeCurrentSession) {
    for (const [key, row] of rows) rows.set(key, { ...row, tonight: earned.get(key)?.points ?? 0 });
  } else {
    for (const [k, e] of earned) {
      const row = rows.get(k) ?? { id: `u_${k}`, name: e.name, points: 0, played: 0, won: 0, tonight: 0 };
      rows.set(k, { ...row, points: row.points + e.points, tonight: e.points });
    }
  }
  const leaderboard = [...rows.values()]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((c, i) => {
      const was = before.findIndex((b) => b.name.toLowerCase() === c.name.toLowerCase());
      return { ...c, rank: i + 1, move: was < 0 ? 0 : was - i };
    });

  const metrics = Object.fromEntries(
    snap.metrics.map((m) => {
      const numeric = typeof m.value === 'number' && typeof m.target === 'number' && m.target > 0;
      return [
        m.id,
        {
          ...m,
          progress: numeric ? Math.min(1, (m.value as number) / (m.target as number)) : null,
          reached: numeric ? (m.value as number) >= (m.target as number) : m.target != null && m.value === m.target,
        },
      ];
    }),
  );

  const pts = totals.streamer.points + totals.chat.points;
  return {
    channel: snap.channel,
    sides: snap.sides,
    totals,
    leader: leaderOf(totals.streamer.points, totals.chat.points),
    lead: Math.abs(totals.streamer.points - totals.chat.points),
    share: pts ? totals.streamer.points / pts : 0.5,
    record: {
      played: history.length,
      won: history.filter((h) => h.winner === 'streamer').length,
      lost: history.filter((h) => h.winner === 'chat').length,
      drawn: history.filter((h) => h.winner === null).length,
    },
    streaks,
    history,
    leaderboard,
    metrics,
    sponsors: snap.sponsors,
  };
}

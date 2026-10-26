import { clockFrom, pauseClock, resumeClock } from '@/overlay/sdk/clock';
import type { Ballot, Challenge, Session, Side } from '@/overlay/sdk/types';

/**
 * The session game loop as pure steps on a `Session`: what the Durable Object does when the control room
 * presses a button. The mock source runs these; each returns the session unchanged when the step
 * doesn't apply, so a stray click is harmless.
 */

export type EngineOptions = {
  /** Seconds submissions are meant to stay open (a guide; it never closes them). */
  submitSecs: number;
  voteSecs: number;
  /** How many make the lineup. */
  lineupSize: number;
  /** Pre-start countdown on each challenge. */
  countdownSecs: number;
  /** After a winner's called, start the next challenge on its own after `autoNextSecs`. */
  autoNext: boolean;
  autoNextSecs: number;
};

export const DEFAULT_OPTIONS: EngineOptions = { submitSecs: 600, voteSecs: 90, lineupSize: 4, countdownSecs: 5, autoNext: true, autoNextSecs: 45 };

export function openSession(now: number, o: EngineOptions, id = `s_${now.toString(36)}`): Session {
  return {
    id,
    name: null,
    stage: 'open',
    startedAt: now,
    submissions: { open: true, clock: clockFrom(now, o.submitSecs), ideas: [], command: '!challenge' },
    ballot: null,
    lineup: [],
    results: [],
    round: null,
  };
}

export function addIdea(s: Session, challenge: Challenge, now: number): Session {
  if (s.stage !== 'open' || !s.submissions.open || s.submissions.ideas.some((i) => i.challenge.id === challenge.id)) return s;
  return { ...s, submissions: { ...s.submissions, ideas: [{ challenge, at: now }, ...s.submissions.ideas] } };
}

export function setSubmissionsOpen(s: Session, open: boolean): Session {
  return s.stage === 'open' ? { ...s, submissions: { ...s.submissions, open } } : s;
}

/** Every idea goes on the ballot in the order it came in, unless `ids` picks some. */
export function openVote(s: Session, now: number, o: EngineOptions, ids?: string[]): Session {
  if (s.stage !== 'open') return s;
  const ideas = [...s.submissions.ideas].reverse().filter((i) => !ids || ids.includes(i.challenge.id));
  if (!ideas.length) return s;
  const ballot: Ballot = {
    clock: clockFrom(now, o.voteSecs),
    winners: Math.min(o.lineupSize, Math.max(1, ideas.length - 1)),
    votesPerViewer: 1,
    entries: ideas.map((i) => ({ challenge: i.challenge, votes: 0 })),
    command: '!vote',
  };
  return { ...s, stage: 'vote', submissions: { ...s.submissions, open: false }, ballot };
}

export function castVotes(s: Session, votes: Record<string, number>): Session {
  if (s.stage !== 'vote' || !s.ballot) return s;
  return { ...s, ballot: { ...s.ballot, entries: s.ballot.entries.map((e) => ({ ...e, votes: e.votes + (votes[e.challenge.id] ?? 0) })) } };
}

/** The top `winners` by votes become the lineup, most-voted first; ties go to whichever went up first. */
export function closeVote(s: Session, now: number): Session {
  if (s.stage !== 'vote' || !s.ballot) return s;
  const order = s.ballot.entries.map((e, i) => ({ ...e, i })).sort((a, b) => b.votes - a.votes || a.i - b.i);
  return {
    ...s,
    stage: 'lock',
    ballot: { ...s.ballot, clock: { ...s.ballot.clock, endsAt: Math.min(now, s.ballot.clock.endsAt ?? now) } },
    lineup: order.slice(0, s.ballot.winners).map((e) => e.challenge),
  };
}

export const rename = (s: Session, name: string | null): Session => ({ ...s, name });

function roundAt(index: number, s: Session, now: number, o: EngineOptions): Session['round'] {
  const c = s.lineup[index];
  return c ? { index, clock: clockFrom(now + o.countdownSecs * 1000, c.timeLimit), attempt: 1, call: null } : null;
}

export function start(s: Session, now: number, o: EngineOptions): Session {
  if (s.stage !== 'lock' || !s.lineup.length) return s;
  return { ...s, stage: 'live', results: [], round: roundAt(0, s, now, o) };
}

/** Call a winner. The clock stops where it is; auto-next counts down to the next challenge. */
export function call(s: Session, side: Side, now: number, o: EngineOptions): Session {
  const r = s.round;
  if (s.stage !== 'live' || !r || r.call) return s;
  return {
    ...s,
    round: { ...r, clock: pauseClock(r.clock, now), call: { winner: side, at: now, next: o.autoNext ? clockFrom(now, o.autoNextSecs) : null } },
  };
}

export function undo(s: Session, now: number): Session {
  const r = s.round;
  if (!r?.call) return s;
  return { ...s, round: { ...r, clock: resumeClock(r.clock, now), call: null } };
}

/** A failed try. Out of tries is a loss: chat takes it. */
export function fail(s: Session, now: number, o: EngineOptions): Session {
  const r = s.round;
  const c = r && s.lineup[r.index];
  if (s.stage !== 'live' || !r || !c || r.call) return s;
  if (c.maxAttempts != null && r.attempt >= c.maxAttempts) return call(s, 'chat', now, o);
  return { ...s, round: { ...r, attempt: r.attempt + 1 } };
}

export function pause(s: Session, now: number): Session {
  const r = s.round;
  return r && !r.call ? { ...s, round: { ...r, clock: pauseClock(r.clock, now) } } : s;
}

export function resume(s: Session, now: number): Session {
  const r = s.round;
  return r && !r.call ? { ...s, round: { ...r, clock: resumeClock(r.clock, now) } } : s;
}

/** File the live challenge (its called winner, or a skip) and move on, or finish after the last. */
function advance(s: Session, winner: Side | null, now: number, o: EngineOptions): Session {
  const r = s.round;
  const c = r && s.lineup[r.index];
  if (s.stage !== 'live' || !r || !c) return s;
  const t = r.clock.pausedAt ?? now;
  const took = Math.max(0, Math.round((t - r.clock.startsAt) / 1000));
  const results = [...s.results, { challengeId: c.id, winner, attempts: r.attempt, took }];
  const done = results.length >= s.lineup.length;
  return { ...s, stage: done ? 'done' : 'live', results, round: done ? null : roundAt(r.index + 1, s, now, o) };
}

export const next = (s: Session, now: number, o: EngineOptions) => (s.round?.call ? advance(s, s.round.call.winner, now, o) : s);
export const skip = (s: Session, now: number, o: EngineOptions) => advance(s, null, now, o);

/** Stop early: whatever's left goes unplayed. */
export function end(s: Session): Session {
  if (s.stage === 'done') return s;
  return { ...s, stage: 'done', round: null, lineup: s.lineup.slice(0, s.results.length) };
}

/** Time-driven steps: the vote closing, and auto-next firing. */
export function tick(s: Session, now: number, o: EngineOptions): Session {
  if (s.stage === 'vote' && s.ballot?.clock.endsAt != null && now >= s.ballot.clock.endsAt) return closeVote(s, now);
  const n = s.round?.call?.next;
  if (s.stage === 'live' && n?.endsAt != null && now >= n.endsAt) return next(s, now, o);
  return s;
}

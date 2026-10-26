import type { RoundModel } from './derive';
import type { OverlayEvent, OverlaySnapshot } from './types';

/**
 * The moments between two snapshots, so sources only have to send state. Nothing fires for the first
 * snapshot: an overlay opening mid-session shouldn't replay the night.
 */
export function diffEvents(prev: OverlaySnapshot | null, next: OverlaySnapshot, was: RoundModel | null, now: RoundModel): OverlayEvent[] {
  if (!prev || !was) return [];
  const out: OverlayEvent[] = [];
  const a = prev.session;
  const b = next.session;

  if (was.stage !== now.stage) out.push({ type: 'stage', from: a ? was.stage : null, to: b ? now.stage : null });

  if (b) {
    const seen = new Set(a?.submissions.ideas.map((i) => i.challenge.id));
    for (const idea of b.submissions.ideas.filter((i) => !seen.has(i.challenge.id)).slice(0, 5).reverse()) out.push({ type: 'idea', challenge: idea.challenge });
  }

  if (now.ballot && was.ballot && now.ballot.total > was.ballot.total) {
    out.push({ type: 'votes', total: now.ballot.total, delta: now.ballot.total - was.ballot.total, leader: now.ballot.leader?.challenge.id ?? null });
  }

  if (b?.lineup.length && !a?.lineup.length) out.push({ type: 'lineup', lineup: b.lineup });

  // Challenges filed since last time
  if (b && a && b.results.length > a.results.length) {
    for (const r of b.results.slice(a.results.length)) {
      const c = b.lineup.find((x) => x.id === r.challengeId);
      if (c) out.push({ type: 'round.end', challenge: c, winner: r.winner });
    }
  }

  const ra = a?.round;
  const rb = b?.round;
  const c = now.challenge;
  if (rb && c) {
    if (!ra || ra.index !== rb.index) out.push({ type: 'round.start', challenge: c, index: rb.index });
    else {
      if (rb.attempt > ra.attempt) out.push({ type: 'round.attempt', challenge: c, attempt: rb.attempt, max: c.maxAttempts });
      if (rb.clock.pausedAt != null && ra.clock.pausedAt == null) out.push({ type: 'round.pause', challenge: c });
      if (rb.clock.pausedAt == null && ra.clock.pausedAt != null) out.push({ type: 'round.resume', challenge: c });
      if (ra.call && !rb.call) out.push({ type: 'round.undo', challenge: c });
    }
    if (rb.call && (!ra?.call || ra.index !== rb.index)) out.push({ type: 'round.call', challenge: c, winner: rb.call.winner, points: c.points });
  }

  if (b && was.leader !== now.leader && (now.stage === 'live' || now.stage === 'done')) out.push({ type: 'lead', leader: now.leader, from: was.leader });

  if (now.streak.side && now.streak.count >= 2 && (now.streak.side !== was.streak.side || now.streak.count > was.streak.count)) {
    out.push({ type: 'streak', side: now.streak.side, count: now.streak.count });
  }

  if (now.stage === 'done' && was.stage !== 'done') {
    out.push({ type: 'session.end', winner: now.winner, points: { streamer: now.score.streamer.points, chat: now.score.chat.points } });
  }

  const before = new Map(prev.metrics.map((m) => [m.id, m]));
  for (const m of next.metrics) {
    const p = before.get(m.id);
    if (!p || p.value === m.value) continue;
    out.push({ type: 'metric', id: m.id, value: m.value, from: p.value });
    if (typeof m.value === 'number' && typeof p.value === 'number' && typeof m.target === 'number' && p.value < m.target && m.value >= m.target) {
      out.push({ type: 'goal', id: m.id, value: m.value });
    }
  }

  return out;
}

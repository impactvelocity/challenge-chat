import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { FlameIcon } from '@/components/icons';
import { SIDES, useLineup, useMetric, useOverlayEvent, useScore, useSeason, useSides, useStage, useStreak, type Side } from '@/overlay/sdk';
import { fmt, LiveDot, Num } from '@/scoreboard/parts';

/* Comic Chaos draws its own scoreboard, goal and impact words; Broadcast's leaderboard, counter, alerts and
   sponsor bar carry no light-on-dark utilities, so they're restyled in comic.css instead. */

/** Both sides as inked name plates with big outlined numbers, the challenge track underneath. */
export function Scoreboard() {
  const stage = useStage();
  const { score } = useScore();
  const { current: streak } = useStreak();
  const { slots, progress } = useLineup();
  const season = useSeason();
  const sides = useSides();
  const [flash, setFlash] = useState<{ side: string | null; n: number }>({ side: null, n: 0 });
  useOverlayEvent('lead', (e) => setFlash((f) => ({ side: e.leader, n: f.n + 1 })));

  // Before the lineup's played, the board shows the season instead of tonight's 0–0
  const tonight = stage === 'live' || stage === 'done';
  const value = (side: Side) => (tonight ? score[side].points : season.totals[side].sessions);

  return (
    <div className="bc-card cc-score" data-flat="">
      <div className="cc-head">
        <span className="cc-cap">
          {stage === 'live' && <LiveDot />}
          {tonight ? (stage === 'done' ? 'Final' : 'Tonight') : 'Season'}
        </span>
        <span className="cc-chip bc-num ml-auto">
          {tonight ? `${stage === 'done' ? progress.played : progress.number} / ${progress.total}` : `${season.history.length} shows`}
        </span>
      </div>
      {SIDES.map((side) => (
        <div key={side} className="cc-score-row" data-side={side} data-flash={side === flash.side ? (flash.n % 2 ? 'a' : 'b') : undefined}>
          <b className="cc-name">{sides[side].name}</b>
          {tonight && streak.side === side && streak.count >= 2 && (
            <span key={streak.count} className="cc-streak" title={`${streak.count} in a row`}>
              <FlameIcon size={14} />
              {streak.count}
            </span>
          )}
          <Num value={value(side)} className="bc-num cc-score-n" />
        </div>
      ))}
      {tonight && (
        <div className="cc-track" aria-hidden="true">
          {slots.map((slot) => (
            <i
              key={slot.challenge.id}
              data-side={slot.winner ?? undefined}
              data-skip={slot.skipped || undefined}
              data-live={(slot.status === 'live' && !slot.winner) || undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** A gauge metric with a target, e.g. followers, as a halftone bar. Goes gold once reached. */
export function Goal({ metric = 'goal' }: { metric?: string }) {
  const m = useMetric(metric);
  const [party, setParty] = useState(0);
  useOverlayEvent('goal', (e) => e.id === metric && setParty((n) => n + 1));
  if (!m || typeof m.value !== 'number') return null;
  return (
    <div key={party} className="bc-card cc-goal" data-reached={m.reached || undefined} data-celebrate={party || undefined}>
      <div className="flex items-center gap-3">
        <span className="cc-cap">{m.label}</span>
        <span className="bc-num cc-goal-n ml-auto">
          {fmt(m.value)}
          {typeof m.target === 'number' && <span className="cc-dim"> / {fmt(m.target)}</span>}
        </span>
      </div>
      <div className="cc-bar mt-3" data-size="lg">
        <i style={{ width: `${(m.progress ?? 0) * 100}%` }} />
      </div>
    </div>
  );
}

/* ───────── Impact words ───────── */

type Hit = { id: number; word: string; sub?: string; side?: Side; spot: number; tilt: number; big?: boolean };

/** Spots around the frame, clear of the centre banner, as % of the canvas. Taken in turn so two never overlap. */
const SPOTS = [
  { x: 24, y: 24 },
  { x: 64, y: 17 },
  { x: 15, y: 52 },
  { x: 74, y: 78 },
  { x: 38, y: 82 },
  { x: 80, y: 46 },
];
const CALL = ['POW!', 'KAPOW!', 'BAM!', 'BOOM!'];
const pick = (words: string[]) => words[Math.floor(Math.random() * words.length)];
let hitId = 0;
let spotAt = 0;

const hit = (h: Omit<Hit, 'id' | 'spot' | 'tilt'>): Hit => ({ ...h, id: ++hitId, spot: spotAt++ % SPOTS.length, tilt: Math.round(Math.random() * 24 - 12) });

/**
 * Big burst words on the moments: the call, a lead change, a streak, a goal, a raid or gift.
 * Two at most on screen; the rest wait their turn (and only the latest few wait).
 */
export function ImpactWords() {
  const sides = useSides();
  const [state, setState] = useState<{ on: Hit[]; wait: Hit[] }>({ on: [], wait: [] });
  const push = (h: Hit) => setState((s) => (s.on.length < 2 ? { on: [...s.on, h], wait: s.wait } : { on: s.on, wait: [...s.wait.slice(-2), h] }));
  // Stable, so a word's timer doesn't restart when another one arrives
  const done = useCallback(
    (id: number) =>
      setState((s) => {
        const [next, ...wait] = s.wait;
        const on = s.on.filter((h) => h.id !== id);
        return { on: next ? [...on, next] : on, wait };
      }),
    [],
  );

  useOverlayEvent(['round.call', 'lead', 'streak', 'goal', 'custom'], (e) => {
    switch (e.type) {
      case 'round.call':
        return push(hit({ word: pick(CALL), sub: `+${fmt(e.points)} ${sides[e.winner].name}`, side: e.winner, big: true }));
      case 'lead':
        return e.leader && push(hit({ word: 'WHAM!', sub: `${sides[e.leader].name} leads`, side: e.leader }));
      case 'streak':
        return push(hit({ word: 'ZAP!', sub: `${e.count} in a row`, side: e.side }));
      case 'goal':
        return push(hit({ word: 'BOOM!', sub: 'Goal hit' }));
      case 'custom': {
        const d = (e.data ?? {}) as { user?: string; amount?: number };
        if (e.name === 'raid') return push(hit({ word: 'RAID!', sub: d.user }));
        if (e.name === 'gift') return push(hit({ word: 'WOW!', sub: `${d.amount ?? 1} gifted` }));
      }
    }
  });

  return state.on.map((h) => <Impact key={h.id} hit={h} onDone={done} />);
}

function Impact({ hit, onDone }: { hit: Hit; onDone: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(hit.id), 1400);
    return () => clearTimeout(t);
  }, [hit.id, onDone]);
  const spot = SPOTS[hit.spot];
  return (
    <div
      className="cc-impact"
      data-side={hit.side}
      data-big={hit.big || undefined}
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, '--cc-tilt': `${hit.tilt}deg` } as CSSProperties}
    >
      <div className="cc-impact-in">
        <b>{hit.word}</b>
        {hit.sub && <span>{hit.sub}</span>}
      </div>
    </div>
  );
}

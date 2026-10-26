import { useEffect, useState } from 'react';
import { SIDES, useLineup, useOverlayEvent, useScore, useSeason, useSides, useStage, useStreak, type Side } from '@/overlay/sdk';
import { LiveDot, Num } from '@/scoreboard/parts';

/**
 * Streamer vs Chat as fighting-game health bars meeting at a VS badge. A bar is full while its side holds half
 * the score or more and drains as it falls behind. Before the lineup's played, it fights over the season instead.
 */
export function VsBar() {
  const stage = useStage();
  const { score } = useScore();
  const { current: streak } = useStreak();
  const { slots, progress } = useLineup();
  const season = useSeason();
  const sides = useSides();
  const [flash, setFlash] = useState<{ side: string | null; n: number }>({ side: null, n: 0 });
  useOverlayEvent('lead', (e) => setFlash((f) => ({ side: e.leader, n: f.n + 1 })));

  const tonight = stage === 'live' || stage === 'done';
  const value = (side: Side) => (tonight ? score[side].points : season.totals[side].sessions);
  const total = value('streamer') + value('chat');
  const fill = (side: Side) => (total ? Math.min(1, (2 * value(side)) / total) : 1);

  return (
    <div className="ac-vs">
      {SIDES.map((side) => (
        <div
          key={side}
          className="ac-side"
          data-side={side}
          data-flash={side === flash.side ? (flash.n % 2 ? 'a' : 'b') : undefined}
          style={{ order: side === 'streamer' ? 0 : 2 }}
        >
          <div className="ac-side-top">
            <b className="ac-name">{sides[side].name}</b>
            {tonight && streak.side === side && streak.count >= 2 && (
              <span key={streak.count} className="ac-streak" title={`${streak.count} in a row`}>
                ×{streak.count}
              </span>
            )}
            <Num value={value(side)} className="bc-num ac-score" />
          </div>
          <div className="ac-hp">
            <i style={{ width: `${fill(side) * 100}%` }} />
          </div>
        </div>
      ))}
      <div className="ac-vs-badge" style={{ order: 1 }}>
        <span>VS</span>
      </div>
      <div className="ac-vs-foot" style={{ order: 3 }}>
        <span className="ac-round">
          {stage === 'live' && <LiveDot />}
          {tonight ? (stage === 'done' ? 'Final' : `Round ${progress.number}/${progress.total}`) : 'Season'}
        </span>
        {tonight && (
          <span className="ac-pips" aria-hidden="true">
            {slots.map((slot) => (
              <i
                key={slot.challenge.id}
                data-side={slot.winner ?? undefined}
                data-skip={slot.skipped || undefined}
                data-live={(slot.status === 'live' && !slot.winner) || undefined}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

type Pop = { id: number; kind: 'call' | 'combo'; side: Side; count?: number };
let popId = 0;
const POP_MS = 1600;

/** Big punchy pops: STAGE CLEAR / CHAT WINS on every call, COMBO ×n on win streaks. One at a time, in order. */
export function ComboPops() {
  const sides = useSides();
  const [queue, setQueue] = useState<Pop[]>([]);
  // A call that extends a streak fires both; the call plays first
  const push = (p: Omit<Pop, 'id'>) => setQueue((q) => [...q.slice(-4), { ...p, id: ++popId }]);
  useOverlayEvent('round.call', (e) => push({ kind: 'call', side: e.winner }));
  useOverlayEvent('streak', (e) => push({ kind: 'combo', side: e.side, count: e.count }));

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), POP_MS);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  return (
    <div key={current.id} className="ac-pop" data-kind={current.kind} data-side={current.side}>
      <div className="ac-pop-in">
        <i className="ac-burst" data-n="back" />
        <i className="ac-burst" />
        {current.kind === 'combo' ? (
          <div className="ac-pop-text">
            <span className="ac-pop-small">Combo</span>
            <span className="ac-pop-big">×{current.count}!</span>
          </div>
        ) : (
          <div className="ac-pop-text">
            <span className="ac-pop-big">{current.side === 'streamer' ? 'Stage clear!' : `${sides.chat.name} wins!`}</span>
          </div>
        )}
      </div>
    </div>
  );
}

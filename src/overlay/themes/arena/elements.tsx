import { useEffect, useState } from 'react';
import { FlameIcon } from '@/components/icons';
import { SIDES, useClock, useLineup, useOverlayEvent, useScore, useSeason, useSides, useStage, useStreak, type Side } from '@/overlay/sdk';
import { fmt, LiveDot, Num } from '@/scoreboard/parts';
import { useArenaSettings } from './settings';

/** The TV score bug: both sides and their scores in one bar, the period and the clock beside them. */
export function ScoreBug() {
  const stage = useStage();
  const { score } = useScore();
  const { current: streak } = useStreak();
  const { slots, progress } = useLineup();
  const season = useSeason();
  const sides = useSides();
  const clock = useClock('round');
  const { scoreShows } = useArenaSettings();
  const [flash, setFlash] = useState<{ side: string | null; n: number }>({ side: null, n: 0 });
  useOverlayEvent('lead', (e) => setFlash((f) => ({ side: e.leader, n: f.n + 1 })));

  // Before the lineup's played, the bug carries the season instead of tonight's 0–0
  const tonight = stage === 'live' || stage === 'done';
  const value = (side: Side) => (tonight ? (scoreShows === 'wins' ? score[side].wins : score[side].points) : season.totals[side].sessions);

  return (
    <div className="ar-bug">
      <div className="ar-bug-bar">
        {SIDES.map((side) => (
          <div key={side} className="ar-team" data-side={side} data-flash={side === flash.side ? (flash.n % 2 ? 'a' : 'b') : undefined}>
            <b className="ar-team-name">{sides[side].name}</b>
            {tonight && streak.side === side && streak.count >= 2 && (
              <span key={streak.count} className="ar-streak" title={`${streak.count} in a row`}>
                <FlameIcon size={13} />
                {streak.count}
              </span>
            )}
            <Num value={value(side)} className="bc-num ar-team-n" />
          </div>
        ))}
        <div className="ar-period">
          {stage === 'live' && <LiveDot />}
          <span>{tonight ? (stage === 'done' ? 'Final' : `C${progress.number}/${progress.total}`) : 'Season'}</span>
          {stage === 'live' && clock && <span className="bc-num ar-clock">{clock.text}</span>}
        </div>
      </div>
      {tonight && (
        <div className="bc-track ar-track" aria-hidden="true">
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

/** On every call, a team-coloured wipe crosses the frame like a replay sting, carrying the winner and the points. */
export function ReplaySting() {
  const sides = useSides();
  const [hit, setHit] = useState<{ n: number; side: Side; points: number } | null>(null);
  useOverlayEvent('round.call', (e) => setHit((h) => ({ n: (h?.n ?? 0) + 1, side: e.winner, points: e.points })));
  useEffect(() => {
    if (!hit) return;
    const t = setTimeout(() => setHit(null), 1700);
    return () => clearTimeout(t);
  }, [hit]);

  if (!hit) return null;
  return (
    <div key={hit.n} className="ar-sting" data-side={hit.side}>
      <i className="ar-sting-band" data-n="1" />
      <i className="ar-sting-band" data-n="2" />
      <div className="ar-sting-band ar-sting-main">
        <span className="ar-sting-tag">Replay</span>
        <b>{sides[hit.side].name}</b>
        <span className="bc-num">+{fmt(hit.points)}</span>
      </div>
    </div>
  );
}

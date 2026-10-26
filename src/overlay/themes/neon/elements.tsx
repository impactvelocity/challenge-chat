import { useEffect, useRef, useState } from 'react';
import { useOverlayEvent, type OverlayEvent } from '@/overlay/sdk';

/** Energy each moment adds to the hype meter, out of 100. */
function energy(e: OverlayEvent): number {
  switch (e.type) {
    case 'idea':
      return 6;
    case 'votes':
      return Math.min(6, e.delta * 0.5);
    case 'lineup':
    case 'round.start':
      return 8;
    case 'lead':
      return 10;
    case 'streak':
      return 12;
    case 'round.call':
      return 22;
    case 'goal':
      return 30;
    case 'custom': {
      const n = ((e.data ?? {}) as { amount?: number }).amount ?? 1;
      if (e.name === 'follow') return 8;
      if (e.name === 'sub') return 16;
      if (e.name === 'gift') return Math.min(40, 8 + n * 3);
      if (e.name === 'raid') return Math.min(50, 20 + n / 10);
      if (e.name === 'cheer') return Math.min(40, 4 + n / 50);
      return 0;
    }
    default:
      return 0;
  }
}

const LEVELS = ['Warming up', 'Heating up', 'Hyped', 'Overdrive'];
const tierOf = (v: number) => (v >= 80 ? 3 : v >= 50 ? 2 : v >= 25 ? 1 : 0);

/**
 * Chat's energy as a glowing meter: every idea, vote, alert, call and streak charges it, and it drains
 * smoothly when things go quiet. Re-renders at most four times a second while it drains.
 */
export function HypeMeter() {
  const level = useRef(0);
  const [shown, setShown] = useState(0);
  const [kick, setKick] = useState(0);

  useOverlayEvent('*', (e) => {
    const add = energy(e);
    if (add <= 0) return;
    level.current = Math.min(100, level.current + add);
    setShown(Math.round(level.current));
    setKick((k) => k + 1);
  });

  useEffect(() => {
    const t = setInterval(() => {
      if (level.current <= 0) return;
      // Drains faster the fuller it is, so a peak doesn't hang around
      level.current = Math.max(0, level.current - (0.25 + level.current * 0.006));
      setShown(Math.round(level.current));
    }, 250);
    return () => clearInterval(t);
  }, []);

  const tier = tierOf(shown);
  return (
    <div className="bc-card ne-hype" data-level={tier}>
      <div className="ne-hype-head">
        <span className="bc-kicker">Hype</span>
        <span className="ne-hype-level">{LEVELS[tier]}</span>
        <span className="bc-num ne-hype-n">{shown}%</span>
      </div>
      <div className="ne-hype-bar" aria-hidden="true">
        <i style={{ width: `${shown}%` }} />
        {kick > 0 && <b key={kick} className="ne-hype-spark" style={{ left: `${shown}%` }} />}
      </div>
    </div>
  );
}

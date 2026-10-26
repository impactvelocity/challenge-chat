import type { ReactNode } from 'react';
import { useCozySettings } from './settings';

const HEART = 'M12 20.5s-7.4-4.5-9.5-9C1.1 8.3 3.1 4.8 6.6 4.8c2.1 0 3.6 1.2 5.4 3.1 1.8-1.9 3.3-3.1 5.4-3.1 3.5 0 5.5 3.5 4.1 6.7-2.1 4.5-9.5 9-9.5 9z';

/** A small heart in the current colour. */
export function Heart({ className, ...data }: { className?: string; [k: `data-${string}`]: string | boolean | undefined }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...data}>
      <path d={HEART} />
    </svg>
  );
}

/** Tries as hearts: one is spent per failed try, from the right. The heart in play beats gently. */
export function Hearts({ current, max }: { current: number; max: number }) {
  const left = max - (current - 1);
  return (
    <span className="cz-hearts" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <Heart key={i} className="cz-heart" data-lost={i >= left || undefined} data-on={i === left - 1 || undefined} />
      ))}
    </span>
  );
}

/** A strip of washi tape holding a card down. */
export function Tape({ at }: { at?: 'left' | 'right' }) {
  return <i className="cz-tape" data-at={at} aria-hidden="true" />;
}

/** A handwritten scribble pinned to a card. Hidden when the streamer turns notes off. */
export function Note({ at, children }: { at: string; children: ReactNode }) {
  const { notes } = useCozySettings();
  if (!notes) return null;
  return (
    <span className="cz-note" data-at={at} aria-hidden="true">
      {children}
    </span>
  );
}

import type { ReactNode } from 'react';

/** A card along the bottom, opposite the stack. */
export function Lower({ wide, side, children }: { wide?: boolean; side?: string; children: ReactNode }) {
  return (
    <div className="bc-lower" data-wide={wide || undefined}>
      <div className="bc-card bc-enter" data-side={side}>
        {children}
      </div>
    </div>
  );
}

/** A card in the middle of the frame, for the big moments. */
export function Center({ children }: { children: ReactNode }) {
  return (
    <div className="bc-center">
      <div>{children}</div>
    </div>
  );
}

/** Tries as pips: used, the one in progress, and what's left. */
export function Pips({ current, max }: { current: number; max: number }) {
  return (
    <span className="bc-pips" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <i key={i} data-used={i < current - 1 || undefined} data-on={i === current - 1 || undefined} />
      ))}
    </span>
  );
}

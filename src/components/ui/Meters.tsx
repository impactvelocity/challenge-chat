import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Lit LED segment bar. `value` is 0–1. The last lit cell glows brightest when `head` is set. */
export function SegmentMeter({
  value,
  segments = 24,
  head = true,
  height,
  className,
  style,
}: {
  value: number;
  segments?: number;
  head?: boolean;
  height?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const lit = Math.round(Math.min(1, Math.max(0, value)) * segments);
  return (
    <div
      className={cn('seg', className)}
      style={{ ...(height ? ({ '--seg-h': `${height}px` } as CSSProperties) : null), ...style }}
      aria-hidden="true"
    >
      {Array.from({ length: segments }, (_, i) => (
        <b key={i} data-lit={i < lit || undefined} data-head={(head && i === lit - 1) || undefined} />
      ))}
    </div>
  );
}

/** Thin recessed vote bar. `pct` is 0–100. */
export function VoteBar({ pct, dim, className }: { pct: number; dim?: boolean; className?: string }) {
  return (
    <div className={cn('vbar', className)} data-dim={dim || undefined} aria-hidden="true">
      <i style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Lit countdown digits. (No ghosted "88:88": the pixel font isn't seven-segment, so it never lined up.) */
export function Timer({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn('timer', className)}>
      <span className="lit-text">{value}</span>
    </span>
  );
}

export function BigNumber({ children }: { children: ReactNode }) {
  return <span className="bignum lit-text">{children}</span>;
}

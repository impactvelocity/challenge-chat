import { useState, type ReactNode } from 'react';
import { CardHeader, Panel } from '@/components/ui';
import { useTweened } from '@/feel/useTweened';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import type { Board, Side } from './model';

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/** "06:52" left, or "+04:10" elapsed on an untimed bout. */
export const clockText = (b: Board) => (b.over ? '00:00' : `${b.timed ? '' : '+'}${formatClock(b.clock)}`);

type BoardCardProps = {
  title: string;
  tag: string;
  /** One line on where the idea comes from and what it's good at. */
  note: ReactNode;
  /** Span two grid columns. */
  wide?: boolean;
  stageClassName?: string;
  children: ReactNode;
};

/** A card that stages one scoreboard variation. */
export function BoardCard({ title, tag, note, wide, stageClassName, children }: BoardCardProps) {
  return (
    <Panel as="section" className={cn('flex min-w-0 flex-col gap-4 p-6', wide && 'lg:col-span-2')}>
      <CardHeader title={title} tag={tag} />
      <div className={cn('sb-stage well', stageClassName)}>{children}</div>
      <p className="hint m-0">{note}</p>
    </Panel>
  );
}

/** Counter that bumps each time `value` changes (not on mount). Key an element on it to replay a CSS animation. */
export function useBump(value: unknown) {
  const [state, setState] = useState({ value, n: 0 });
  if (!Object.is(state.value, value)) setState({ value, n: state.n + 1 });
  return state.n;
}

/** Number that counts toward its new value and pops when it changes. */
export function Num({ value, pad, className }: { value: number; pad?: number; className?: string }) {
  const shown = useTweened(value, 700);
  const bump = useBump(value);
  return (
    <span key={bump} className={cn('sb-num', className)} data-pop={bump ? '' : undefined}>
      {pad ? String(Math.round(shown)).padStart(pad, '0') : fmt(shown)}
    </span>
  );
}

/** Row of small lit dots: `n` lit out of `of`. */
export function Pips({ n, of, side, className }: { n: number; of: number; side: Side; className?: string }) {
  return (
    <span className={cn('flex gap-1', className)} data-side={side} aria-hidden="true">
      {Array.from({ length: of }, (_, i) => (
        <i key={i} className="sb-dot" data-off={i >= n || undefined} />
      ))}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn('sb-live', className)} aria-hidden="true" />;
}

/** Small coloured name plate. */
export function SidePlate({ side, children, className }: { side: Side; children: ReactNode; className?: string }) {
  return (
    <span className={cn('sb-plate', className)} data-side={side}>
      {children}
    </span>
  );
}

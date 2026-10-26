import type { ComponentProps, ElementType, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SurfaceProps<T extends ElementType> = { as?: T } & Omit<ComponentProps<T>, 'as'>;

function surface(base: string) {
  return function Surface<T extends ElementType = 'div'>({ as, className, ...props }: SurfaceProps<T>) {
    const Comp: ElementType = as ?? 'div';
    return <Comp className={cn(base, className)} {...props} />;
  };
}

/** Raised, milled chassis panel. */
export const Panel = surface('panel');
/** Recessed well for readouts and inputs. */
export const Well = surface('well');
/** Dark display glass with accent haze. */
export const Screen = surface('screen');

export function Label({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('lbl', className)} {...props} />;
}

export function CardHeader({ title, tag, as: Heading = 'h2' }: { title: ReactNode; tag?: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="card-h">
      <Heading>{title}</Heading>
      {tag && <span className="card-h-tag">{tag}</span>}
    </div>
  );
}

export function Divider() {
  return <div className="divider" role="separator" />;
}

export function VLine({ className }: { className?: string }) {
  return <span className={cn('vline', className)} aria-hidden="true" />;
}

export function KeyValue({ label, children, accent }: { label: ReactNode; children: ReactNode; accent?: boolean }) {
  return (
    <div className="kv">
      <span>{label}</span>
      <b className={accent ? 'text-accent-text' : undefined}>{children}</b>
    </div>
  );
}

export function Chip({ hot, className, ...props }: ComponentProps<'span'> & { hot?: boolean }) {
  return <span className={cn('chip', className)} data-hot={hot || undefined} {...props} />;
}

export function Tag({ className, ...props }: ComponentProps<'span'>) {
  return <span className={cn('tag', className)} {...props} />;
}

export function Stat({ label, value, accent, className }: { label: string; value: ReactNode; accent?: boolean; className?: string }) {
  return (
    <div className={cn('stat well', className)}>
      <span className="lbl">{label}</span>
      <span className={cn('stat-n', accent && 'text-accent-text')}>{value}</span>
    </div>
  );
}

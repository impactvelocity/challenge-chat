import type { ReactNode } from 'react';
import { CopyIcon, LockIcon } from '@/components/icons';
import { Button, Chip, Label, Panel, useToasts } from '@/components/ui';
import { DIFFICULTIES, type Challenge, type Difficulty } from '@/model';
import { cn } from '@/lib/cn';

/** Key hint printed on a button face. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('kbd', className)} aria-hidden="true">
      {children}
    </kbd>
  );
}

export function Led({ tone, className }: { tone?: 'ok' | 'warn' | 'live'; className?: string }) {
  return <span className={cn('led', className)} data-tone={tone} aria-hidden="true" />;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {name[0]}
    </span>
  );
}

/** Read-only mono value with a copy button, plus any extra buttons (same size) after it. */
export function CopyField({ value, label, className, actions }: { value: string; label: string; className?: string; actions?: ReactNode }) {
  const toast = useToasts();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // clipboard unavailable (insecure context) — still confirm for the mock
    }
    toast.add({ title: 'Copied', description: label });
  };
  return (
    <div className={cn('copyfield well', className)}>
      <code title={value}>{value}</code>
      <span className="flex flex-none gap-1.5">
        <Button size="xs" icon onClick={copy} aria-label={`Copy ${label}`}>
          <CopyIcon size={15} />
        </Button>
        {actions}
      </span>
    </div>
  );
}

export function difficultyLabel(d: Difficulty) {
  return DIFFICULTIES.find((x) => x.value === d)!.label;
}

/** 300 → "5 min", null → "Untimed" */
export function formatLimit(seconds: number | null) {
  if (seconds == null) return 'Untimed';
  return seconds % 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds / 60} min`;
}

/**
 * A suggestion's limits as small pills: the time limit and number of attempts, each only when the
 * suggestion set one. Renders nothing for a challenge with neither (e.g. just "no rifles").
 */
export function ChallengeMeta({ c, className }: { c: Pick<Challenge, 'timeLimit' | 'maxAttempts'>; className?: string }) {
  const items = [
    c.timeLimit != null ? formatLimit(c.timeLimit) : null,
    c.maxAttempts != null ? `${c.maxAttempts} ${c.maxAttempts === 1 ? 'try' : 'tries'}` : null,
  ].filter((t): t is string => !!t);
  if (!items.length) return null;
  return (
    <span className={cn('flex flex-wrap gap-1.5', className)}>
      {items.map((t) => (
        <span key={t} className="rounded-full bg-white/[.05] px-2 py-0.5 text-[12px] font-medium whitespace-nowrap text-ink-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)]">
          {t}
        </span>
      ))}
    </span>
  );
}

/** Compact rule chips for a challenge: difficulty · time · attempts · value. Used by the /dev pages; the main UI uses ChallengeMeta. */
export function RuleChips({ c, className }: { c: Challenge; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      <Chip hot={c.difficulty === 'hard' || c.difficulty === 'ridiculous'} className="min-h-[26px] px-2.5 text-[10.5px]">
        {difficultyLabel(c.difficulty)}
      </Chip>
      <Chip className="min-h-[26px] px-2.5 text-[10.5px]">{formatLimit(c.timeLimit)}</Chip>
      <Chip className="min-h-[26px] px-2.5 text-[10.5px]">{c.maxAttempts ? `${c.maxAttempts} tries` : 'No try limit'}</Chip>
      <Chip className="min-h-[26px] px-2.5 text-[10.5px]">{c.roundValue} pts</Chip>
    </div>
  );
}

export function PageTitle({ eyebrow, title, sub, actions }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-1.5">
      <div className="flex min-w-0 flex-col gap-2.5">
        {eyebrow && <Label>{eyebrow}</Label>}
        <h1 className="m-0 text-[30px] leading-none font-extrabold tracking-[-.02em] text-ink-strong">{title}</h1>
        {sub && <p className="m-0 text-sm text-ink-sub">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

/** Shown to moderators who reach an owner-only screen. The Worker enforces this too. */
export function OwnerOnly({ what }: { what: string }) {
  return (
    <Panel className="mx-auto flex max-w-[520px] flex-col items-center gap-4 p-10 text-center">
      <span className="keycap" data-on="">
        <LockIcon size={18} />
      </span>
      <h2 className="m-0 text-xl font-bold text-ink-strong">Owner only</h2>
      <p className="m-0 text-sm leading-relaxed text-ink-sub">
        {what} can only be changed by the board owner, but you can still review suggestions and run the show from the control panel
      </p>
    </Panel>
  );
}

/** Section block inside a settings panel. */
export function Section({ title, sub, actions, children, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-5', className)}>
      {/* Without a subtitle the title sits on the same line as the actions, centred against them */}
      <div className={cn('flex flex-wrap justify-between gap-3', sub ? 'items-start' : 'items-center')}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="m-0 text-[17px] font-bold tracking-[-.01em] text-ink-strong">{title}</h2>
          {sub && <p className="m-0 max-w-[60ch] text-[13px] leading-relaxed text-ink-sub">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

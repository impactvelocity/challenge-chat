import type { Clock } from './types';

/** A clock read at one instant, in whole seconds as shown on screen. */
export type ClockView = {
  /** Seconds since it started; 0 during a countdown. */
  elapsed: number;
  /** Seconds left, or null when it counts up. */
  remaining: number | null;
  /** Its full length in seconds, or null when it counts up. */
  duration: number | null;
  /** 0 → 1 through a timed clock, 0 for one that counts up. */
  progress: number;
  /** Seconds until it starts, while a pre-start countdown runs. */
  startsIn: number;
  pending: boolean;
  running: boolean;
  paused: boolean;
  expired: boolean;
  /** "04:32" left, or "+04:32" elapsed when untimed. */
  text: string;
};

/** 272 → "04:32", 3720 → "1:02:00". */
export function formatSeconds(total: number) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function readClock(clock: Clock, now: number): ClockView {
  const t = clock.pausedAt ?? now;
  const pending = t < clock.startsAt;
  const startsIn = pending ? Math.ceil((clock.startsAt - t) / 1000) : 0;
  const elapsed = pending ? 0 : Math.floor((t - clock.startsAt) / 1000);
  const duration = clock.endsAt == null ? null : Math.round((clock.endsAt - clock.startsAt) / 1000);
  const remaining = clock.endsAt == null ? null : Math.max(0, Math.ceil((clock.endsAt - Math.max(t, clock.startsAt)) / 1000));
  const expired = remaining === 0;
  return {
    elapsed,
    remaining,
    duration,
    progress: duration ? Math.min(1, 1 - (remaining ?? 0) / duration) : 0,
    startsIn,
    pending,
    running: !pending && !expired && clock.pausedAt == null,
    paused: clock.pausedAt != null,
    expired,
    text: remaining != null ? formatSeconds(remaining) : `+${formatSeconds(elapsed)}`,
  };
}

const views = new WeakMap<Clock, ClockView>();

/**
 * `readClock`, returning the same object until a shown second changes, so hooks that read clocks only
 * re-render once a second whatever the tick rate.
 */
export function viewClock(clock: Clock, now: number): ClockView {
  const next = readClock(clock, now);
  const prev = views.get(clock);
  if (prev && prev.elapsed === next.elapsed && prev.remaining === next.remaining && prev.startsIn === next.startsIn) return prev;
  views.set(clock, next);
  return next;
}

/* ───────────────────────── Building clocks (sources) ───────────────────────── */

/** A clock starting at `startsAt` that runs `seconds`, or counts up when that's null. */
export const clockFrom = (startsAt: number, seconds: number | null): Clock => ({
  startsAt,
  endsAt: seconds == null ? null : startsAt + seconds * 1000,
  pausedAt: null,
});

export const pauseClock = (c: Clock, now: number): Clock => (c.pausedAt != null ? c : { ...c, pausedAt: now });

/** Shifts both ends forward by the time spent paused. */
export function resumeClock(c: Clock, now: number): Clock {
  if (c.pausedAt == null) return c;
  const d = now - c.pausedAt;
  return { startsAt: c.startsAt + d, endsAt: c.endsAt == null ? null : c.endsAt + d, pausedAt: null };
}

export const clockDone = (c: Clock | null | undefined, now: number) => !!c && c.pausedAt == null && c.endsAt != null && now >= c.endsAt;

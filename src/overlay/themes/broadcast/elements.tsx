import { useEffect, useState, type CSSProperties } from 'react';
import { FlameIcon } from '@/components/icons';
import { SIDES, useLeaderboard, useLineup, useMetric, useOverlayEvent, useScore, useSeason, useSides, useSponsors, useStage, useStreak } from '@/overlay/sdk';
import { fmt, LiveDot, Num } from '@/scoreboard/parts';
import { useBroadcastSettings } from './settings';

/* The switchable elements. None of them read a clock, so they only re-render when the board changes. */

export function Scoreboard() {
  const stage = useStage();
  const { score } = useScore();
  const { current: streak } = useStreak();
  const { slots, progress } = useLineup();
  const season = useSeason();
  const sides = useSides();
  const s = useBroadcastSettings();
  // The side that just took the lead flashes; alternating names replay the animation without remounting the row
  const [flash, setFlash] = useState<{ side: string | null; n: number }>({ side: null, n: 0 });
  useOverlayEvent('lead', (e) => setFlash((f) => ({ side: e.leader, n: f.n + 1 })));

  // Before the lineup's played, the board shows the season instead of tonight's 0–0
  const tonight = stage === 'live' || stage === 'done';
  const value = (side: (typeof SIDES)[number]) => (tonight ? (s.scoreShows === 'wins' ? score[side].wins : score[side].points) : season.totals[side].sessions);

  return (
    <div className="bc-card bc-score" data-flat="">
      <div className="bc-score-head">
        {stage === 'live' && <LiveDot />}
        <span>{tonight ? (stage === 'done' ? 'Final' : 'Tonight') : 'Season'}</span>
        <span className="bc-num ml-auto">
          {tonight ? `${stage === 'done' ? progress.played : progress.number} / ${progress.total}` : `${season.history.length} sessions`}
        </span>
      </div>
      {SIDES.map((side) => (
        <div key={side} className="bc-score-row" data-side={side} data-flash={side === flash.side ? (flash.n % 2 ? 'a' : 'b') : undefined}>
          <i className="bc-swatch" />
          <b>{sides[side].name}</b>
          {s.streaks && tonight && streak.side === side && streak.count >= 2 && (
            <span key={streak.count} className="bc-streak" title={`${streak.count} in a row`}>
              <FlameIcon size={14} />
              {streak.count}
            </span>
          )}
          <Num value={value(side)} className="bc-num bc-score-n" />
        </div>
      ))}
      {s.track && tonight && (
        <div className="bc-track" aria-hidden="true">
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

/** A gauge metric with a target, e.g. followers. Glows gold once reached. */
export function Goal({ metric = 'goal' }: { metric?: string }) {
  const m = useMetric(metric);
  const [party, setParty] = useState(0);
  useOverlayEvent('goal', (e) => e.id === metric && setParty((n) => n + 1));
  if (!m || typeof m.value !== 'number') return null;
  return (
    <div key={party} className="bc-card bc-goal" data-reached={m.reached || undefined} data-celebrate={party || undefined}>
      <div className="flex items-baseline gap-3">
        <span className="bc-kicker">{m.label}</span>
        <span className="bc-num ml-auto text-[20px] text-white">
          {fmt(m.value)}
          {typeof m.target === 'number' && <span className="text-white/50"> / {fmt(m.target)}</span>}
        </span>
      </div>
      <div className="bc-bar mt-3" data-size="lg">
        <i style={{ width: `${(m.progress ?? 0) * 100}%` }} />
      </div>
    </div>
  );
}

export function Leaderboard() {
  const { leaders } = useBroadcastSettings();
  const rows = useLeaderboard(leaders);
  return (
    <div className="bc-card bc-board">
      <div className="bc-kicker">Top challengers</div>
      <ol className="mt-4 flex flex-col gap-1.5 p-0">
        {rows.map((c) => (
          <li key={c.id} className="bc-rank" data-top={c.rank === 1 || undefined}>
            <span className="bc-num bc-rank-n">{c.rank}</span>
            <b className="min-w-0 flex-1 truncate">{c.name}</b>
            {c.move !== 0 && (
              <span className="bc-move" data-down={c.move < 0 || undefined} title={c.move > 0 ? `Up ${c.move} tonight` : `Down ${-c.move} tonight`}>
                {c.move > 0 ? '▲' : '▼'}
                {Math.abs(c.move)}
              </span>
            )}
            <Num value={c.points} className="bc-num bc-rank-pts" />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A counter metric, e.g. kills. */
export function Counter({ metric = 'kills' }: { metric?: string }) {
  const m = useMetric(metric);
  if (!m || typeof m.value !== 'number') return null;
  return (
    <div className="bc-card bc-killbox">
      <span className="bc-kicker">{m.label}</span>
      <Num value={m.value} pad={2} className="bc-num bc-kill-n" />
    </div>
  );
}

export function SponsorBar() {
  const sponsors = useSponsors();
  const { sponsorLabel } = useBroadcastSettings();
  // Doubled so the strip loops without a seam
  const names = [...sponsors, ...sponsors];
  return (
    <div className="bc-sponsorbar">
      {sponsorLabel && <span className="bc-sponsor-l">{sponsorLabel}</span>}
      <div className="bc-marquee">
        <div className="bc-marquee-in">
          {names.map((s, i) => (
            <span key={i} className="bc-brand">
              {s.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Twitch moments, sent as `custom` events named follow, sub, gift, raid or cheer with `{ user, amount }`.
 * One at a time, in the order they came, each held for the alert length.
 */
const ALERTS: Record<string, { kicker: string; line: (amount?: number) => string }> = {
  follow: { kicker: 'New follower', line: () => 'Welcome in' },
  sub: { kicker: 'New sub', line: (n) => (n && n > 1 ? `${n} months` : 'First month') },
  gift: { kicker: 'Gift subs', line: (n = 1) => `Gifted ${n} ${n === 1 ? 'sub' : 'subs'}` },
  raid: { kicker: 'Raid', line: (n = 0) => `${fmt(n)} raiders incoming` },
  cheer: { kicker: 'Cheer', line: (n = 0) => `${fmt(n)} bits` },
};

type Alert = { id: number; kind: string; user: string; amount?: number };
let alertId = 0;

export function Alerts() {
  const { alertSecs } = useBroadcastSettings();
  const [queue, setQueue] = useState<Alert[]>([]);
  useOverlayEvent('custom', (e) => {
    if (!ALERTS[e.name]) return;
    const d = (e.data ?? {}) as { user?: string; amount?: number };
    // Keep the backlog short so a burst doesn't play for minutes
    setQueue((q) => [...q.slice(-7), { id: ++alertId, kind: e.name, user: d.user ?? 'Someone', amount: d.amount }]);
  });
  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setQueue((q) => q.slice(1)), alertSecs * 1000);
    return () => clearTimeout(t);
  }, [current, alertSecs]);

  if (!current) return null;
  const a = ALERTS[current.kind];
  return (
    <div key={current.id} className="bc-card bc-alert" data-kind={current.kind} data-flat="" style={{ '--bc-alert-secs': `${alertSecs}s` } as CSSProperties}>
      <span className="bc-kicker">{a.kicker}</span>
      <span className="bc-alert-user">{current.user}</span>
      <span className="bc-alert-line">{a.line(current.amount)}</span>
      {queue.length > 1 && <span className="bc-alert-more bc-num">+{queue.length - 1}</span>}
    </div>
  );
}

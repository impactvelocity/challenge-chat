import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { BoltIcon, CrownIcon, FlameIcon, MinusIcon, PlusIcon, TrashIcon, TrophyIcon } from '@/components/icons';
import { Button, ConfirmDialog, Panel, Sheet, Tooltip, Well } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Challenge } from '@/model';
import { SIDES, type Side } from '@/scoreboard/model';
import { fmt, Num } from '@/scoreboard/parts';

/** One finished (or running) session: its name, when it started, points per side and challenges won per side. */
export type Session = { name: string; date: string; time: string; streamer: number; chat: number; bouts: [number, number] };

type Props = {
  /** Finished sessions, newest first. */
  history: Session[];
  /** The session in progress, once any challenge in it has been decided. */
  current: Session | null;
};

/** What each side is called on screen. The streamer side uses the channel's short name. */
export const SIDE_NAME: Record<Side, string> = { streamer: 'Streamer', chat: 'Chat' };

const winnerOf = (n: Session): Side | null => (n.streamer > n.chat ? 'streamer' : n.chat > n.streamer ? 'chat' : null);

/* ───────────────────────── Overall score ───────────────────────── */

/** Session streaks for one side, from finished sessions (newest first). */
function streaksFor(history: Session[], side: Side) {
  let current = 0;
  for (const n of history) {
    if (winnerOf(n) !== side) break;
    current++;
  }
  let best = 0;
  let run = 0;
  for (const n of [...history].reverse()) {
    run = winnerOf(n) === side ? run + 1 : 0;
    best = Math.max(best, run);
  }
  /** Won the session without dropping a single challenge. */
  const sweeps = history.filter((n) => winnerOf(n) === side && n.bouts[side === 'streamer' ? 1 : 0] === 0);
  return { current, best, sweeps };
}

/** `simple`: just the two totals, for while a session is running and the session itself needs the room. */
export function OverallBoard({ history, current, simple, streamerName = SIDE_NAME.streamer }: Props & { simple?: boolean; streamerName?: string }) {
  const names: Record<Side, string> = { streamer: streamerName, chat: SIDE_NAME.chat };
  const all = current ? [current, ...history] : history;
  const total = (side: Side) => ({
    pts: all.reduce((s, n) => s + n[side], 0),
    wins: all.reduce((s, n) => s + n.bouts[side === 'streamer' ? 0 : 1], 0),
    ...streaksFor(history, side),
  });
  const t = { streamer: total('streamer'), chat: total('chat') };
  const lead = t.streamer.pts - t.chat.pts;
  const points = t.streamer.pts + t.chat.pts;
  const share = points ? t.streamer.pts / points : 0.5;
  /** Sessions the streamer won and lost (draws aside). */
  const record = { won: history.filter((n) => winnerOf(n) === 'streamer').length, lost: history.filter((n) => winnerOf(n) === 'chat').length };

  if (simple) {
    return (
      <Panel as="section" aria-label="Overall score" className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3">
          {SIDES.map((side) => (
            <Well key={side} data-side={side} className={cn('flex items-center justify-between gap-3 px-5 py-4', side === 'chat' && 'flex-row-reverse')}>
              <span className="max-w-[70%] truncate text-[13px] font-bold tracking-[.12em] text-ink-strong uppercase">{names[side]}</span>
              <Num value={t[side].pts} className="pixel sb-lit sb-lit-crisp text-[clamp(26px,4.5vw,36px)] leading-none" />
            </Well>
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel as="section" aria-label="Overall score" className="flex flex-col gap-5 p-5 sm:p-7">
      <div className="grid grid-cols-2 gap-3">
        {SIDES.map((side) => {
          const s = t[side];
          const right = side === 'chat';
          const sideLead = side === 'streamer' ? lead : -lead;
          return (
            <Well key={side} data-side={side} className={cn('group flex min-w-0 flex-col gap-3.5 px-4 pt-4 pb-5 sm:px-5', right && 'items-end text-right')}>
              <div className={cn('flex w-full flex-wrap items-center justify-between gap-2', right && 'flex-row-reverse')}>
                <span className={cn('flex min-h-7 flex-wrap items-center gap-1.5', right && 'flex-row-reverse')}>
                  <Tooltip content={`${s.wins} challenges won, all time`}>
                    <span tabIndex={0} className="flex h-7 items-center gap-1.5 rounded-full bg-[rgba(var(--tr),.12)] pr-2.5 pl-2 text-[13px] whitespace-nowrap text-[var(--t-hi)]">
                      <TrophyIcon size={14} />
                      <span>
                        <b className="font-bold">{s.wins}</b> Won
                      </span>
                    </span>
                  </Tooltip>
                  {s.current >= 2 && (
                    <StreakBadge kind="streak" n={s.current} label={`${s.current} round win streak`}>
                      <b>{s.current} rounds won in a row</b> · best run {s.best}
                    </StreakBadge>
                  )}
                  {s.sweeps.length > 0 && (
                    <StreakBadge kind="flawless" n={s.sweeps.length} label={`${s.sweeps.length} flawless ${s.sweeps.length === 1 ? 'victory' : 'victories'}`}>
                      <b>Flawless victory ×{s.sweeps.length}</b> · won a whole round without dropping a challenge, last on {s.sweeps[0].date}
                    </StreakBadge>
                  )}
                </span>
              </div>
              <Num value={s.pts} className="pixel sb-lit sb-lit-crisp text-[clamp(34px,7vw,56px)] leading-none" />
              {/* Point differential, in the top corner away from the points. Ties stay quiet. */}
              {sideLead !== 0 && (
                <span
                  className={cn('absolute top-5 flex items-center gap-0.5 text-[12px] font-medium whitespace-nowrap opacity-[.69] transition-opacity duration-200 group-hover:opacity-90 max-sm:hidden', right ? 'left-5' : 'right-5', sideLead > 0 ? 'text-[var(--t-hi)]' : 'text-ink-soft')}
                  title={`${names[side]} ${sideLead > 0 ? 'leads' : 'trails'} by ${fmt(Math.abs(sideLead))}`}
                  aria-label={`${names[side]} ${sideLead > 0 ? 'leads' : 'trails'} by ${fmt(Math.abs(sideLead))}`}
                >
                  {sideLead > 0 ? <PlusIcon size={12} strokeWidth={2.8} className="opacity-80" /> : <MinusIcon size={12} strokeWidth={2.8} className="opacity-80" />}
                  {fmt(Math.abs(sideLead))}
                </span>
              )}
            </Well>
          );
        })}
      </div>
      <SplitBar share={share} record={record} streamerName={streamerName} />
    </Panel>
  );
}

function StreakBadge({ kind, n, label, children }: { kind: 'streak' | 'flawless'; n: number; label: string; children: ReactNode }) {
  const streak = kind === 'streak';
  return (
    <Tooltip content={children}>
      <span
        tabIndex={0}
        aria-label={label}
        className={cn(
          'flex h-7 cursor-default items-center gap-1 rounded-full pr-2.5 pl-2 text-[13px] font-bold',
          streak ? 'bg-[#ff8a3d]/12 text-[#ffb37a]' : 'bg-[#ffd166]/10 text-[#ffdc8f]',
        )}
      >
        {streak ? <FlameIcon size={14} /> : <BoltIcon size={13} className="fill-current" />}
        {n}
      </span>
    </Tooltip>
  );
}

/** Tug of war: each side's share of every point as lit cells, with the session record underneath. */
function SplitBar({ share, record, streamerName }: { share: number; record: { won: number; lost: number }; streamerName: string }) {
  return (
    <div className="flex flex-col gap-3">
      <SplitCells share={share} count={40} streamerName={streamerName} />
      <SplitLabels a={record.won} b={record.lost} streamerName={streamerName} tip={<><b>Rounds</b> {streamerName} has won / lost</>} label={`${record.won} rounds won, ${record.lost} lost`} />
    </div>
  );
}

/** STREAMER ——— a / b ——— CHAT under a split: names at the ends, a tally in each side's colour in the middle. */
function SplitLabels({ a, b, tip, label, streamerName = SIDE_NAME.streamer }: { a: number; b: number; tip: ReactNode; label: string; streamerName?: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      <span className="flex min-w-0 items-center gap-3">
        <span className="min-w-0 truncate text-[13px] font-bold tracking-[.12em] text-ink-strong uppercase" title={streamerName}>{streamerName}</span>
        <span className="h-px min-w-3 flex-1 bg-white/10" aria-hidden="true" />
      </span>
      <Tooltip content={tip}>
        <span tabIndex={0} className="mono flex items-baseline gap-1.5 text-[15px]" aria-label={label}>
          <b data-side="streamer" className="font-bold text-[var(--t-hi)]">
            {a}
          </b>
          <span className="text-ink-faint">/</span>
          <b data-side="chat" className="font-bold text-[var(--t-hi)]">
            {b}
          </b>
        </span>
      </Tooltip>
      <span className="flex min-w-0 items-center gap-3">
        <span className="h-px min-w-3 flex-1 bg-white/10" aria-hidden="true" />
        <span className="flex-none text-[13px] font-bold tracking-[.12em] text-ink-strong uppercase">{SIDE_NAME.chat}</span>
      </span>
    </div>
  );
}

/** Small lit dot in the winning side's colour. */
export function SideDot({ side }: { side: Side }) {
  return (
    <Tooltip content={`${SIDE_NAME[side]} won`}>
      <span
        tabIndex={0}
        aria-label={`${SIDE_NAME[side]} won`}
        data-side={side}
        className="block size-3.5 flex-none rounded-full bg-[radial-gradient(circle_at_35%_30%,var(--t-pale),var(--t)_70%)] shadow-[0_1.5px_0_rgba(0,0,0,.55),0_0_10px_rgba(var(--tr),.75)]"
      />
    </Tooltip>
  );
}

/* ───────────────────────── History ───────────────────────── */

/** A table inside a drawer: bleeds to the drawer's edges (26px padding) so hover rows span it, with its text lined up under the title. */
export const DRAWER_TABLE =
  'table -mx-[26px] w-[calc(100%+52px)] table-fixed [&_td:first-child]:pl-[26px] [&_td:last-child]:pr-[26px] [&_th:first-child]:pl-[26px] [&_th:last-child]:pr-[26px]';

/** A table that runs to its panel's edges, with the first and last columns padded back in to line up with the panels above. */
export const EDGE_TABLE =
  'table w-full table-fixed max-sm:[&_td]:px-2 max-sm:[&_th]:px-2 [&_td:first-child]:pl-4 [&_td:last-child]:pr-3 [&_th:first-child]:pl-4 [&_th:last-child]:pr-3 sm:[&_td:first-child]:pl-7 sm:[&_td:last-child]:pr-6 sm:[&_th:first-child]:pl-7 sm:[&_th:last-child]:pr-6';

export function EmptyTableState({ side, icon, eyebrow, title, children }: { side: Side; icon: ReactNode; eyebrow: string; title: string; children: ReactNode }) {
  return (
    <div data-side={side} className="mx-auto flex max-w-[460px] flex-col items-center text-center">
      <div className="mb-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px w-10 bg-[linear-gradient(90deg,transparent,rgba(var(--tr),.45))]" />
        <span className="grid size-13 place-items-center rounded-[16px] bg-[linear-gradient(145deg,rgba(var(--tr),.16),rgba(var(--tr),.06))] text-[var(--t-hi)] shadow-[inset_0_0_0_1px_rgba(var(--tr),.3),0_0_26px_rgba(var(--tr),.14)]">
          {icon}
        </span>
        <span className="h-px w-10 bg-[linear-gradient(90deg,rgba(var(--tr),.45),transparent)]" />
      </div>
      <span className="mono mb-2 text-[10px] font-semibold tracking-[.18em] text-[var(--t-hi)] uppercase opacity-80">{eyebrow}</span>
      <strong className="text-2xl leading-tight font-bold tracking-[-.015em] text-pretty text-ink-strong">{title}</strong>
      <span className="mt-3 max-w-[44ch] text-sm leading-relaxed text-pretty text-ink-sub">{children}</span>
    </div>
  );
}

/** `onDelete` is optional: without it (the public page) sessions can be opened but not deleted. */
export function HistoryBoard({ history, current, live, onDelete, challengers }: Props & { live: boolean; onDelete?: (s: Session) => void; challengers: Challenger[] }) {
  const rows = [...(current ? [{ ...current, now: true }] : []), ...history.map((n) => ({ ...n, now: false }))];
  const [open, setOpen] = useState<{ n: Session; index: number } | null>(null);
  /** Winner of each row; undefined while a session is still in play, null for a draw. */
  const winners = rows.map((n) => (n.now && live ? undefined : winnerOf(n)));
  /** How many sessions in a row the winner had won, counting this one and the older ones below it. */
  const streakAt = (i: number) => {
    let k = 0;
    while (winners[i] && winners[i + k] === winners[i]) k++;
    return k;
  };
  const rgb = (w: Side | null | undefined) => (w === 'streamer' ? 'rgba(var(--ar),.85)' : w === 'chat' ? 'rgba(var(--cr),.85)' : 'rgba(255,255,255,.22)');

  return (
    <Panel as="section" aria-label="Round history" className="overflow-hidden py-3 sm:py-4">
      <table className={EDGE_TABLE}>
        <thead>
          <tr>
            <th>Round</th>
            <th className="w-[132px] text-right sm:w-[240px]">Score</th>
            <th className="w-[56px] sm:w-[84px]">
              <span className="sr-only">Result</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="!px-5 !pt-16 !pb-14 sm:!pt-20 sm:!pb-16">
                <EmptyTableState side="streamer" icon={<BoltIcon size={20} />} eyebrow="Round history" title="Your first round lands here">
                  Complete a round and its final score, result, and win streaks will build up here.
                </EmptyTableState>
              </td>
            </tr>
          )}
          {rows.map((n, i) => {
            const inPlay = n.now && live;
            const w = inPlay ? null : winnerOf(n);
            const flawless = !!w && n.bouts[w === 'streamer' ? 1 : 0] === 0;
            const streak = streakAt(i);
            const linked = !inPlay && i + 1 < rows.length && winners[i + 1] !== undefined;
            return (
              <tr
                key={i}
                className={cn(n.now && 'sb-tonight', !inPlay && 'cursor-pointer transition-colors hover:[&>td]:bg-white/[.045]')}
                onClick={inPlay ? undefined : () => setOpen({ n: n.now ? n : history[i - (current ? 1 : 0)], index: i })}
              >
                <td>
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      {inPlay && <span aria-hidden="true" className="size-2 flex-none animate-[sb-blink_1.2s_ease-in-out_infinite] rounded-full bg-accent shadow-[0_0_10px_rgba(var(--ar),.9)]" />}
                      {inPlay ? (
                        <span className="truncate text-[15px] font-semibold text-ink-strong">{n.name}</span>
                      ) : (
                        <button
                          type="button"
                          className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-[15px] font-semibold text-ink-strong"
                          title={n.name}
                          aria-haspopup="dialog"
                        >
                          {n.name}
                        </button>
                      )}
                      {flawless && (
                        <Tooltip content={<><b>Flawless</b> · won every challenge in the round</>}>
                          <span tabIndex={0} aria-label="Flawless victory" className="flex flex-none text-[#ffdc8f]">
                            <BoltIcon size={14} className="fill-current" />
                          </span>
                        </Tooltip>
                      )}
                    </span>
                    <span className="mono flex flex-wrap gap-x-1.5 gap-y-1 text-[11px] text-ink-muted">
                      <span className="whitespace-nowrap">
                        {n.date} @ {n.time}
                      </span>
                      <span className="whitespace-nowrap">
                        <span className="text-ink-faint max-sm:hidden">· </span>
                        {w ? `${n.bouts[w === 'streamer' ? 0 : 1]} of ${n.bouts[0] + n.bouts[1]} Won` : `${n.bouts[0] + n.bouts[1]} played`}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="text-right">
                  <span className="flex items-center justify-end gap-2.5 max-sm:flex-col-reverse max-sm:items-end max-sm:gap-1">
                    {streak >= 2 && w && (
                      <Tooltip content={<><b>{streak} in a row</b> for {SIDE_NAME[w]}.</>}>
                        <span tabIndex={0} aria-label={`${streak} round win streak`} className="flex items-center gap-0.5 text-[12px] font-bold text-[#ffb37a]">
                          <FlameIcon size={13} />
                          {streak}
                        </span>
                      </Tooltip>
                    )}
                    <span className="mono text-[14px] whitespace-nowrap sm:text-[17px]">
                      {SIDES.map((side, j) => (
                        <span key={side}>
                          {j > 0 && <span className="text-ink-faint"> – </span>}
                          <span data-side={side} className={w === side ? 'font-bold text-[var(--t-hi)]' : 'text-ink-soft'}>
                            {fmt(n[side])}
                          </span>
                        </span>
                      ))}
                    </span>
                  </span>
                </td>
                <td className="relative">
                  <span className="flex justify-center">
                    {inPlay ? (
                      <span aria-label="In play" className="block size-3.5 animate-pulse rounded-full shadow-[inset_0_0_0_1.5px_var(--color-ink-soft)]" />
                    ) : w ? (
                      <SideDot side={w} />
                    ) : (
                      <Tooltip content="Draw">
                        <span tabIndex={0} aria-label="Draw" className="block size-3.5 rounded-full bg-white/20" />
                      </Tooltip>
                    )}
                  </span>
                  {/* Thread down to the next (older) session's dot, fading from this winner's colour to that one's.
                      The wrapper copies the cell's padding so the thread centres on the dot, not on the whole cell. */}
                  {linked && (
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex justify-center" style={{ paddingLeft: 'inherit', paddingRight: 'inherit' }}>
                      <span className="relative w-0.5">
                        <span
                          className="absolute inset-x-0 rounded-full"
                          style={{ top: 'calc(50% + 13px)', height: 'calc(100% - 26px)', background: `linear-gradient(${rgb(w)}, ${rgb(winners[i + 1])})` }}
                        />
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <SessionSheet
        session={open?.n ?? null}
        index={open?.index ?? 0}
        onClose={() => setOpen(null)}
        onDelete={onDelete && open && history.includes(open.n) ? () => (onDelete(open.n), setOpen(null)) : undefined}
        challengers={challengers}
        sessions={history}
      />
    </Panel>
  );
}

/** Per-challenge history is not persisted yet, so the drawer stays empty rather than inventing rows. */
function playedIn(_n: Session, _index: number): { c: Challenge; winner: Side; votes: number }[] {
  return [];
}

/**
 * Segmented split in the "Segment pop" style from /feel: recessed cells that pop in one after another
 * when it mounts or the split moves — the streamer's from the left, chat's from the right, meeting at the split.
 */
export function SplitCells({ share, count, height = 18, className, streamerName = SIDE_NAME.streamer }: { share: number | null; count: number; height?: number; className?: string; streamerName?: string }) {
  // With nothing scored, both sides own half the bar instead of making either side look ahead.
  const balancedShare = share ?? 0.5;
  const lit = Math.round(balancedShare * count);
  const pct = Math.round(balancedShare * 100);
  const lights = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    lights.current.forEach((el, i) => {
      const step = i < lit ? i : count - 1 - i;
      el?.animate(
        [
          { opacity: 0, transform: 'scale(.3)' },
          { opacity: 1, transform: 'scale(1.35, 1.6)', filter: 'brightness(2.2)', offset: 0.45 },
          { opacity: 1, transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 300, delay: 120 + step * (800 / count), easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' },
      );
    });
  }, [lit, count]);

  return (
    <div
      className={cn('cells', className)}
      data-crisp=""
      style={{ '--cell-h': `${height}px` } as CSSProperties}
      role="img"
      aria-label={share == null ? `No points yet: ${streamerName} and chat are evenly split` : `Share of points: ${streamerName} ${pct}%, chat ${100 - pct}%`}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="cell" data-accent={i < lit ? undefined : 'chat'}>
          <i ref={(el) => void (lights.current[i] = el)} />
        </div>
      ))}
    </div>
  );
}

/** The drawer's split: cells plus the session's challenge tally underneath. */
function SegmentSplit({ session: n }: { session: Session }) {
  const total = n.streamer + n.chat;
  return (
    <div className="flex flex-col gap-3">
      <SplitCells share={total ? n.streamer / total : null} count={24} />
      <SplitLabels
        a={n.bouts[0]}
        b={n.bouts[1]}
        tip={<><b>Challenges</b> won by {SIDE_NAME.streamer} / {SIDE_NAME.chat}.</>}
        label={`${SIDE_NAME.streamer} won ${n.bouts[0]} challenges, chat won ${n.bouts[1]}`}
      />
    </div>
  );
}

function SessionSheet({
  session,
  index,
  onClose,
  onDelete,
  challengers,
  sessions,
}: {
  session: Session | null;
  index: number;
  onClose: () => void;
  onDelete?: () => void;
  challengers: Challenger[];
  sessions: Session[];
}) {
  const [confirming, setConfirming] = useState(false);
  /** The viewer whose challenge was clicked; their drawer opens on top of this one. */
  const [who, setWho] = useState<{ c: Challenger; rank: number } | null>(null);
  const openChallenger = (name: string) => {
    const ranked = [...challengers].sort((a, b) => b.points - a.points);
    const at = ranked.findIndex((x) => x.name === name);
    setWho(at >= 0 ? { c: ranked[at], rank: at + 1 } : { c: { name, points: 0, played: 1, won: 0 }, rank: ranked.length + 1 });
  };
  // Keep showing the last session while the drawer animates closed.
  const last = useRef<{ n: Session; index: number } | null>(null);
  if (session) last.current = { n: session, index };
  const n = last.current?.n ?? null;
  const w = n && winnerOf(n);
  const flawless = !!n && !!w && n.bouts[w === 'streamer' ? 1 : 0] === 0;
  return (
    <Sheet
      open={!!session}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={<span className="block truncate text-[24px] leading-tight font-bold tracking-[-.01em]">{n?.name ?? ''}</span>}
      actions={
        <>
          {/* Result from the streamer's side, so it reads at a glance. */}
          {n && (
            <span
              data-side={w ?? undefined}
              className={cn(
                'mono flex h-8 items-center rounded-[10px] px-3 text-[13px] font-bold tracking-[.08em] uppercase',
                w
                  ? 'bg-[linear-gradient(180deg,var(--t-hi),var(--t))] text-[#0d0f10] shadow-[0_0_14px_-3px_rgba(var(--tr),.8),inset_0_1px_0_rgba(255,255,255,.4)]'
                  : 'bg-white/6 text-ink-soft shadow-[inset_0_0_0_1px_rgba(255,255,255,.15)]',
              )}
            >
              {w === 'streamer' ? 'Won' : w === 'chat' ? 'Loss' : 'Draw'}
            </span>
          )}
          {onDelete && (
            <Button size="xs" variant="solid" icon onClick={() => setConfirming(true)} aria-label="Delete round" title="Delete round">
              <TrashIcon size={14} />
            </Button>
          )}
        </>
      }
    >
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Delete this round?"
        description={`Removes “${n?.name}” and its results from history and the overall score for good`}
        confirmLabel="Delete round"
        cancelLabel="Keep it"
        onConfirm={() => onDelete?.()}
      />
      <ChallengerSheet open={who} sessions={sessions} onClose={() => setWho(null)} />
      {n && (
        <div className="flex flex-col gap-6 pt-1">
          <span className="mono -mt-4 text-[12px] text-ink-muted">
            {n.date} @ {n.time}
          </span>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {SIDES.map((side) => {
                const won = w === side;
                return (
                  <Well
                    key={side}
                    data-side={side}
                    className="flex min-h-[120px] flex-col justify-end px-5 py-5"
                  >
                    {/* Winner row: Flawless tag over the points, crown in the opposite corner, on one line. */}
                    {won && (
                      <span className={cn('mb-2 flex items-center justify-between gap-3', side === 'chat' && 'flex-row-reverse')}>
                        {flawless ? (
                          <span className="pixel flex items-center gap-1 rounded-full bg-[#ffd166]/10 py-1 pr-2.5 pl-2 text-[14px] text-[#ffdc8f]">
                            <BoltIcon size={13} className="fill-current" />
                            Flawless
                          </span>
                        ) : (
                          <span />
                        )}
                        <CrownIcon size={24} aria-label="Winner" className="text-[var(--t-hi)] drop-shadow-[0_0_8px_rgba(var(--tr),.8)]" />
                      </span>
                    )}
                    <span className={cn('flex items-baseline justify-between gap-3', side === 'chat' && 'flex-row-reverse')}>
                      <span className="pixel sb-lit sb-lit-crisp text-[clamp(36px,6vw,48px)] leading-none">{fmt(n[side])}</span>
                    </span>
                  </Well>
                );
              })}
            </div>
            <SegmentSplit key={`${n.name}-${n.date}`} session={n} />
          </div>

          <table className={DRAWER_TABLE}>
            <thead>
              <tr>
                <th>Challenge</th>
                <th className="w-[150px] max-sm:hidden">Suggested by</th>
                <th className="w-[72px] text-right">Votes</th>
              </tr>
            </thead>
            <tbody>
              {playedIn(n, last.current!.index).map((p, i) => (
                <tr key={i} className="cursor-pointer transition-colors hover:[&>td]:bg-white/[.045]" onClick={() => openChallenger(p.c.by)}>
                  <td>
                    <span className="flex min-w-0 items-center gap-3">
                      <SideDot side={p.winner} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ink-strong">{p.c.title}</span>
                        <span className="mono block truncate text-[13px] text-ink-soft sm:hidden">@{p.c.by}</span>
                      </span>
                    </span>
                  </td>
                  <td className="max-sm:hidden">
                    <button type="button" aria-haspopup="dialog" className="mono block max-w-full truncate border-0 bg-transparent p-0 text-left text-[14px] text-ink-soft">
                      @{p.c.by}
                    </button>
                  </td>
                  <td className="mono text-right text-[14px] text-ink-soft">{p.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sheet>
  );
}

/* ───────────────────────── Top challengers ───────────────────────── */

export type Challenger = {
  name: string;
  /** Points earned from their ideas being approved, played and beating the streamer. */
  points: number;
  /** Their ideas that were played. */
  played: number;
  /** Of those, how many the streamer lost. */
  won: number;
};

/** Gold, silver, bronze. */
const SHIELD = [
  { light: '#fff4c7', mid: '#ffc83a', dark: '#c4820c', rim: '#6e4404', text: '#3d2500', glow: '255,200,58' },
  { light: '#ffffff', mid: '#d3dbe2', dark: '#8b97a2', rim: '#46505a', text: '#1d242a', glow: '214,224,232' },
  { light: '#ffdcbf', mid: '#e48a4f', dark: '#9b4b1f', rim: '#55250b', text: '#3a1605', glow: '228,138,79' },
];

const SHIELD_OUTER = 'M14 1 26.5 5.2v9.3c0 7.4-5.1 13-12.5 15.8C6.6 27.5 1.5 21.9 1.5 14.5V5.2z';
const SHIELD_INNER = 'M14 3.3 24.2 6.8v7.8c0 6.1-4.1 10.8-10.2 13.3C7.9 25.4 3.8 20.7 3.8 14.6V6.8z';

/**
 * Medal shield for the top three — metal rim, bevelled face, a gloss highlight and a soft glow, and a
 * light sweep across the gold one. Wiggles when its row is hovered (rows carry `group`). Flat and faded after third.
 */
export function RankShield({ rank, size = 28 }: { rank: number; size?: number }) {
  const id = useId();
  const t = SHIELD[rank - 1];
  if (!t) {
    // Everyone after third: the same shape, flat and faded.
    return (
      <svg width={size} height={size * 1.12} viewBox="0 0 28 31" aria-label={`Rank ${rank}`}>
        <path d={SHIELD_INNER} fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.12)" strokeWidth="1" />
        <text x="14" y="19.6" textAnchor="middle" fontSize={rank > 9 ? 11 : 12.5} fontWeight="700" fontFamily="var(--font-mono)" fill="var(--color-ink-muted)">
          {rank}
        </text>
      </svg>
    );
  }
  const still = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return (
    <svg
      width={size}
      height={size * 1.12}
      viewBox="0 0 28 31"
      aria-label={`Rank ${rank}`}
      className="overflow-visible transition-transform duration-300 ease-[cubic-bezier(.3,1.6,.5,1)] group-hover:-rotate-8 group-hover:scale-115"
      style={{ filter: `drop-shadow(0 2px 3px rgba(0,0,0,.55)) drop-shadow(0 0 8px rgba(${t.glow},.45))` }}
    >
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2=".35" y2="1">
          <stop offset="0" stopColor={t.light} />
          <stop offset=".45" stopColor={t.mid} />
          <stop offset="1" stopColor={t.dark} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={t.mid} />
          <stop offset="1" stopColor={t.rim} />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={SHIELD_INNER} />
        </clipPath>
      </defs>
      {/* Rim, then the face set into it */}
      <path d={SHIELD_OUTER} fill={`url(#${id}-rim)`} />
      <path d={SHIELD_INNER} fill={`url(#${id}-face)`} />
      <g clipPath={`url(#${id}-clip)`}>
        {/* Bevel: the left half catches more light */}
        <path d="M3.8 6.8 14 3.3v25H3.8z" fill="#fff" opacity=".18" />
        {/* Gloss */}
        <ellipse cx="9.5" cy="8.2" rx="6" ry="2.6" transform="rotate(-18 9.5 8.2)" fill="#fff" opacity=".55" />
        {/* Light sweep on gold */}
        {rank === 1 && !still && (
          <rect x="-12" y="-4" width="5" height="40" fill="#fff" opacity=".6" transform="rotate(20)">
            <animate attributeName="x" values="-12;-12;34" keyTimes="0;.7;1" dur="3.2s" repeatCount="indefinite" />
          </rect>
        )}
      </g>
      <path d={SHIELD_INNER} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth=".8" />
      {/* Stamped number: a light edge under the dark figure */}
      <text x="14" y="20.4" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily="var(--font-mono)" fill="#fff" opacity=".55">
        {rank}
      </text>
      <text x="14" y="19.6" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily="var(--font-mono)" fill={t.text}>
        {rank}
      </text>
    </svg>
  );
}

/** Leaderboard of the viewers whose challenges did the most damage. Rows open that viewer's record. */
export function ChallengerBoard({ challengers, sessions }: { challengers: Challenger[]; sessions: Session[] }) {
  const top = [...challengers].sort((a, b) => b.points - a.points).slice(0, 10);
  const [open, setOpen] = useState<{ c: Challenger; rank: number } | null>(null);
  return (
    <Panel as="section" aria-label="Top challengers" className="overflow-hidden py-3 sm:py-4">
      <table className={EDGE_TABLE}>
        <thead>
          <tr>
            <th className="w-[52px] sm:w-[68px]">
              <span className="sr-only">Rank</span>
            </th>
            <th>Top challengers</th>
            <th className="w-[84px] text-right sm:w-[110px]">Points</th>
            <th className="w-[96px] text-right sm:w-[130px]" title={`Won (${SIDE_NAME.streamer} lost) / played`}>
              Won
            </th>
          </tr>
        </thead>
        <tbody>
          {top.length === 0 && (
            <tr>
              <td colSpan={4} className="!px-5 !pt-16 !pb-14 sm:!pt-20 sm:!pb-16">
                <EmptyTableState side="chat" icon={<TrophyIcon size={20} />} eyebrow="Challenger rankings" title="Chat’s leaderboard starts here">
                  When viewer challenges make the lineup, their points and rankings will start to build.
                </EmptyTableState>
              </td>
            </tr>
          )}
          {top.map((c, i) => (
            <tr key={c.name} className="group cursor-pointer transition-colors hover:[&>td]:bg-white/[.045]" onClick={() => setOpen({ c, rank: i + 1 })}>
              <td className="py-2.5">
                <RankShield rank={i + 1} />
              </td>
              <td>
                <button type="button" aria-haspopup="dialog" className="mono block max-w-full truncate border-0 bg-transparent p-0 text-left text-[14px] font-semibold text-ink-strong">
                  @{c.name}
                </button>
              </td>
              <td className="mono text-right text-[15px] font-bold text-ink-strong">{fmt(c.points)}</td>
              <td className="mono text-right text-[14px] whitespace-nowrap" aria-label={`${c.won} won of ${c.played} played`}>
                <span data-side="chat" className="font-bold text-[var(--t-hi)]">
                  {c.won}
                </span>
                <span className="text-ink-strong">
                  <span className="opacity-50"> / </span>
                  {c.played}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ChallengerSheet open={open} sessions={sessions} onClose={() => setOpen(null)} />
    </Panel>
  );
}

/** Per-challenge leaderboard history is not persisted yet. */
function challengesBy(_c: Challenger, _rank: number, _sessions: Session[]): { title: string; session: Session | undefined; votes: number; winner: Side }[] {
  return [];
}

function ChallengerSheet({ open, sessions, onClose }: { open: { c: Challenger; rank: number } | null; sessions: Session[]; onClose: () => void }) {
  // Keep showing the last viewer while the drawer animates closed.
  const last = useRef(open);
  if (open) last.current = open;
  const shown = last.current;
  const c = shown?.c;
  const lost = c ? c.played - c.won : 0;
  const challenges = c && shown ? challengesBy(c, shown.rank, sessions) : [];
  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={
        shown && (
          <span className="flex min-w-0 items-center gap-3">
            <RankShield rank={shown.rank} size={32} />
            <span className="mono truncate text-[24px] leading-tight font-bold">@{shown.c.name}</span>
          </span>
        )
      }
    >
      {c && shown && (
        <div className="flex flex-col gap-6 pt-1">
          {/* Same lit readouts as the score windows, in chat's colour — challengers play for chat. */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['Points', fmt(c.points)],
                ['Played', String(c.played)],
                ['Win rate', `${Math.round((c.won / Math.max(1, c.played)) * 100)}%`],
              ] as const
            ).map(([label, value]) => (
              <Well key={label} data-side="chat" className="flex min-h-[110px] flex-col justify-between px-5 pt-4 pb-5">
                <span className="lbl text-[10px]">{label}</span>
                <span className="pixel sb-lit sb-lit-crisp text-[clamp(30px,5vw,40px)] leading-none">{value}</span>
              </Well>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <SplitCells key={c.name} share={c.played ? lost / c.played : null} count={24} />
            <SplitLabels
              a={lost}
              b={c.won}
              tip={<><b>Their challenges</b> won by {SIDE_NAME.streamer} / by chat</>}
              label={`${SIDE_NAME.streamer} beat ${lost} of their challenges, they beat ${SIDE_NAME.streamer} on ${c.won}`}
            />
          </div>

          <table className={DRAWER_TABLE}>
            <thead>
              <tr>
                <th>Challenge</th>
                <th className="w-[170px] max-sm:hidden">Round</th>
                <th className="w-[72px] text-right">Votes</th>
              </tr>
            </thead>
            <tbody>
              {challenges.length === 0 && (
                <tr>
                  <td colSpan={3} className="!px-5 !pt-14 !pb-12 sm:!pt-16 sm:!pb-14">
                    <EmptyTableState side="chat" icon={<BoltIcon size={20} />} eyebrow="Challenge history" title="No challenge details recorded">
                      Their overall points and win record are still counted above. Individual challenge details are not available for this challenger yet.
                    </EmptyTableState>
                  </td>
                </tr>
              )}
              {challenges.map((p, i) => (
                // Hover only for now — clicking will open the session this was played in.
                <tr key={i} className="cursor-pointer transition-colors hover:[&>td]:bg-white/[.045]">
                  <td>
                    <span className="flex min-w-0 items-center gap-3">
                      <SideDot side={p.winner} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-ink-strong">{p.title}</span>
                        <span className="block truncate text-[12px] text-ink-muted sm:hidden">{p.session?.name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="max-sm:hidden">
                    <span className="block truncate text-[13px] text-ink-soft">{p.session?.name}</span>
                  </td>
                  <td className="mono text-right text-[14px] text-ink-soft">{p.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sheet>
  );
}

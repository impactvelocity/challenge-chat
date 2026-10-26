import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useRef, useState } from 'react';
import { Pagination, Sheet, Well } from '@/components/ui';
import type { Challenge } from '@/model';
import { DRAWER_TABLE } from './Boards';

/** One `!vote` from chat. `at` is a timestamp in ms. */
export type Voter = { name: string; at: number };

const HEADS = ['pixel', 'nova', 'quiet', 'lowkey', 'tea', 'moss', 'koda', 'frost', 'echo', 'byte', 'lunar', 'salty', 'turbo', 'mango', 'static', 'velvet', 'crisp', 'orbit', 'sunny', 'grim'];
const TAILS = ['brat', '_rx', 'queen', 'leo', 'toast', 'girl', 'wan', 'fox', 'main', 'gg', '_tv', 'lord', 'cat', 'wave', 'kid', 'otter'];

/** Mock viewer name for the k-th vote on a challenge: same every render. */
export function viewerName(id: string, k: number) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const x = (h + k * 7919) >>> 0;
  const num = x % 5 === 0 ? String(x % 97) : '';
  return HEADS[x % HEADS.length] + TAILS[(x >>> 5) % TAILS.length] + num;
}

const PAGE_SIZE = 15;

/** "8:42:15pm" */
const stamp = (at: number) => new Date(at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).replace(' ', '').toLowerCase();

type Props = {
  /** The challenge whose voters are shown, with its !vote number and live standing. */
  open: { c: Challenge; num: number; votes: number; share: number; rank: number; voters: Voter[] } | null;
  onClose: () => void;
};

/** Who voted for one challenge, newest first. Updates live while voting runs. */
export function VotersSheet({ open, onClose }: Props) {
  // Keep showing the last challenge while the drawer animates closed.
  const last = useRef(open);
  if (open) last.current = open;
  const shown = last.current;
  // New votes slide in at the top.
  const [rows] = useAutoAnimate<HTMLTableSectionElement>({ duration: 220 });
  // Back to the newest page whenever another challenge opens.
  const [page, setPage] = useState(1);
  const [pageFor, setPageFor] = useState(open?.c.id);
  if (open && open.c.id !== pageFor) {
    setPageFor(open.c.id);
    setPage(1);
  }
  const count = shown ? Math.max(1, Math.ceil(shown.voters.length / PAGE_SIZE)) : 1;
  const current = Math.min(page, count);

  return (
    <Sheet
      open={!!open}
      onOpenChange={(o) => !o && onClose()}
      wide
      title={shown && <span className="block truncate text-[22px] leading-tight font-bold">{shown.c.title}</span>}
      actions={shown && <span className="mono self-center pr-1 text-[14px] text-ink-muted">!vote {shown.num}</span>}
    >
      {shown && (
        <div className="flex flex-col gap-6 pt-1">
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ['Votes', String(shown.votes)],
                ['Share', `${shown.share}%`],
                ['Rank', `#${shown.rank}`],
              ] as const
            ).map(([label, value]) => (
              <Well key={label} className="flex min-h-[96px] flex-col justify-between px-5 pt-4 pb-4">
                <span className="lbl text-[10px]">{label}</span>
                <span className="pixel sb-lit sb-lit-crisp text-[clamp(28px,5vw,36px)] leading-none" data-side="streamer">
                  {value}
                </span>
              </Well>
            ))}
          </div>

          <table className={DRAWER_TABLE}>
            <thead>
              <tr>
                <th>Viewer</th>
                <th className="w-[130px] text-right">Voted at</th>
              </tr>
            </thead>
            {/* Keyed by page so flipping pages swaps rows at once; only new votes slide in */}
            <tbody ref={rows} key={current}>
              {shown.voters.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-10 text-center text-[14px] text-ink-muted">
                    No votes yet
                  </td>
                </tr>
              )}
              {[...shown.voters]
                .reverse()
                .slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
                .map((v) => (
                  <tr key={`${v.name}-${v.at}`} className="transition-colors hover:[&>td]:bg-white/[.045]">
                    <td className="mono truncate text-[14px] text-ink-soft">@{v.name}</td>
                    <td className="mono text-right text-[12px] text-ink-muted">{stamp(v.at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          {shown.voters.length > PAGE_SIZE && (
            <Pagination
              page={current}
              pageSize={PAGE_SIZE}
              total={shown.voters.length}
              noun="votes"
              onPageChange={setPage}
              className="-mx-[26px] -mt-6 border-t border-black/40 px-[26px] pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,.04)]"
            />
          )}
        </div>
      )}
    </Sheet>
  );
}

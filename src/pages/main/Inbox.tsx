import { useRef, useState } from 'react';
import { CheckIcon, InboxIcon, InfoIcon, PlayCircleIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { Button, ConfirmDialog, Pagination, Panel, Tag, Tooltip } from '@/components/ui';
import type { Challenge } from '@/model';
import { cn } from '@/lib/cn';
import { ChallengeMeta } from '@/pages/app/parts';
import { EDGE_TABLE, EmptyTableState } from './Boards';

/**
 * A challenge chat suggested with !challenge. Viewers can send these any time, not just while submissions are open.
 * `seen`: someone already looked at it in a session (e.g. it wasn't picked for a vote), so it isn't counted as new.
 */
export type InboxIdea = { c: Challenge; at: string; seen?: boolean };

/** Mock: how many ideas the inbox would hold across every page. */
const INBOX_TOTAL = 48;

type Props = {
  items: InboxIdea[];
  /** Ideas marked to join the next round's submissions. */
  queued: string[];
  /** Submissions are open right now, so adding an idea moves it straight in. */
  submitting: boolean;
  /** No session is running, so the queued ideas can open one. */
  canOpen: boolean;
  onAdd: (item: InboxIdea) => void;
  onReject: (item: InboxIdea) => void;
  onAddAll: () => void;
  onOpen: () => void;
};

export function Inbox({ items, queued, submitting, canOpen, onAdd, onReject, onAddAll, onOpen }: Props) {
  const waiting = items.filter((i) => !queued.includes(i.c.id)).length;
  const [deleting, setDeleting] = useState<InboxIdea | null>(null);
  // Mock: only one page of ideas exists, so paging just moves the highlight.
  const [page, setPage] = useState(1);
  // Keep the text while the dialog animates closed.
  const lastDeleting = useRef<InboxIdea | null>(null);
  if (deleting) lastDeleting.current = deleting;
  const shown = lastDeleting.current;

  return (
    <Panel as="section" aria-labelledby="h-inbox" className="overflow-hidden pb-3 sm:pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4 pt-5 pr-3 pb-3 pl-4 sm:pt-6 sm:pr-6 sm:pl-7">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 id="h-inbox" className="m-0 text-[22px] leading-tight font-bold text-ink-strong">
            Challenge Inbox
          </h1>
          <Tooltip
            content={
              <>
                Chat suggests with <b>!challenge</b> and ideas land here
                <span className="mt-1.5 block">
                  {waiting} waiting
                  {!submitting && queued.length > 0 && `, ${queued.length} set for next round`}
                </span>
              </>
            }
          >
            <span tabIndex={0} aria-label="About the challenge inbox" className="flex cursor-help text-ink-muted transition-colors hover:text-ink-strong">
              <InfoIcon size={17} />
            </span>
          </Tooltip>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onAddAll} disabled={!waiting}>
            <PlusIcon size={14} />
            {submitting ? 'Add all to submissions' : 'Add all'}
          </Button>
          {canOpen && (
            <Button size="sm" variant="accent" onClick={onOpen} disabled={!queued.length}>
              <PlayCircleIcon size={16} />
              {queued.length ? `Open submissions with ${queued.length}` : 'Open submissions'}
            </Button>
          )}
        </div>
      </div>

      <table className={EDGE_TABLE}>
        <thead>
          <tr>
            <th>Challenge</th>
            <th className="w-[160px] max-sm:hidden">From</th>
            <th className="w-[104px] sm:w-[170px]">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={3} className="!px-5 !pt-16 !pb-14 sm:!pt-20 sm:!pb-16">
                <EmptyTableState side="streamer" icon={<InboxIcon size={20} />} eyebrow="Challenge inbox" title="Ideas from chat will land here">
                  When viewers use <span className="mono text-ink-soft">!challenge</span>, their suggestions will be ready for you to review and add to a round.
                </EmptyTableState>
              </td>
            </tr>
          )}
          {items.map((item) => {
            const { c } = item;
            const on = queued.includes(c.id);
            return (
              <tr key={c.id} className="transition-colors hover:[&>td]:bg-white/[.03]">
                <td>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className={cn('truncate text-[15px] font-semibold', item.seen ? 'text-ink-sub' : 'text-ink-strong')}>{c.title}</span>
                    {item.seen && !on && <span className="mono flex-none text-[10.5px] tracking-[.12em] text-ink-muted uppercase">Seen</span>}
                    {on && <Tag>Next round</Tag>}
                  </span>
                  <ChallengeMeta c={c} className="pt-1.5" />
                  <span className="mono block truncate pt-0.5 text-[11px] text-ink-muted sm:hidden">
                    @{c.by} · {item.at}
                  </span>
                </td>
                <td className="max-sm:hidden">
                  <span className="mono block truncate text-[14px] text-ink-soft">@{c.by}</span>
                  <span className="mono block pt-0.5 text-[11px] text-ink-muted">{item.at}</span>
                </td>
                <td>
                  <span className="flex items-center justify-end gap-2">
                    <Button size="sm" variant={on ? 'accent' : 'ghost'} onClick={() => onAdd(item)} aria-pressed={submitting ? undefined : on}>
                      {on ? <CheckIcon size={14} /> : <PlusIcon size={14} />}
                      <span className="max-sm:hidden">{on ? 'Added' : 'Add'}</span>
                    </Button>
                    <Button size="xs" icon variant="ghost" onClick={() => setDeleting(item)} aria-label={`Delete ${c.title}`}>
                      <TrashIcon size={14} />
                    </Button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {items.length > 0 && (
        <Pagination
          page={page}
          pageSize={10}
          total={INBOX_TOTAL}
          noun="challenges"
          onPageChange={setPage}
          className="border-t border-black/40 pt-3 pr-3 pl-4 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:pr-6 sm:pl-7"
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this challenge?"
        description={shown ? `“${shown.c.title}” from @${shown.c.by} will be removed from the inbox` : ''}
        confirmLabel="Delete"
        cancelLabel="Keep it"
        onConfirm={() => deleting && onReject(deleting)}
      />
    </Panel>
  );
}

import { ArrowLeftIcon, ArrowRightIcon } from '@/components/icons';
import { cn } from '@/lib/cn';
import { Button } from './Button';

/** 1 … 4 5 6 … 12 — first, last, and the pages either side of the current one. */
function pageList(count: number, page: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const near = [page - 1, page, page + 1].filter((p) => p > 1 && p < count);
  if (page <= 3) near.push(2, 3, 4);
  if (page >= count - 2) near.push(count - 3, count - 2, count - 1);
  const pages = [...new Set([1, ...near, count])].filter((p) => p >= 1 && p <= count).sort((a, b) => a - b);
  return pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? (['gap', p] as const) : [p]));
}

type PaginationProps = {
  /** 1-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** What the rows are, for the summary: "challenges", "sessions"… */
  noun?: string;
  className?: string;
};

/** Summary on the left ("1–10 of 48 challenges"), page keys on the right. */
export function Pagination({ page, pageSize, total, onPageChange, noun = 'items', className }: PaginationProps) {
  const count = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <span className="text-[13px] text-ink-muted">
        <b className="mono font-semibold text-ink-soft">
          {from}–{to}
        </b>{' '}
        of <b className="mono font-semibold text-ink-soft">{total}</b> {noun}
      </span>
      <span className="flex items-center gap-1">
        <Button size="xs" variant="ghost" icon disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ArrowLeftIcon size={14} />
        </Button>
        {pageList(count, page).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="mono w-6 text-center text-[13px] text-ink-faint" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              aria-label={`Page ${p}`}
              className={cn(
                'mono h-8 min-w-8 cursor-pointer rounded-[9px] border-0 px-2 text-[13px] transition-colors max-sm:hidden',
                p === page
                  ? 'bg-[#141618] font-bold text-ink-strong shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] max-sm:inline-block'
                  : 'bg-transparent text-ink-sub hover:bg-white/[.06] hover:text-ink-strong',
              )}
            >
              {p}
            </button>
          ),
        )}
        <Button size="xs" variant="ghost" icon disabled={page >= count} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ArrowRightIcon size={14} />
        </Button>
      </span>
    </nav>
  );
}

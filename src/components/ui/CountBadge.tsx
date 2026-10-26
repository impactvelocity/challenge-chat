import { cn } from '@/lib/cn';

/**
 * Small count pinned to an icon button's corner. `accent` rings it in the primary colour,
 * for counts that mean something is live (e.g. overlay elements on screen). Renders nothing at zero.
 */
export function CountBadge({ n, accent, className }: { n: number; accent?: boolean; className?: string }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        'absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#222629] px-1 text-[11px] leading-none font-bold',
        accent
          ? 'text-[var(--a-text)] shadow-[inset_0_0_0_1.5px_rgba(var(--ar),.85),0_0_0_1px_rgba(0,0,0,.4),0_0_8px_rgba(var(--ar),.35)]'
          : 'text-ink-soft shadow-[inset_0_0_0_1.5px_rgba(255,255,255,.18),0_0_0_1px_rgba(0,0,0,.4)]',
        className,
      )}
    >
      {n}
    </span>
  );
}

import { TrophyIcon, UsersIcon } from '@/components/icons';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { Side } from '@/scoreboard/model';
import { SIDE_NAME } from './Boards';

const SIDES = ['streamer', 'chat'] as const;

/**
 * The "who won?" keys on the Live step. Neutral keys so the label always reads; each side's colour is only a hint:
 * a tall lit stripe on the key's outer edge (like the active channel row), pointing at that side of the scoreboard.
 */
export function WinButtons({ onWin, busy = false, pendingAction }: { onWin: (side: Side, from: HTMLElement | null) => void; busy?: boolean; pendingAction?: string | null }) {
  return (
    <div className="grid grid-cols-2 gap-3.5">
      {SIDES.map((side) => (
        <Button key={side} size="lg" data-side={side} className="relative [--btn-h:72px]" disabled={busy} loading={pendingAction === `win-${side}`} loadingLabel="Saving…" onClick={(e) => onWin(side, e.currentTarget)}>
          {side === 'streamer' ? (
            <TrophyIcon size={20} className="text-[var(--t-hi)] max-sm:hidden" />
          ) : (
            <UsersIcon size={20} className="text-[var(--t-hi)] max-sm:hidden" />
          )}
          {SIDE_NAME[side]} wins
          <span
            aria-hidden="true"
            className={cn(
              'absolute top-3.5 bottom-3.5 w-[3px] rounded-full bg-[var(--t)] shadow-[0_0_8px_rgba(var(--tr),.8)]',
              side === 'streamer' ? 'left-3.5' : 'right-3.5',
            )}
          />
        </Button>
      ))}
    </div>
  );
}

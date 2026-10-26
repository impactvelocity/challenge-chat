import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type MenuItem = {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  /** Destructive action: red text. */
  danger?: boolean;
};

/** A small action menu opened from any button (Base UI Menu), styled like the Select dropdown. */
export function Menu({ trigger, items, align = 'end' }: { trigger: ReactElement; items: MenuItem[]; align?: 'start' | 'center' | 'end' }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner sideOffset={8} align={align} className="z-50 outline-none">
          <BaseMenu.Popup className="ddmenu min-w-[200px]">
            {items.map((item, i) => (
              <BaseMenu.Item key={i} onClick={item.onSelect} className={cn('ddopt justify-start gap-2.5', item.danger && 'text-[#ff8a95] data-[highlighted]:text-[#ffb0b7]')}>
                {item.icon && <span className="flex flex-none opacity-80">{item.icon}</span>}
                {item.label}
              </BaseMenu.Item>
            ))}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

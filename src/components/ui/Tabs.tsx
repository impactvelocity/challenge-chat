import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type TabsProps<T extends string> = {
  items: { value: T; label: ReactNode; content?: ReactNode }[];
  value: T;
  onValueChange: (value: T) => void;
  /** `raised`: sliding key-cap in a recessed well. `underline`: lit rail. */
  variant?: 'raised' | 'underline';
  className?: string;
  panelClassName?: string;
  'aria-label'?: string;
};

export function Tabs<T extends string>({ items, value, onValueChange, variant = 'raised', className, panelClassName, ...rest }: TabsProps<T>) {
  const raised = variant === 'raised';
  return (
    <BaseTabs.Root value={value} onValueChange={(v) => onValueChange(v as T)} className={cn('flex flex-col gap-[22px]', className)}>
      <BaseTabs.List className={raised ? 'tabs well' : 'utabs'} aria-label={rest['aria-label']}>
        {items.map((item) => (
          <BaseTabs.Tab key={item.value} value={item.value} className={raised ? 'tab' : 'utab'}>
            {item.label}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator className={raised ? 'tab-indicator' : 'utab-indicator'} />
      </BaseTabs.List>
      {items.some((i) => i.content) &&
        items.map((item) => (
          <BaseTabs.Panel key={item.value} value={item.value} className={cn(panelClassName)}>
            {item.content}
          </BaseTabs.Panel>
        ))}
    </BaseTabs.Root>
  );
}

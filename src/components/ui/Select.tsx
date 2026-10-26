import { Select as BaseSelect } from '@base-ui/react/select';
import type { ComponentProps } from 'react';
import { ChevronDownIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

/** `group` puts consecutive options under a heading in the menu. */
export type SelectOption = { value: string; label: string; meta?: string; group?: string };

type SelectProps = {
  options: SelectOption[];
  value: string;
  onValueChange: (value: string) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
};

/** Recessed trigger with a raised popup menu; options can carry mono metadata and sit in groups. */
export function Select({ options, value, onValueChange, size = 'md', className, ...rest }: SelectProps) {
  const item = (o: SelectOption) => (
    <BaseSelect.Item key={o.value} value={o.value} className="ddopt">
      <BaseSelect.ItemText>{o.label}</BaseSelect.ItemText>
      {o.meta && <span className="mono text-[11px] tracking-[.08em] text-ink-muted">{o.meta}</span>}
    </BaseSelect.Item>
  );
  // Runs of options that share a group, in order.
  const runs = options.reduce<{ group?: string; options: SelectOption[] }[]>((acc, o) => {
    const last = acc[acc.length - 1];
    if (last && last.group === o.group) last.options.push(o);
    else acc.push({ group: o.group, options: [o] });
    return acc;
  }, []);

  return (
    <BaseSelect.Root items={options} value={value} onValueChange={(v) => v != null && onValueChange(v)}>
      <BaseSelect.Trigger
        className={cn('ddbtn well', className)}
        data-size={size === 'sm' ? 'sm' : undefined}
        aria-label={rest['aria-label']}
      >
        <BaseSelect.Value />
        <BaseSelect.Icon className="chev flex">
          <ChevronDownIcon />
        </BaseSelect.Icon>
      </BaseSelect.Trigger>
      <BaseSelect.Portal>
        <BaseSelect.Positioner sideOffset={8} alignItemWithTrigger={false} className="z-50 outline-none">
          <BaseSelect.Popup className="ddmenu">
            <BaseSelect.List>
              {runs.map((r, i) =>
                r.group ? (
                  <BaseSelect.Group key={r.group} className="ddgroup">
                    <BaseSelect.GroupLabel className="ddgroup-label">{r.group}</BaseSelect.GroupLabel>
                    {r.options.map(item)}
                  </BaseSelect.Group>
                ) : (
                  <div key={i}>{r.options.map(item)}</div>
                ),
              )}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}

/** Styled native `<select>` for when platform keyboard/mobile behaviour matters most. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('native-select well', className)} {...props} />;
}

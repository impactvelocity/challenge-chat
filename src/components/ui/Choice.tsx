import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import type { ReactNode } from 'react';
import { CheckIcon } from '@/components/icons';

/** Segmented control — one pressed key-cap in a recessed well. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  'aria-label': ariaLabel,
  fill,
  disabled = false,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onValueChange: (value: T) => void;
  'aria-label'?: string;
  /** Stretch to the full width, keys sharing it equally. */
  fill?: boolean;
  disabled?: boolean;
}) {
  return (
    <ToggleGroup
      disabled={disabled}
      value={[value]}
      onValueChange={(v) => v[0] && onValueChange(v[0] as T)}
      className={fill ? 'segc well w-full min-w-max [&>*]:flex-1 [&>*]:whitespace-nowrap' : 'segc well self-start'}
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <Toggle key={o.value} value={o.value} className="segc-item">
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

export function Checkbox({ children, ...props }: Omit<BaseCheckbox.Root.Props, 'className'> & { children: ReactNode }) {
  return (
    <label className="check">
      <BaseCheckbox.Root className="box" {...props}>
        <BaseCheckbox.Indicator className="flex">
          <CheckIcon size={14} strokeWidth={3.5} />
        </BaseCheckbox.Indicator>
      </BaseCheckbox.Root>
      {children}
    </label>
  );
}

export function RadioGroup<T extends string>({
  options,
  value,
  onValueChange,
  label,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onValueChange: (value: T) => void;
  label: string;
}) {
  return (
    <BaseRadioGroup
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className="flex flex-col gap-3"
      aria-label={label}
    >
      {options.map((o) => (
        <label key={o.value} className="check">
          <Radio.Root value={o.value} className="box" data-round="">
            <Radio.Indicator className="radio-dot" />
          </Radio.Root>
          {o.label}
        </label>
      ))}
    </BaseRadioGroup>
  );
}

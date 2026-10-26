import { Switch } from '@base-ui/react/switch';
import { useId } from 'react';

type ToggleProps = {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Label and switch on one row, the switch without its well. */
  inline?: boolean;
};

/** Just the small rocker, for rows and fields that carry their own label. */
export function MiniSwitch({
  checked,
  onCheckedChange,
  ...rest
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}) {
  return (
    <Switch.Root
      className="flex flex-none cursor-pointer rounded-[10px] border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[rgba(var(--ar),.85)]"
      checked={checked}
      onCheckedChange={onCheckedChange}
      nativeButton
      render={<button type="button" />}
      {...rest}
    >
      <span className="rocker" data-size="sm" aria-hidden="true">
        <span className="rocker-glow" />
        <Switch.Thumb className="rocker-cap" />
      </span>
    </Switch.Root>
  );
}

/** Compact switch that sits in a form grid like a text field: label above, a recessed well with a small rocker, hint below. */
export function Toggle({ label, description, checked, onCheckedChange, inline }: ToggleProps) {
  const id = useId();
  if (inline)
    return (
      <div className="flex min-h-[54px] items-center justify-between gap-4">
        <span className="flex min-w-0 flex-col gap-1">
          <span id={id} className="lbl pb-0">
            {label}
          </span>
          {description && <span className="hint">{description}</span>}
        </span>
        <MiniSwitch checked={checked} onCheckedChange={onCheckedChange} aria-labelledby={id} />
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="lbl">
        {label}
      </span>
      <Switch.Root
        className="togglefield well"
        checked={checked}
        onCheckedChange={onCheckedChange}
        nativeButton
        render={<button type="button" />}
        aria-labelledby={id}
      >
        <span>{checked ? 'On' : 'Off'}</span>
        <span className="rocker" data-size="sm" aria-hidden="true">
          <span className="rocker-glow" />
          <Switch.Thumb className="rocker-cap" />
        </span>
      </Switch.Root>
      {description && <span className="hint">{description}</span>}
    </div>
  );
}

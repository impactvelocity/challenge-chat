import { Switch } from '@base-ui/react/switch';

type RockerSwitchProps = {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Full-width switch row with a lit rocker cap. The whole row is the hit target. */
export function RockerSwitch({ label, description, checked, onCheckedChange }: RockerSwitchProps) {
  return (
    <Switch.Root
      className="toggle"
      checked={checked}
      onCheckedChange={onCheckedChange}
      nativeButton
      render={<button type="button" />}
    >
      <span className="flex min-w-0 flex-col">
        <span className="toggle-title">{label}</span>
        {description && <span className="toggle-sub">{description}</span>}
      </span>
      <span className="rocker" aria-hidden="true">
        <span className="rocker-glow" />
        <Switch.Thumb className="rocker-cap" />
      </span>
    </Switch.Root>
  );
}

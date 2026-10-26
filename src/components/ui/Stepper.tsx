import { NumberField } from '@base-ui/react/number-field';

type StepperProps = {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** Drop the visible label (it stays as the input's accessible name), e.g. when a row shows it instead. */
  hideLabel?: boolean;
};

/** Chunky −/+ number stepper in a recessed well. */
export function Stepper({ label, value, onValueChange, min, max, step = 1, unit, hideLabel }: StepperProps) {
  return (
    <NumberField.Root
      value={value}
      onValueChange={(v) => v != null && onValueChange(v)}
      min={min}
      max={max}
      step={step}
      className="flex flex-col gap-2"
    >
      {!hideLabel && (
        <NumberField.ScrubArea className="flex cursor-ew-resize self-start">
          <label className="lbl cursor-ew-resize">{label}</label>
        </NumberField.ScrubArea>
      )}
      <NumberField.Group className="stepper well">
        <NumberField.Decrement className="stepper-btn" aria-label={`Decrease ${label.toLowerCase()}`}>
          −
        </NumberField.Decrement>
        <div className="stepper-num">
          <NumberField.Input aria-label={label} />
          {unit && <small>{unit}</small>}
        </div>
        <NumberField.Increment className="stepper-btn" aria-label={`Increase ${label.toLowerCase()}`}>
          +
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}

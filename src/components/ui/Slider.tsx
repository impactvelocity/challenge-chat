import { Slider as BaseSlider } from '@base-ui/react/slider';
import type { ReactNode } from 'react';

type SliderProps = {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Rendered in the top-right readout. */
  format?: (value: number) => ReactNode;
  ticks?: number;
};

/** Horizontal range with a knurled thumb and lit fill. */
export function Slider({ label, value, onValueChange, min = 0, max = 100, step = 1, format = String, ticks = 9 }: SliderProps) {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={(v) => onValueChange(v as number)}
      min={min}
      max={max}
      step={step}
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between">
        <BaseSlider.Label className="lbl">{label}</BaseSlider.Label>
        <span className="mono glowtext text-[18px] font-semibold">{format(value)}</span>
      </div>
      <BaseSlider.Control className="flex h-[34px] touch-none items-center">
        <BaseSlider.Track className="track w-full">
          <BaseSlider.Indicator className="track-fill" />
          <BaseSlider.Thumb className="thumb" aria-label={label} />
        </BaseSlider.Track>
      </BaseSlider.Control>
      {ticks > 0 && (
        <div className="ticksrow -mt-2" aria-hidden="true">
          {Array.from({ length: ticks }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      )}
    </BaseSlider.Root>
  );
}

/** Vertical mixing-desk fader. */
export function Fader({ label, value, onValueChange }: { label: string; value: number; onValueChange: (value: number) => void }) {
  return (
    <BaseSlider.Root
      value={value}
      onValueChange={(v) => onValueChange(v as number)}
      orientation="vertical"
      className="flex flex-col items-center gap-3"
    >
      <span className="pixel text-[15px] text-ink-strong">{value}</span>
      <BaseSlider.Control className="flex h-[170px] w-[40px] touch-none justify-center">
        <BaseSlider.Track className="vtrack">
          <BaseSlider.Indicator className="vtrack-fill" />
          <BaseSlider.Thumb className="fader-cap" aria-label={label} />
        </BaseSlider.Track>
      </BaseSlider.Control>
      <BaseSlider.Label className="lbl">{label}</BaseSlider.Label>
    </BaseSlider.Root>
  );
}

import type { KeyboardEvent } from 'react';

type KnobProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onValueChange: (value: number) => void;
};

const SWEEP = 270;

/**
 * Rotary control with a lit arc. Click to step up (wraps at max), arrow keys to nudge.
 */
export function Knob({ label, value, min, max, step = 1, unit = '', onValueChange }: KnobProps) {
  const t = (value - min) / (max - min);
  const arc = Math.round(SWEEP * t);
  const deg = Math.round(-SWEEP / 2 + SWEEP * t);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const onKeyDown = (e: KeyboardEvent) => {
    const delta = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step }[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      onValueChange(clamp(value + delta));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onValueChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onValueChange(max);
    }
  };

  return (
    <div className="knobwrap">
      <div className="dial">
        <svg className="dial-ticks" viewBox="0 0 136 136" aria-hidden="true">
          <circle cx="68" cy="68" r="64" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="4" strokeDasharray="1.2 11.78" strokeDashoffset="-194" pathLength="390" transform="rotate(135 68 68)" />
          <circle cx="68" cy="68" r="64" fill="none" stroke="rgba(255,255,255,.42)" strokeWidth="7" strokeDasharray="1.6 128.2" strokeDashoffset="-194" pathLength="390" transform="rotate(135 68 68)" />
        </svg>
        <div
          className="dial-arc"
          aria-hidden="true"
          style={{
            background: `conic-gradient(from 225deg, var(--a-lo) 0deg, var(--a-hi) ${arc}deg, rgba(255,255,255,.06) ${arc}deg, rgba(255,255,255,.06) ${SWEEP}deg, transparent ${SWEEP}deg)`,
          }}
        />
        <div className="dial-rim" aria-hidden="true" />
        <button
          type="button"
          className="knob"
          onClick={() => onValueChange(value + step > max ? min : value + step)}
          onKeyDown={onKeyDown}
          aria-label={`${label} ${value}${unit}, click to increase or use the arrow keys`}
        >
          <span className="knob-cap" aria-hidden="true" />
          <span className="knob-ind" style={{ transform: `rotate(${deg}deg)` }} />
        </button>
      </div>
      <div className="kval" aria-hidden="true">
        {value}
        <small>{unit}</small>
      </div>
      <div className="lbl text-center">{label}</div>
    </div>
  );
}

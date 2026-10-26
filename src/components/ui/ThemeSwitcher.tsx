import type { CSSProperties } from 'react';
import { ACCENT_PRESETS, lighten } from '@/theme/accent';
import { useTheme } from '@/theme/ThemeProvider';
import { ColorPopover } from './ColorPopover';

/** Accent swatches + a custom colour wheel (`custom={false}` hides it). Re-themes the whole app live. */
export function ThemeSwitcher({
  size = 26,
  readout = 'hex',
  custom = true,
  value,
  onChange,
}: {
  size?: number;
  readout?: 'hex' | 'name' | false;
  custom?: boolean;
  value?: string;
  onChange?: (hex: string) => void;
}) {
  const theme = useTheme();
  const hex = value ?? theme.hex;
  const selectedPreset = ACCENT_PRESETS.findIndex((preset) => preset.hex.toLowerCase() === hex.toLowerCase());
  const setPreset = (index: number) => onChange ? onChange(ACCENT_PRESETS[index].hex) : theme.setPreset(index);
  const setCustom = (next: string) => onChange ? onChange(next) : theme.setCustom(next);
  const vars = { '--sw-size': `${size}px` } as CSSProperties;

  return (
    <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Accent theme">
      {ACCENT_PRESETS.map((p, i) => {
        const on = selectedPreset === i;
        return (
          <button
            key={p.name}
            type="button"
            className="sw"
            data-on={on || undefined}
            style={{ ...vars, background: `linear-gradient(180deg, ${lighten(p.hex, 0.28)}, ${p.hex})` }}
            onClick={() => setPreset(i)}
            aria-label={`${p.name} theme`}
            aria-pressed={on}
          />
        );
      })}
      {custom && (
        <ColorPopover value={hex} onChange={setCustom} aria-label="Pick a custom accent colour">
          <button type="button" className="sw sw-picker" data-on={selectedPreset < 0 ? true : undefined} style={vars} title="Custom colour" />
        </ColorPopover>
      )}
      {readout && (
        <span className="mono ml-1 text-[11px] tracking-[.08em] text-ink-label" style={{ minWidth: readout === 'name' ? 150 : 62 }}>
          {readout === 'name' ? `${selectedPreset >= 0 ? ACCENT_PRESETS[selectedPreset].name : 'Custom'} · ${hex.toUpperCase()}` : hex.toUpperCase()}
        </span>
      )}
    </div>
  );
}

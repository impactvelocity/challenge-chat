import type { CSSProperties } from 'react';
import { ACCENT_PRESETS, lighten } from '@/theme/accent';
import { useTheme } from '@/theme/ThemeProvider';
import { ColorPopover } from './ColorPopover';

/** Accent swatches + a custom colour wheel (`custom={false}` hides it). Re-themes the whole app live. */
export function ThemeSwitcher({ size = 26, readout = 'hex', custom = true }: { size?: number; readout?: 'hex' | 'name' | false; custom?: boolean }) {
  const theme = useTheme();
  const vars = { '--sw-size': `${size}px` } as CSSProperties;

  return (
    <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Accent theme">
      {ACCENT_PRESETS.map((p, i) => {
        const on = !theme.custom && theme.preset === i;
        return (
          <button
            key={p.name}
            type="button"
            className="sw"
            data-on={on || undefined}
            style={{ ...vars, background: `linear-gradient(180deg, ${lighten(p.hex, 0.28)}, ${p.hex})` }}
            onClick={() => theme.setPreset(i)}
            aria-label={`${p.name} theme`}
            aria-pressed={on}
          />
        );
      })}
      {custom && (
        <ColorPopover value={theme.hex} onChange={theme.setCustom} aria-label="Pick a custom accent colour">
          <button type="button" className="sw sw-picker" data-on={theme.custom ? true : undefined} style={vars} title="Custom colour" />
        </ColorPopover>
      )}
      {readout && (
        <span className="mono ml-1 text-[11px] tracking-[.08em] text-ink-label" style={{ minWidth: readout === 'name' ? 150 : 62 }}>
          {readout === 'name' ? `${theme.name} · ${theme.hex.toUpperCase()}` : theme.hex.toUpperCase()}
        </span>
      )}
    </div>
  );
}

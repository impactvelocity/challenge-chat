import type { ReactNode } from 'react';
import { Button, ColorPopover, Label, MiniSwitch, SegmentedControl, Select, Slider, TextField } from '@/components/ui';
import type { SettingDef, SettingsSchema } from '@/overlay/sdk';
import { lighten } from '@/theme/accent';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  schema: SettingsSchema;
  /** Resolved values (see `resolveSettings`), so every key has one. */
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
};

/**
 * A form for any theme's settings, built from its schema with the app's own controls. Grouped by
 * each setting's `group`, in the order the theme declares them.
 */
export function ThemeSettingsForm({ schema, values, onChange }: Props) {
  const groups = new Map<string, [string, SettingDef][]>();
  for (const entry of Object.entries(schema)) {
    const g = entry[1].group ?? 'Settings';
    groups.set(g, [...(groups.get(g) ?? []), entry]);
  }
  return (
    <div className="flex flex-col gap-6">
      {[...groups].map(([group, list]) => (
        <section key={group} className="flex flex-col gap-3" aria-label={group}>
          <Label>{group}</Label>
          {list.map(([key, def]) => (
            <Field key={key} def={def} value={values[key]} onChange={(v) => onChange(key, v)} />
          ))}
        </section>
      ))}
    </div>
  );
}

function Field({ def, value, onChange }: { def: SettingDef; value: unknown; onChange: (v: unknown) => void }) {
  switch (def.type) {
    case 'boolean':
      return (
        <Row label={def.label} hint={def.description}>
          <MiniSwitch checked={value as boolean} onCheckedChange={onChange} aria-label={def.label} />
        </Row>
      );
    case 'number':
      return (
        <Slider
          label={def.label}
          value={value as number}
          onValueChange={onChange}
          min={def.min}
          max={def.max}
          step={def.step ?? 1}
          ticks={0}
          format={(v) => `${v}${def.unit ?? ''}`}
        />
      );
    case 'select':
      return (
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold text-ink-soft">{def.label}</span>
          {def.options.length <= 3 ? (
            <SegmentedControl fill aria-label={def.label} options={[...def.options]} value={value as string} onValueChange={onChange} />
          ) : (
            <Select options={[...def.options]} value={value as string} onValueChange={onChange} size="sm" aria-label={def.label} />
          )}
          {def.description && <span className="hint">{def.description}</span>}
        </div>
      );
    case 'color':
      return <ColorField label={def.label} hint={def.description} value={value as string | null} onChange={onChange} />;
    case 'text':
      return <TextField label={def.label} value={value as string} maxLength={def.maxLength} placeholder={def.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}

function ColorField({ label, hint, value, onChange }: { label: string; hint?: string; value: string | null; onChange: (v: string | null) => void }) {
  const { hex } = useTheme();
  return (
    <Row label={label} hint={value ? undefined : hint}>
      {value && (
        <Button size="xs" variant="ghost" onClick={() => onChange(null)}>
          Reset
        </Button>
      )}
      <ColorPopover value={value ?? hex} onChange={onChange} aria-label={`Pick ${label.toLowerCase()}`}>
        <button
          type="button"
          className="sw"
          title={value ? value.toUpperCase() : 'Following the board'}
          style={{
            background: value ? `linear-gradient(180deg, ${lighten(value, 0.28)}, ${value})` : 'repeating-linear-gradient(135deg, #4a4d52 0 4px, #2a2c30 4px 8px)',
          }}
        />
      </ColorPopover>
    </Row>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[38px] items-center gap-3">
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-ink-soft">{label}</span>
        {hint && <span className="hint text-[12px]">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

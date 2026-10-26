import { Switch } from '@base-ui/react/switch';
import { Link, useLocation } from 'react-router';
import { Divider, Label, Sheet, Tooltip } from '@/components/ui';
import { hydrateOverlayConfig, useOverlayConfig, useOverlayDisplay } from '@/data/overlayConfig';
import { getTheme, type ElementDef } from '@/overlay/sdk';
import { api } from '@/api';
import { usePendingAction } from '@/framework/use-pending-action';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Live on/off switches for the active theme's overlay elements. Changes reach the overlay straight away.
 * Ungrouped elements first, then each of the theme's groups under its name.
 */
export function OverlayElementsSheet({ open, onOpenChange }: Props) {
  const display = useOverlayDisplay();
  const config = useOverlayConfig();
  const save = usePendingAction();
  const { search } = useLocation();
  const theme = getTheme(display.theme);
  if (!theme) return null;

  const groups = new Map<string, [string, ElementDef][]>();
  for (const entry of Object.entries(theme.elements)) {
    const g = entry[1].group ?? '';
    groups.set(g, [...(groups.get(g) ?? []), entry]);
  }
  const ordered = [...groups].sort(([a], [b]) => Number(!!a) - Number(!!b));

  const row = ([id, e]: [string, ElementDef]) => (
    // What each element does opens beside the drawer, so the rows stay one line
    <Tooltip key={id} side="left" content={e.description ?? e.label}>
      <Switch.Root className="elemrow well" disabled={save.busy} aria-busy={save.pendingAction === id} checked={!!display.elements[id]} onCheckedChange={(on) => void save.run(async () => {
        const { config: saved } = await api.updateOverlayConfig({ ...config, elements: { ...config.elements, [id]: on } });
        hydrateOverlayConfig(saved);
      }, id)} nativeButton render={<button type="button" />}>
        <span className="min-w-0 flex-1 truncate text-[15px] leading-tight font-semibold text-ink-strong">{e.label}</span>
        <span className="rocker" data-size="sm" aria-hidden="true">
          <span className="rocker-glow" />
          <Switch.Thumb className="rocker-cap" />
        </span>
      </Switch.Root>
    </Tooltip>
  );

  return (
    <Sheet open={open} busy={save.busy} onOpenChange={onOpenChange} title="Overlay Elements">
      {save.busy && <p role="status" className="hint">Updating overlay…</p>}
      {save.notice && <p role="alert" className="text-sm text-red-300">{save.notice}</p>}
      {ordered.map(([group, list], i) => (
        <div key={group}>
          {i > 0 && (
            <div className="my-5">
              <Divider />
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {group && <Label className="px-1 pb-1">{group}</Label>}
            {list.map(row)}
          </div>
        </div>
      ))}
      <p className="hint mt-6 mb-0 px-1">
        From the {theme.name} theme.{' '}
        <Link to={{ pathname: '/settings/theme', search }} onClick={() => onOpenChange(false)} className="text-ink-soft underline-offset-2 hover:text-ink-strong hover:underline">
          Change it in Settings
        </Link>
      </p>
    </Sheet>
  );
}

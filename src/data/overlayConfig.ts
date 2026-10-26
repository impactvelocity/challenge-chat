import { useMemo, useSyncExternalStore } from 'react';
import type { OverlayConfig } from '../../shared/surface-config';
import { DEFAULT_OVERLAY_CONFIG } from '../../shared/surface-config';
import { api } from '@/api';
import { getTheme, listThemes, type Display } from '@/overlay/sdk';
import '@/overlay/themes';

export type { OverlayConfig } from '../../shared/surface-config';

const listeners = new Set<() => void>();
let current: OverlayConfig = DEFAULT_OVERLAY_CONFIG;

function publish(next: OverlayConfig) {
  current = next;
  for (const listener of listeners) listener();
}

/** Align the compatibility store with the authoritative admin projection. */
export function hydrateOverlayConfig(config: OverlayConfig) {
  if (JSON.stringify(config) !== JSON.stringify(current)) publish(config);
}

function persist(next: OverlayConfig) {
  publish(next);
  void api.updateOverlayConfig(next).then(({ config }) => publish(config)).catch(() => undefined);
}

export const setOverlayTheme = (theme: string) => persist({ ...current, theme });

export const setThemeSettings = (theme: string, patch: Record<string, unknown> | null) => {
  const safe = Object.fromEntries(Object.entries(patch ?? {}).filter(([, value]) =>
    value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)),
  )) as Record<string, string | number | boolean | null>;
  persist({ ...current, settings: { ...current.settings, [theme]: patch ? { ...current.settings[theme], ...safe } : {} } });
};

export const setOverlayElement = (id: string, on: boolean) => persist({ ...current, elements: { ...current.elements, [id]: on } });

export function useOverlayConfig() {
  return useSyncExternalStore(
    (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    () => current,
  );
}

export function displayOf(config: OverlayConfig): Display {
  const theme = getTheme(config.theme) ?? listThemes()[0];
  if (!theme) return { theme: '', settings: {}, elements: {} };
  return {
    theme: theme.id,
    settings: config.settings[theme.id] ?? {},
    elements: Object.fromEntries(Object.entries(theme.elements).map(([id, element]) => [id, config.elements[id] ?? !!element.on])),
  };
}

export function useOverlayDisplay(): Display {
  const config = useOverlayConfig();
  return useMemo(() => displayOf(config), [config]);
}

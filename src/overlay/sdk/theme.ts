import { createContext, useContext, useSyncExternalStore, type ComponentType } from 'react';
import type { Scene } from './types';

/* ───────────────────────── Settings ───────────────────────── */

type SettingBase = {
  label: string;
  description?: string;
  /** Settings sharing a group are shown together under its name. */
  group?: string;
};

/**
 * One knob a theme exposes. The control room builds its form from these, and values arrive in the
 * snapshot's `display.settings`, checked against the schema before the theme sees them.
 */
export type SettingDef =
  | (SettingBase & { type: 'boolean'; default: boolean })
  | (SettingBase & { type: 'number'; default: number; min: number; max: number; step?: number; unit?: string })
  | (SettingBase & { type: 'select'; default: string; options: readonly { value: string; label: string }[] })
  /** `null` follows the board's own colours. */
  | (SettingBase & { type: 'color'; default: string | null })
  | (SettingBase & { type: 'text'; default: string; placeholder?: string; maxLength?: number });

export type SettingsSchema = Record<string, SettingDef>;

export type SettingValue<D extends SettingDef> = D extends { type: 'boolean' }
  ? boolean
  : D extends { type: 'number' }
    ? number
    : D extends { type: 'select'; options: readonly { value: infer V }[] }
      ? V
      : D extends { type: 'color' }
        ? string | null
        : string;

export type SettingsOf<S extends SettingsSchema> = { -readonly [K in keyof S]: SettingValue<S[K]> };

const HEX = /^#[0-9a-f]{6}$/i;

/** Fills gaps with defaults and drops anything out of range, so a theme can trust its settings. */
export function resolveSettings<S extends SettingsSchema>(schema: S, raw: Record<string, unknown> = {}): SettingsOf<S> {
  const out: Record<string, unknown> = {};
  for (const [key, d] of Object.entries(schema)) {
    const v = raw[key];
    switch (d.type) {
      case 'boolean':
        out[key] = typeof v === 'boolean' ? v : d.default;
        break;
      case 'number':
        out[key] = typeof v === 'number' && Number.isFinite(v) ? Math.min(d.max, Math.max(d.min, v)) : d.default;
        break;
      case 'select':
        out[key] = d.options.some((o) => o.value === v) ? v : d.default;
        break;
      case 'color':
        out[key] = v === null || (typeof v === 'string' && HEX.test(v)) ? v : d.default;
        break;
      case 'text':
        out[key] = typeof v === 'string' ? v.slice(0, d.maxLength ?? 200) : d.default;
        break;
    }
  }
  return out as SettingsOf<S>;
}

/* ───────────────────────── Themes ───────────────────────── */

/** A piece of the overlay the control room can switch on and off. */
export type ElementDef = {
  label: string;
  description?: string;
  /** Where it sits. Regions are the theme's own: its Layout decides what each one means. */
  region: string;
  /** On until the control room says otherwise. */
  on?: boolean;
  /** Elements sharing a group are listed together under its name in the control room. */
  group?: string;
  Component: ComponentType;
};

export type ThemeDef<S extends SettingsSchema> = {
  id: string;
  name: string;
  description?: string;
  settings: S;
  /** Lays out the whole 1920×1080 canvas, placing <SceneOutlet /> and <ElementOutlet /> where it likes. */
  Layout: ComponentType;
  /** What to show for each scene. A scene without one shows nothing. */
  scenes: Partial<Record<Scene, ComponentType>>;
  elements: Record<string, ElementDef>;
};

export type OverlayTheme<S extends SettingsSchema = SettingsSchema> = ThemeDef<S> & {
  /** This theme's settings, typed, for its own components. */
  useSettings: () => SettingsOf<S>;
};

export type ThemeContextValue = {
  theme: OverlayTheme;
  settings: Record<string, unknown>;
  /** Every element id the theme has, on or off. */
  elements: Record<string, boolean>;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useThemeContext() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('Theme hooks must be used inside <OverlayRenderer>');
  return ctx;
}

/**
 * Declare a theme. Settings types are inferred from the schema, so `theme.useSettings()` is fully typed:
 *
 *   export const neon = defineTheme({ id: 'neon', settings: { glow: { type: 'number', … } }, … });
 *   const { glow } = neon.useSettings();
 */
export function defineTheme<const S extends SettingsSchema>(def: ThemeDef<S>): OverlayTheme<S> {
  return { ...def, useSettings: () => useThemeContext().settings as SettingsOf<S> };
}

/**
 * A new theme built on another: add settings, swap any scene, element or the layout, keep the rest.
 * The base's components keep working; they read their own settings from the merged set.
 */
export function extendTheme<B extends SettingsSchema, const S extends SettingsSchema = Record<never, SettingDef>>(
  base: OverlayTheme<B>,
  def: Partial<ThemeDef<S>> & { id: string; name: string },
): OverlayTheme<B & S> {
  return defineTheme<B & S>({
    ...base,
    ...def,
    settings: { ...base.settings, ...def.settings } as B & S,
    Layout: def.Layout ?? base.Layout,
    scenes: { ...base.scenes, ...def.scenes },
    elements: { ...base.elements, ...def.elements },
  });
}

export const defaultElements = (theme: OverlayTheme) => Object.fromEntries(Object.entries(theme.elements).map(([id, e]) => [id, !!e.on]));

/* ───────────────────────── Registry ───────────────────────── */

const registry = new Map<string, OverlayTheme>();
const listeners = new Set<() => void>();
let list: OverlayTheme[] = [];

/** Make a theme available by id. Registering an id again replaces it (handy with hot reload). */
export function registerTheme(theme: OverlayTheme<never> | OverlayTheme) {
  registry.set(theme.id, theme as OverlayTheme);
  list = [...registry.values()];
  for (const l of listeners) l();
}

export function unregisterTheme(id: string) {
  if (!registry.delete(id)) return;
  list = [...registry.values()];
  for (const l of listeners) l();
}

export const getTheme = (id: string): OverlayTheme | undefined => registry.get(id);
export const listThemes = () => list;

/** Registered themes, in the order they were added. Updates when one is registered. */
export function useThemes() {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => list,
  );
}

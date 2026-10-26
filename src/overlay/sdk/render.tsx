import { Fragment, useMemo, type ComponentType, type ReactNode } from 'react';
import { useDisplay } from './hooks';
import { useOverlay } from './provider';
import { defaultElements, getTheme, resolveSettings, ThemeContext, useThemeContext, useThemes } from './theme';

type RendererProps = {
  /** Theme id. Defaults to the one the snapshot's display config picks, then the first registered. */
  theme?: string;
  /** Override the snapshot's settings, e.g. for a live preview while editing. */
  settings?: Record<string, unknown>;
  /** Override which elements are on. */
  elements?: Record<string, boolean>;
};

/** Renders the overlay in the chosen theme. Put it inside <OverlayProvider>. */
export function OverlayRenderer({ theme: id, settings, elements }: RendererProps) {
  const display = useDisplay();
  const themes = useThemes();
  const theme = getTheme(id ?? display.theme) ?? themes[0];
  const raw = settings ?? display.settings;
  const on = elements ?? display.elements;
  const value = useMemo(
    () => theme && { theme, settings: resolveSettings(theme.settings, raw), elements: { ...defaultElements(theme), ...on } },
    [theme, raw, on],
  );
  if (!value) return null;
  return (
    <ThemeContext.Provider value={value}>
      <value.theme.Layout />
    </ThemeContext.Provider>
  );
}

/** Changes whenever a scene should play its entrance again: a new stage, each new challenge, each call. */
export function useSceneKey() {
  return useOverlay((s) => {
    const r = s.snapshot.session?.round;
    if (s.round.scene === 'result') return `result-${r?.index}-${r?.call?.winner}`;
    if (s.round.scene === 'live') return `live-${r?.index}`;
    return s.round.scene;
  });
}

/** The current scene, from the theme's `scenes`. Re-mounted per `useSceneKey` so it can animate in. */
export function SceneOutlet() {
  const { theme } = useThemeContext();
  const scene = useOverlay((s) => s.round.scene);
  const key = useSceneKey();
  const Scene = theme.scenes[scene];
  return Scene ? <Scene key={key} /> : null;
}

export type PlacedElement = { id: string; on: boolean; label: string; Component: ComponentType };

/**
 * The theme's elements for one region, each handed to `children` with whether it's on. Off elements
 * are still passed so they can animate out.
 */
export function ElementOutlet({ region, children }: { region: string; children: (el: PlacedElement) => ReactNode }) {
  const { theme, elements } = useThemeContext();
  return Object.entries(theme.elements)
    .filter(([, e]) => e.region === region)
    .map(([id, e]) => <Fragment key={id}>{children({ id, on: elements[id], label: e.label, Component: e.Component })}</Fragment>);
}

export function useElementOn(id: string) {
  return !!useThemeContext().elements[id];
}

/** Untyped settings for whichever theme is rendering. Theme code should prefer its own `theme.useSettings()`. */
export function useThemeSettings() {
  return useThemeContext().settings;
}

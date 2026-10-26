import { DEFAULT_CONTROL_THEME, type Theme } from "../../shared/contracts";

export function resolveControlTheme(theme: Theme) {
  return theme.control ?? DEFAULT_CONTROL_THEME;
}

export function controlThemeVariables(theme: Theme): React.CSSProperties {
  const control = resolveControlTheme(theme);
  const radii = { square: "0px", soft: "8px", round: "18px" } as const;
  return {
    "--primary": theme.primary,
    "--accent": theme.accent,
    "--success": theme.success,
    "--failure": theme.failure,
    "--control-background": control.background,
    "--control-panel": control.panel,
    "--control-panel-elevated": control.panelElevated,
    "--control-text": control.text,
    "--control-muted": control.muted,
    "--control-border": control.border,
    "--control-radius": radii[control.radius],
  } as React.CSSProperties;
}

export function overlayThemeVariables(theme: Theme): React.CSSProperties {
  return {
    "--primary": theme.primary,
    "--accent": theme.accent,
    "--success": theme.success,
    "--failure": theme.failure,
  } as React.CSSProperties;
}

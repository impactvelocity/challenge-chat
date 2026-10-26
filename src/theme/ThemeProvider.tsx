import { createContext, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ACCENT_PRESETS, accentVars, complement } from './accent';

/** `chat` is a picked chat colour; null follows the primary (its opposite hue). */
type ThemeState = { preset: number; custom: string | null; chat: string | null };

type ThemeContextValue = ThemeState & {
  hex: string;
  name: string;
  chatHex: string;
  setPreset: (index: number) => void;
  setCustom: (hex: string) => void;
  setChat: (hex: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'challenge-chat:accent';

function readStored(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { preset: 0, custom: null, chat: null, ...JSON.parse(raw) };
  } catch {
    // storage unavailable — fall back to the default accent
  }
  return { preset: 0, custom: null, chat: null };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(readStored);
  const hex = state.custom ?? ACCENT_PRESETS[state.preset].hex;

  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(accentVars(hex))) root.style.setProperty(key, value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [hex, state]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...state,
      hex,
      name: state.custom ? 'Custom' : ACCENT_PRESETS[state.preset].name,
      chatHex: state.chat ?? complement(hex),
      setPreset: (preset) => setState((s) => ({ ...s, preset, custom: null })),
      setCustom: (custom) => setState((s) => ({ ...s, custom })),
      setChat: (chat) => setState((s) => ({ ...s, chat })),
    }),
    [state, hex],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

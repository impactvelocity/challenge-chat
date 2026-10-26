import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
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
  applyBoard: (primary: string, accent: string) => void;
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
  }, [hex]);

  // Colour dragging should update the UI immediately without writing localStorage for every pointer move.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // ignore
      }
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [state]);

  const setPreset = useCallback((preset: number) => setState((current) => (
    current.preset === preset && current.custom === null ? current : { ...current, preset, custom: null }
  )), []);
  const setCustom = useCallback((custom: string) => setState((current) => (
    current.custom === custom ? current : { ...current, custom }
  )), []);
  const setChat = useCallback((chat: string | null) => setState((current) => (
    current.chat === chat ? current : { ...current, chat }
  )), []);
  const applyBoard = useCallback((primary: string, accent: string) => {
    const preset = ACCENT_PRESETS.findIndex((entry) => entry.hex.toLowerCase() === primary.toLowerCase());
    const chat = accent.toLowerCase() === complement(primary).toLowerCase() ? null : accent;
    setState((current) => {
      const next = preset >= 0
        ? { preset, custom: null, chat }
        : { preset: current.preset, custom: primary, chat };
      return current.preset === next.preset && current.custom === next.custom && current.chat === next.chat ? current : next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...state,
      hex,
      name: state.custom ? 'Custom' : ACCENT_PRESETS[state.preset].name,
      chatHex: state.chat ?? complement(hex),
      setPreset,
      setCustom,
      setChat,
      applyBoard,
    }),
    [applyBoard, hex, setChat, setCustom, setPreset, state],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

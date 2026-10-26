import { useEffect, useMemo } from 'react';
import { accentVars } from './accent';
import { useTheme } from './ThemeProvider';

/**
 * Chat's colour (the accent's complement unless picked in Settings → General), exposed as --c, --c-hi, … --cr.
 * Set on the root so drawers, dialogs and tooltips (portalled to <body>) can use it too.
 */
export function useChatVars() {
  const { chatHex } = useTheme();
  const vars = useMemo(() => Object.fromEntries(Object.entries(accentVars(chatHex)).map(([k, v]) => [k.replace('--a', '--c'), v])), [chatHex]);
  useEffect(() => {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) root.removeProperty(k);
    };
  }, [vars]);
}

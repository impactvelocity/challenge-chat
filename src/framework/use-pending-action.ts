import { useCallback, useRef, useState } from 'react';

/** A synchronous lock closes the gap before React paints the disabled control. */
export function usePendingAction() {
  const locked = useRef(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const run = useCallback(async (task: () => Promise<unknown>, name = 'update') => {
    if (locked.current) return false;
    locked.current = true;
    setPendingAction(name);
    setNotice(null);
    try {
      await task();
      return true;
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : 'Action failed');
      return false;
    } finally {
      locked.current = false;
      setPendingAction(null);
    }
  }, []);
  return { pendingAction, busy: pendingAction !== null, notice, dismissNotice: () => setNotice(null), run };
}

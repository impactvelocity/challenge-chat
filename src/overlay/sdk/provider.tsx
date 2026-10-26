import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { OverlayStore, type OverlayState } from './store';
import type { OverlaySnapshot, OverlaySource } from './types';

const StoreContext = createContext<OverlayStore | null>(null);

type ProviderProps = {
  /** Where state comes from: the live connection, or `createMockSource()`. */
  source?: OverlaySource;
  /** Bring your own store, e.g. to share one between two trees. */
  store?: OverlayStore;
  /** State to render before the source says anything (a server-rendered snapshot, a still). */
  initial?: OverlaySnapshot;
  /** Shown until the first snapshot. Nothing by default, which is right for a browser source. */
  fallback?: ReactNode;
  children: ReactNode;
};

/** Feeds every overlay hook below it. */
export function OverlayProvider({ source, store: given, initial, fallback = null, children }: ProviderProps) {
  const [own] = useState(() => given ?? new OverlayStore(initial));
  const store = given ?? own;
  useEffect(() => (source ? store.connect(source) : undefined), [store, source]);
  const ready = useSyncExternalStore(store.subscribe, () => store.get().ready);
  return <StoreContext.Provider value={store}>{ready ? children : fallback}</StoreContext.Provider>;
}

export function useOverlayStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('Overlay hooks must be used inside <OverlayProvider>');
  return store;
}

export type Selection = OverlayState & { now: number };

export function shallowEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * The hook every other hook is built on: picks what it needs from the overlay state and re-renders only
 * when that changes (shallowly). `time: true` also re-checks it on the shared clock, for countdowns.
 */
export function useOverlay<T>(select: (s: Selection) => T, { time = false, equal = shallowEqual }: { time?: boolean; equal?: (a: T, b: T) => boolean } = {}): T {
  const store = useOverlayStore();
  const last = useRef<{ value: T } | null>(null);
  const subscribe = useCallback(
    (l: () => void) => {
      const off = store.subscribe(l);
      const offTime = time ? store.subscribeTime(l) : undefined;
      return () => {
        off();
        offTime?.();
      };
    },
    [store, time],
  );
  const read = () => {
    const next = select({ ...store.get(), now: store.now() });
    if (last.current && equal(last.current.value, next)) return last.current.value;
    last.current = { value: next };
    return next;
  };
  return useSyncExternalStore(subscribe, read, read);
}

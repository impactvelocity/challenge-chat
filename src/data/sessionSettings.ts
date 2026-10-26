import { useSyncExternalStore } from 'react';
import type { SessionSettings } from '../../shared/surface-config';
import { DEFAULT_SESSION_SETTINGS } from '../../shared/surface-config';
import { api } from '@/api';

export type { SessionSettings } from '../../shared/surface-config';

const listeners = new Set<() => void>();
let current: SessionSettings = DEFAULT_SESSION_SETTINGS;

function publish(next: SessionSettings) {
  current = next;
  for (const listener of listeners) listener();
}

export function hydrateSessionSettings(settings: SessionSettings) {
  if (JSON.stringify(settings) !== JSON.stringify(current)) publish(settings);
}

export function setSessionSettings(next: Partial<SessionSettings>) {
  const settings = { ...current, ...next };
  publish(settings);
  void api.updateSessionSettings(settings).then(({ settings: saved }) => publish(saved)).catch(() => undefined);
}

export function useSessionSettings() {
  return useSyncExternalStore(
    (listener) => (listeners.add(listener), () => void listeners.delete(listener)),
    () => current,
  );
}

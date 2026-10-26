import { createContext, useContext, type ReactNode } from 'react';
import type { Channel, Role } from '@/model';

const Context = createContext<{ channels: Channel[]; role: Role; displayName: string | null }>({ channels: [], role: 'mod', displayName: null });

export function AppShellContext({ channels, role, displayName, children }: { channels: Channel[]; role: Role; displayName: string | null; children: ReactNode }) {
  return <Context.Provider value={{ channels, role, displayName }}>{children}</Context.Provider>;
}

export function useChannel(id?: string) {
  return useContext(Context).channels.find((channel) => channel.id === id) ?? useContext(Context).channels[0];
}

export function useRole() {
  return useContext(Context).role;
}

export function useDisplayName() {
  return useContext(Context).displayName;
}

export function AppPage({ children }: { children: ReactNode }) {
  return <main className="page-bg min-h-screen px-4 py-6 text-ink sm:px-8">{children}</main>;
}

export function TopBar({ channel }: { channel: Channel }) {
  return <div className="mx-auto mb-6 max-w-[1120px] text-sm text-ink-muted">{channel.displayName}</div>;
}

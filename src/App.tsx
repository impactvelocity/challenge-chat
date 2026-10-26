import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { Logo } from '@/components/Logo';
import { Button, Panel, TextField, ToastProvider, Toasts } from '@/components/ui';
import { api, type AuthSession } from '@/api';
import { selectedChannelId, channelPath } from '@/framework/channel';
import { creatorEntry } from '@/framework/creator-entry';
import { BoardWebMcp } from '@/framework/webmcp';
import { hydrateOverlayConfig } from '@/data/overlayConfig';
import { hydrateSessionSettings } from '@/data/sessionSettings';
import { OverlayProvider, OverlayRenderer } from '@/overlay/sdk';
import { createLiveSource } from '@/overlay/sources/live';
import '@/overlay/themes';
import { ControlMain } from '@/pages/main/ControlMain';
import { OverlayPage } from '@/pages/main/OverlayPage';
import { PublicChannel } from '@/pages/main/PublicChannel';
import { SetupPage } from '@/pages/main/SetupPage';
import { UiPage } from '@/pages/main/UiPage';
import { AppShellContext, useRole } from '@/pages/app/shell-context';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { Channel } from '@/model';

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider timeout={4000}>
        <BrowserRouter>
          <Routes>
            <Route path="/overlay" element={<LiveOverlay />} />
            <Route path="/c/:channelId" element={<PublicChannel />} />
            <Route path="/invite" element={<MagicInvite />} />
            <Route element={<AuthenticatedLayout />}>
              <Route path="/" element={<ControlMain />} />
              <Route path="/inbox" element={<ControlMain />} />
              <Route path="/settings/:tab?" element={<ControlMain />} />
              <Route path="/setup" element={<SetupPage />} />
              <Route path="/overlay/studio" element={<StudioRoute />} />
              <Route path="/ui" element={<UiPage />} />
              <Route path="/overlay-demo" element={<RedirectWithSearch to="/overlay/studio" />} />
              <Route path="/theme" element={<RedirectWithSearch to="/settings/theme" />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toasts />
      </ToastProvider>
    </ThemeProvider>
  );
}

function LiveOverlay() {
  const [source] = useState(createLiveSource);
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const before = [root.style.background, body.style.background];
    root.style.background = 'transparent';
    body.style.background = 'transparent';
    return () => {
      root.style.background = before[0];
      body.style.background = before[1];
    };
  }, []);
  return <div className="fixed inset-0 overflow-hidden bg-transparent"><OverlayProvider source={source}><OverlayRenderer /></OverlayProvider></div>;
}

function AuthenticatedLayout() {
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [boardSetupRequired, setBoardSetupRequired] = useState<boolean | null>(null);
  const location = useLocation();

  const refresh = async () => {
    const next = await api.authSession();
    setAuth(next);
    if (!next.authenticated) return;
    const { channels: available } = await api.channels();
    const entry = creatorEntry(available, window.location);
    if (entry.redirectTo) {
      window.location.replace(entry.redirectTo);
      return;
    }
    const state = await api.state();
    setBoardSetupRequired(entry.setupRequired);
    hydrateOverlayConfig(state.overlayConfig);
    hydrateSessionSettings(state.sessionSettings);
    setChannels(available.filter((channel) => channel.setupComplete).map((channel) => ({
      id: channel.id,
      displayName: channel.displayName,
      slug: channel.slug,
      broadcasterLogin: channel.slug,
      setupComplete: channel.setupComplete,
      live: false,
      review: 0,
      ready: 0,
      mods: 0,
      score: { streamer: 0, chat: 0 },
      lastActive: 'Available',
      assignedToMod: true,
    })));
  };

  useEffect(() => { void refresh().catch((caught) => setError(caught instanceof Error ? caught.message : 'Could not check access')); }, []);
  if (error) return <StatusPage title="Signal lost">{error}</StatusPage>;
  if (!auth) return <StatusPage title="Checking access">Connecting…</StatusPage>;
  if (!auth.authenticated) return <AuthEntry auth={auth} onAuthenticated={refresh} />;
  if (boardSetupRequired === null) return <StatusPage title="Loading your boards">Connecting…</StatusPage>;
  if (boardSetupRequired && location.pathname !== '/setup') return <Navigate to={channelPath('/setup', selectedChannelId())} replace />;
  return (
    <AppShellContext channels={channels} role={auth.role ?? 'mod'} displayName={auth.displayName}>
      <BoardWebMcp enabled={auth.role === 'owner'} channelId={selectedChannelId()} />
      <Outlet />
    </AppShellContext>
  );
}

function AuthEntry({ auth, onAuthenticated }: { auth: AuthSession; onAuthenticated: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [controlRoomName, setControlRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (auth.setup === 'ready' && password !== confirmation) return setError('Passwords do not match');
    setBusy(true);
    setError(null);
    try {
      const firstRun = auth.setup === 'ready';
      if (firstRun) await api.setupOwner(password, controlRoomName);
      else await api.login(password);
      await onAuthenticated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="page-bg grid min-h-screen place-items-center px-4 text-ink">
      <Panel as="form" onSubmit={submit} className="settings-form flex w-full max-w-[460px] flex-col gap-5 p-7 sm:p-9">
        <Logo size={32} />
        <div>
          <h1 className="m-0 text-[28px] text-ink-strong">{auth.setup === 'ready' ? 'Create your control room' : auth.controlRoomName}</h1>
          <p className="mb-0 text-sm leading-relaxed text-ink-sub">
            {auth.setup === 'ready'
              ? 'Name your control room and secure your scoreboard with an owner password.'
              : 'Sign in as the owner. Moderators use their one-time invite link.'}
          </p>
        </div>
        {auth.setup === 'ready' && <TextField label="Control room name" value={controlRoomName} maxLength={60} placeholder="Friday Night Control Room" onChange={(event) => setControlRoomName(event.target.value)} required />}
        <TextField label={auth.setup === 'ready' ? 'New owner password' : 'Owner password'} type="password" value={password} minLength={auth.setup === 'ready' ? 6 : undefined} onChange={(event) => setPassword(event.target.value)} required />
        {auth.setup === 'ready' && <TextField label="Confirm password" type="password" value={confirmation} minLength={6} onChange={(event) => setConfirmation(event.target.value)} required />}
        {error && <p className="m-0 text-sm text-red-300" role="alert">{error}</p>}
        <Button type="submit" variant="accent" disabled={busy}>{busy ? 'Connecting…' : auth.setup === 'ready' ? 'Create control room' : 'Sign in'}</Button>
      </Panel>
    </main>
  );
}

function MagicInvite() {
  const started = useRef(false);
  const [message, setMessage] = useState('Checking your moderator invite…');
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    const target = selectedChannelId();
    window.history.replaceState(null, '', channelPath('/invite', target));
    if (!token) return setMessage('This invite link is missing its sign-in code.');
    void api.consumeInvite(token).then(() => window.location.replace(channelPath('/', target))).catch((caught) => setMessage(caught instanceof Error ? caught.message : 'This invite could not be used'));
  }, []);
  return <StatusPage title="Join the control room">{message}</StatusPage>;
}

function StudioRoute() {
  return <OverlayPage readOnly={useRole() !== 'owner'} />;
}

function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}

function StatusPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="page-bg grid min-h-screen place-items-center px-4 text-ink"><Panel className="flex w-full max-w-[460px] flex-col gap-3 p-8 text-center"><h1 className="m-0 text-2xl text-ink-strong">{title}</h1><p className="m-0 text-sm text-ink-sub">{children}</p></Panel></main>;
}

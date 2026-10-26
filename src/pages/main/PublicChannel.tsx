import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router';
import { ExternalIcon, LockIcon } from '@/components/icons';
import { Logo } from '@/components/Logo';
import { Button, Panel, VLine } from '@/components/ui';
import { SITE } from '@/model';
import type { PublicOverlayState } from '../../../shared/public-state';
import { useChatVars } from '@/theme/useChatVars';
import { ChallengerBoard, HistoryBoard, OverallBoard, type Challenger, type Session } from './Boards';
import '@/pages/app/app.css';
import '@/scoreboard/scoreboard.css';

export function PublicChannel() {
  useChatVars();
  const { channelId = '' } = useParams();
  const [state, setState] = useState<PublicOverlayState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/public/state?channel=${encodeURIComponent(channelId)}`);
        if (!response.ok) throw new Error(response.status === 404 ? 'Board not found' : 'Could not load this board');
        if (!disposed) setState(await response.json() as PublicOverlayState);
      } catch (caught) {
        if (!disposed) setError(caught instanceof Error ? caught.message : 'Could not load this board');
      }
    };
    void load();
    const poll = window.setInterval(load, 15_000);
    return () => { disposed = true; window.clearInterval(poll); };
  }, [channelId]);

  const history = useMemo<Session[]>(() => (state?.sessionHistory ?? []).map((entry) => ({
    name: entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : 'Round',
    date: entry.completedAt ? new Date(entry.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
    time: entry.completedAt ? new Date(entry.completedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '',
    streamer: entry.streamerScore,
    chat: entry.chatScore,
    bouts: [entry.streamerChallengeWins, entry.chatChallengeWins],
  })), [state]);
  const challengers = useMemo<Challenger[]>(() => (state?.leaderboard ?? []).map((entry) => ({
    name: entry.displayName, points: entry.points, played: 0, won: 0,
  })), [state]);
  const name = state?.channel.displayName ?? 'Challenge.Chat';
  const login = state?.publicSettings.twitchLogin ?? state?.channel.broadcasterLogin ?? '';

  return (
    <div className="page-bg flex min-h-screen flex-col text-ink">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-6 pb-16 sm:px-8">
        <Panel as="header" className="flex items-center gap-3 rounded-[20px] py-4 pr-4 pl-4 sm:gap-4 sm:pl-6">
          <a href={SITE} target="_blank" rel="noreferrer" className="flex flex-none rounded-lg no-underline" aria-label="Challenge.Chat"><Logo size={24} /></a>
          <VLine />
          <h1 className="m-0 min-w-0 truncate text-[15px] leading-none font-semibold text-ink-strong sm:text-[17px]">{name}</h1>
          <div className="flex-1" />
          {login && <Button size="sm" variant="ghost" nativeButton={false} render={<a href={`https://twitch.tv/${login}`} target="_blank" rel="noopener noreferrer" />}>Watch on Twitch<ExternalIcon size={14} /></Button>}
        </Panel>

        {error ? (
          <Panel className="px-6 py-16 text-center text-ink-sub">{error}</Panel>
        ) : !state ? (
          <Panel className="px-6 py-16 text-center text-ink-sub">Loading board…</Panel>
        ) : state.publicSettings.publicPage ? (
          <>
            <OverallBoard history={history} current={null} streamerName={name} />
            <HistoryBoard history={history} current={null} live={false} challengers={challengers} />
            <ChallengerBoard challengers={challengers} sessions={history} />
          </>
        ) : (
          <Panel className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <LockIcon size={22} className="text-ink-muted" />
            <p className="m-0 text-[17px] font-semibold text-ink-strong">This page is private</p>
            <p className="m-0 max-w-[40ch] text-[13px] leading-relaxed text-ink-sub">{name} keeps their scoreboard private.</p>
          </Panel>
        )}

        <footer className="flex items-center justify-between pt-2 pr-3 pl-4 sm:pr-6 sm:pl-7">
          <a href={SITE} target="_blank" rel="noopener noreferrer" className="flex rounded-md no-underline" aria-label="Challenge.Chat"><Logo size={16} animated={false} challengeBg="#3a4046" challengeText="#d6dce1" chatBg="#24282b" chatText="#8f99a2" /></a>
          <a href={SITE} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[13px] text-ink-muted no-underline hover:text-ink-strong">Run your own<ExternalIcon size={11} /></a>
        </footer>
      </div>
    </div>
  );
}

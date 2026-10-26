import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useLocation, useMatch, useNavigate } from 'react-router';
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  MegaphoneIcon,
  PlayCircleIcon,
  StopIcon,
  TrashIcon,
  ExternalIcon,
  HomeIcon,
  InboxIcon,
  LayoutIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  TrophyIcon,
  UndoIcon,
} from '@/components/icons';
import {
  Button,
  ConfirmDialog,
  CountBadge,
  Label,
  Menu,
  Pagination,
  Panel,
  Screen,
  SegmentedControl,
  SegmentMeter,
  Tag,
  Timer,
  Tooltip,
  useToasts,
  VLine,
  VoteBar,
  Well,
} from '@/components/ui';
import { SITE, VOTE_LENGTHS, challengeFromState, channelFromState, type Challenge, type Channel } from '@/model';
import { hydrateOverlayConfig, useOverlayDisplay } from '@/data/overlayConfig';
import { hydrateSessionSettings, useSessionSettings } from '@/data/sessionSettings';
import { burst, centerOf } from '@/feel/fx';
import { cn } from '@/lib/cn';
import { formatClock } from '@/lib/format';
import { Logo } from '@/components/Logo';
import { useChatVars } from '@/theme/useChatVars';
import { useTheme } from '@/theme/ThemeProvider';
import { ACCENT_PRESETS, complement } from '@/theme/accent';
import { ChallengeMeta } from '@/pages/app/parts';
import type { Side } from '@/scoreboard/model';
import { fmt, LiveDot } from '@/scoreboard/parts';
import { ChallengerBoard, HistoryBoard, OverallBoard, SIDE_NAME, type Challenger, type Session } from './Boards';
import { ChannelsSheet } from './ChannelsSheet';
import { OverlayElementsSheet } from './OverlayElementsSheet';
import { Inbox, type InboxIdea } from './Inbox';
import { SessionTitleSheet, StreamedTitle, useStreamedTitle } from './SessionTitle';
import { ChallengeResults, ChallengerRecap, challengerRecap } from './Recap';
import { Settings } from './Settings';
import { VotersSheet, type Voter } from './VotersSheet';
import { WinButtons } from './WinButtons';
import { useChallengeChatController } from '@/framework/use-challenge-chat';
import { channelPath } from '@/framework/channel';
import { api } from '@/api';
import type { AppState } from '../../../shared/contracts';
import { useDisplayName, useRole } from '@/pages/app/shell-context';
import '@/pages/app/app.css';
import '@/scoreboard/scoreboard.css';

/**
 * / — one column, top to bottom: what's happening now, the overall
 * score, and every previous session.
 *
 * A "session" is one run: chat submits ideas, the streamer approves some for a
 * vote, chat votes, and the top few become the lineup of challenges played
 * through one at a time. Each challenge cleared scores
 * its points for the streamer; each one failed scores them for chat.
 */

export const STAGES = ['new', 'open', 'vote', 'lock', 'live', 'done'] as const;
export type Stage = (typeof STAGES)[number];

const STEP_LABEL: Record<Stage, string> = {
  new: 'Setup',
  open: 'Open',
  vote: 'Vote',
  lock: 'Lock in',
  live: 'Play',
  done: 'Results',
};

/** How long submissions are meant to stay open (seconds). A guide only — it never closes anything. */
const SUBMIT_LENGTH = 600;

type Entry = { c: Challenge; votes: number };
type Played = { c: Challenge; winner: Side | null };
type Round = {
  elapsed: number;
  attempts: number;
  paused: boolean;
  result: Side | null;
};

/** Current time as "7:42pm". */
const clockTime = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();

/** A table inside the main panel, bleeding to its edges (20px / 28px padding) with the end columns padded back in. */
/** The blinking "taking ideas" dot, in the primary colour instead of the scoreboard's broadcast red. */
const LIVE_DOT = 'bg-accent shadow-[0_0_10px_rgba(var(--ar),.9)]';

/** Submissions table page size. */
const IDEA_PAGE = 10;

/** The floating mock stage switcher, for jumping between steps while designing. Hidden; ?stage= in the URL still works. */
const SHOW_STAGE_SWITCHER = false;

const PANEL_TABLE =
  'table w-full table-fixed [&_td:first-child]:pl-5 [&_td:last-child]:pr-5 [&_th:first-child]:pl-5 [&_th:last-child]:pr-5 sm:[&_td:first-child]:pl-7 sm:[&_td:last-child]:pr-7 sm:[&_th:first-child]:pl-7 sm:[&_th:last-child]:pr-7';

const freshRound = (): Round => ({
  elapsed: 0,
  attempts: 1,
  paused: false,
  result: null,
});
const elapsedSince = (startedAt: string) => Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
const byVotes = (a: Entry, b: Entry) => b.votes - a.votes;

export function ControlMain() {
  const controller = useChallengeChatController();
  useEffect(() => {
    if (!controller.state) return;
    hydrateOverlayConfig(controller.state.overlayConfig);
    hydrateSessionSettings(controller.state.sessionSettings);
  }, [controller.state]);
  if (!controller.state) {
    return <main className="page-bg grid min-h-screen place-items-center text-ink-sub">{controller.error ?? 'Loading control room…'}</main>;
  }
  return <ControlRoom controller={controller as typeof controller & { state: AppState }} />;
}

function ControlRoom({ controller }: { controller: ReturnType<typeof useChallengeChatController> & { state: AppState } }) {
  const state = controller.state;
  const channel = channelFromState(state);
  const theme = useTheme();
  const role = useRole();
  const displayName = useDisplayName();
  const navigate = useNavigate();
  const toast = useToasts();
  const location = useLocation();
  const onInbox = !!useMatch('/inbox');
  const settingsTab = useMatch('/settings/:tab')?.params.tab;
  const onSettings = !!useMatch('/settings') || settingsTab !== undefined;
  /** On a sub-page (inbox, settings) rather than the session itself. */
  const offMain = onInbox || onSettings;
  const hasRoundChallenges = state.challenges.some((item) => !['inbox', 'rejected'].includes(item.status));
  const [opened, setOpened] = useState(state.session.submissionsOpen || hasRoundChallenges);
  const phaseStage: Record<AppState['session']['phase'], Stage> = { collecting: opened || state.session.submissionsOpen || hasRoundChallenges ? 'open' : 'new', voting: 'vote', ready: 'lock', live: 'live', complete: 'done' };
  const stage = phaseStage[state.session.phase];
  /** A session is underway: from opening submissions until its results screen. */
  // Through the recap too: totals only, no history or leaderboards, until the session is filed.
  const inSession = stage !== 'new';
  const go = (_stage: Stage) => navigate({ pathname: '/', search: location.search }, { replace: !offMain });
  const showInbox = (open: boolean) =>
    navigate({
      pathname: open ? '/inbox' : '/',
      search: location.search,
    });
  const showSettings = (open: boolean) =>
    navigate({
      pathname: open ? '/settings' : '/',
      search: location.search,
    });

  const inbox: InboxIdea[] = state.challenges
    .filter((item) => item.status === 'inbox')
    .map((item) => ({
      c: challengeFromState(item),
      at: new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      seen: !item.needsReview,
    }));
  const [queued, setQueued] = useState<string[]>([]);
  /** The top-bar badge counts only ideas nobody has looked at yet. */
  const newInInbox = inbox.filter((i) => !i.seen && !queued.includes(i.c.id)).length;
  const initialChallenges = state.challenges.filter((item) => !['rejected', 'inbox'].includes(item.status)).map(challengeFromState);
  const initialPlayed: Played[] = state.challenges
    .filter((item) => ['streamer_won', 'chat_won', 'skipped', 'voided'].includes(item.status))
    .map((item) => ({
      c: challengeFromState(item),
      winner: item.status === 'streamer_won' ? 'streamer' : item.status === 'chat_won' ? 'chat' : null,
    }));
  const [ideas, setIdeas] = useState<Challenge[]>(initialChallenges);
  const [submitLeft, setSubmitLeft] = useState(SUBMIT_LENGTH);
  const [approved, setApproved] = useState<string[]>(state.challenges.filter((item) => ['approved', 'queued'].includes(item.status)).map((item) => item.id));
  /** Open stage: ideas are streaming in. Closing pauses the stream so ideas can be picked for the vote. */
  const [accepting, setAccepting] = useState(state.session.submissionsOpen);
  const [size, setSize] = useState(String(state.session.scoringRules.voting.winnersCount));
  const [voteLength, setVoteLength] = useState(String(state.session.scoringRules.voting.durationSeconds));
  const [entries, setEntries] = useState<Entry[]>(state.ballot?.entries.map((entry) => ({ c: challengeFromState(entry.challenge), votes: entry.votes })) ?? []);
  const [voteLeft, setVoteLeft] = useState(() => state.ballot ? Math.max(0, Math.ceil((new Date(state.ballot.endsAt).getTime() - Date.now()) / 1000)) : 0);
  const [picks, setPicks] = useState<string[]>(state.challenges.filter((item) => ['queued', 'active', 'streamer_won', 'chat_won', 'skipped', 'voided'].includes(item.status)).map((item) => item.id));
  const [lineup, setLineup] = useState<Challenge[]>(state.challenges.filter((item) => ['queued', 'active', 'streamer_won', 'chat_won', 'skipped', 'voided'].includes(item.status)).map(challengeFromState));
  const [played, setPlayed] = useState<Played[]>(initialPlayed);
  const [round, setRound] = useState<Round>(() => ({
    elapsed: state.activeRound ? elapsedSince(state.activeRound.startedAt) : 0,
    attempts: (state.activeRound?.attemptsUsed ?? 0) + 1,
    paused: false,
    result: !state.activeRound && state.session.phase === 'live' ? initialPlayed.at(-1)?.winner ?? null : null,
  }));
  const historyFromState = (value: AppState): Session[] => value.sessionHistory.map((entry) => ({
    name: entry.name ?? (entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : 'Round'),
    date: entry.completedAt ? new Date(entry.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
    time: entry.completedAt ? new Date(entry.completedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '',
    streamer: entry.streamerScore,
    chat: entry.chatScore,
    bouts: [entry.streamerChallengeWins, entry.chatChallengeWins],
  }));
  const [history, setHistory] = useState<Session[]>(() => historyFromState(state));
  const challengers: Challenger[] = state.leaderboard.map((entry) => ({
    name: entry.displayName,
    points: entry.points,
    played: entry.played,
    won: entry.won,
  }));
  const [channels, setChannels] = useState<Channel[]>([channel]);
  /** When the running session was opened, e.g. "7:42pm". */
  const [startedAt, setStartedAt] = useState(clockTime);
  const [channelsOpen, setChannelsOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  /** Overlay elements switched on from the header's layout button: the active theme's, shared with /overlay. */
  const [elementsOpen, setElementsOpen] = useState(false);
  const elementsOn = Object.values(useOverlayDisplay().elements).filter(Boolean).length;
  useEffect(() => {
    theme.applyBoard(state.theme.primary, state.theme.accent);
  }, [state.channel.id, state.theme.accent, state.theme.primary, theme.applyBoard]);
  useEffect(() => {
    if (state.ballot) setSize(String(state.ballot.winnersCount));
  }, [state.ballot?.id, state.ballot?.winnersCount]);
  useEffect(() => {
    if (role !== 'owner') {
      setChannels([channel]);
      return;
    }
    void api.channels().then(({ channels: available }) => setChannels(available.filter((item) => item.setupComplete).map((item) => item.id === channel.id ? channel : {
      id: item.id, displayName: item.displayName, slug: item.slug, broadcasterLogin: item.slug, setupComplete: item.setupComplete, live: false,
      review: 0, ready: 0, mods: 0, score: { streamer: 0, chat: 0 }, lastActive: 'Available', assignedToMod: true,
    }))).catch(() => undefined);
  }, [channel.id, channel.displayName, channel.score.chat, channel.score.streamer, role]);

  useChatVars();

  const at = STAGES.indexOf(stage);
  const past = (s: Stage) => at >= STAGES.indexOf(s);
  const n = state.ballot?.winnersCount ?? Number(size);
  const voteSecs = Number(voteLength);
  const resolvedId = round.result && !state.activeRound ? played.at(-1)?.c.id : null;
  const activeId = state.activeRound?.challengeId ?? resolvedId;
  const activeIndex = activeId ? lineup.findIndex((item) => item.id === activeId) : -1;
  const showingPersistedResult = stage === 'live' && !state.activeRound && !!round.result && played.length > 0;
  const index = activeIndex >= 0 ? activeIndex : showingPersistedResult ? played.length - 1 : played.length;
  const current = lineup[index] ?? null;
  const limit = current?.timeLimit ?? null;
  const timeUp = limit != null && round.elapsed >= limit;
  const totalVotes = entries.reduce((s, e) => s + e.votes, 0);
  const ranked = [...entries].sort(byVotes);
  /** Chat's !vote number: the order the ideas were put up, which doesn't change as the table re-sorts. */
  const voteNum = (e: Entry) => entries.findIndex((x) => x.c.id === e.c.id) + 1;
  const [voteRows] = useAutoAnimate<HTMLTableSectionElement>({ duration: 350 });

  /* Individual voter identities are intentionally absent until a trusted chat adapter persists them. */
  const voteLog = useRef(new Map<string, Voter[]>());
  entries.forEach((entry) => voteLog.current.set(entry.c.id, []));
  const [votersFor, setVotersFor] = useState<string | null>(null);
  const votersEntry = stage === 'vote' || stage === 'lock' ? entries.find((e) => e.c.id === votersFor) : undefined;

  const topPicks = (list: Entry[]) =>
    [...list]
      .sort(byVotes)
      .slice(0, n)
      .map((e) => e.c.id);
  const byId = (id: string) => [...ideas, ...entries.map((entry) => entry.c), ...lineup].find((c) => c.id === id)!;

  /* Authoritative state updates every stage and list; local state only holds UI affordances. */
  useEffect(() => {
    const visible = state.challenges.filter((item) => !['rejected', 'inbox'].includes(item.status)).map(challengeFromState);
    const selected = state.challenges.filter((item) => ['queued', 'active', 'streamer_won', 'chat_won', 'skipped', 'voided'].includes(item.status));
    setIdeas(visible);
    setApproved(state.challenges.filter((item) => ['approved', 'queued'].includes(item.status)).map((item) => item.id));
    setEntries(state.ballot?.entries.map((entry) => ({ c: challengeFromState(entry.challenge), votes: entry.votes })) ?? []);
    setPicks(selected.map((item) => item.id));
    setLineup(selected.map(challengeFromState));
    const resolved: Played[] = selected.filter((item) => ['streamer_won', 'chat_won', 'skipped', 'voided'].includes(item.status)).map((item) => ({
      c: challengeFromState(item), winner: item.status === 'streamer_won' ? 'streamer' : item.status === 'chat_won' ? 'chat' : null,
    }));
    setPlayed(resolved);
    setHistory(historyFromState(state));
    setAccepting(state.session.submissionsOpen);
    setQueued((current) => current.filter((id) => state.challenges.some((item) => item.id === id && item.status === 'inbox')));
    if (state.activeRound) {
      setRound({ elapsed: elapsedSince(state.activeRound.startedAt), attempts: state.activeRound.attemptsUsed + 1, paused: false, result: null });
    } else if (state.session.phase === 'live') {
      setRound((currentRound) => ({ ...currentRound, result: resolved.at(-1)?.winner ?? null }));
    }
    if (state.ballot) setVoteLeft(Math.max(0, Math.ceil((new Date(state.ballot.endsAt).getTime() - Date.now()) / 1000)));
  }, [state]);

  /* Clocks */
  useEffect(() => {
    if (stage === 'open' && accepting) {
      const clock = setInterval(() => setSubmitLeft((s) => Math.max(0, s - 1)), 1000);
      return () => clearInterval(clock);
    }
    if (stage === 'vote') {
      const id = setInterval(() => {
        setVoteLeft((s) => Math.max(0, s - 1));
      }, 1000);
      return () => clearInterval(id);
    }
    if (stage === 'live' && !round.paused && !round.result && !timeUp) {
      const id = setInterval(() => setRound((r) => ({ ...r, elapsed: r.elapsed + 1 })), 1000);
      return () => clearInterval(id);
    }
  }, [stage, accepting, round.paused, round.result, timeUp]);

  useEffect(() => {
    if (stage === 'vote' && voteLeft === 0 && entries.length) closeVoting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voteLeft]);

  /* ───────── Actions ───────── */

  /** Opens submissions, starting with any inbox ideas queued for this session. */
  const openSubmissions = () => {
    setStartedAt(clockTime());
    setSubmitLeft(SUBMIT_LENGTH);
    setAccepting(true);
    setOpened(true);
    go('open');
    void controller.mutate(async () => {
      if (state.session.phase === 'complete') await controller.actions.createSession();
      await Promise.all(queued.map((id) => controller.actions.setStatus(id, 'pending_review')));
      await controller.actions.setSubmissionsOpen(true);
      setQueued([]);
    });
  };

  /* ───────── Inbox ───────── */

  const moveToSubmissions = (items: InboxIdea[]) => {
    if (!items.length) return;
    void controller.mutate(() => Promise.all(items.map((item) => controller.actions.setStatus(item.c.id, 'pending_review'))));
    toast.add({
      title: 'Added to submissions',
      description: items.length === 1 ? items[0].c.title : `${items.length} ideas`,
    });
  };

  const addFromInbox = (item: InboxIdea) => {
    if (stage === 'open' && accepting) moveToSubmissions([item]);
    else setQueued((q) => (q.includes(item.c.id) ? q.filter((x) => x !== item.c.id) : [...q, item.c.id]));
  };

  const addAllFromInbox = () => {
    if (stage === 'open' && accepting) moveToSubmissions(inbox);
    else setQueued(inbox.map((i) => i.c.id));
  };

  const rejectFromInbox = (item: InboxIdea) => {
    const wasQueued = queued.includes(item.c.id);
    setQueued((q) => q.filter((x) => x !== item.c.id));
    void controller.mutate(() => controller.actions.setStatus(item.c.id, 'rejected'));
    toast.add({
      title: 'Deleted',
      description: item.c.title,
      actionProps: {
        children: 'Undo',
        onClick: () => {
          void controller.mutate(() => controller.actions.setStatus(item.c.id, 'inbox'));
          if (wasQueued) setQueued((q) => [...q, item.c.id]);
        },
      },
    });
  };

  /** Take an idea out of this session but keep it for later, at the top of the inbox. */
  const moveToInbox = (c: Challenge) => {
    void controller.mutate(() => controller.actions.setStatus(c.id, 'inbox'));
    toast.add({
      title: 'Moved to inbox',
      description: `${c.title} can be added to a later round.`,
    });
  };

  const rejectIdea = (c: Challenge) => {
    void controller.mutate(() => controller.actions.setStatus(c.id, 'rejected'));
  };

  /** Pause the stream and stay put: the list becomes pickable for the vote. */
  const closeSubmissions = () => {
    setAccepting(false);
    void controller.mutate(() => controller.actions.setSubmissionsOpen(false));
  };
  const reopenSubmissions = () => {
    setAccepting(true);
    void controller.mutate(() => controller.actions.setSubmissionsOpen(true));
  };

  const toggleApproved = (id: string) => {
    const on = approved.includes(id);
    void controller.mutate(() => controller.actions.setStatus(id, on ? 'pending_review' : 'approved'));
  };

  const toggleAllApproved = () => {
    const selectAll = approved.length !== ideas.length;
    setApproved(selectAll ? ideas.map((challenge) => challenge.id) : []);
    void controller.mutate(() =>
      Promise.all(
        ideas.map((challenge) => controller.actions.setStatus(challenge.id, selectAll ? 'approved' : 'pending_review')),
      ),
    );
  };

  /** Ideas left unpicked when voting opens. They're kept, not lost: they go to the inbox, already marked seen. */
  const leftovers = ideas.filter((c) => !approved.includes(c.id));
  // Submissions table pages; newest ideas land on page 1. Clamp when ideas are removed.
  const [ideaPageRaw, setIdeaPage] = useState(1);
  const ideaPage = Math.min(ideaPageRaw, Math.max(1, Math.ceil(ideas.length / IDEA_PAGE)));
  const startVoting = () => openVoting();

  /** Approved ideas go on the ballot in the order they were submitted. */
  const openVoting = () => {
    void controller.mutate(() => controller.actions.openBallot(approved, voteSecs, n));
  };

  function closeVoting() {
    if (state.ballot) void controller.mutate(() => controller.actions.closeBallot(state.ballot!.id));
  }

  /** The picked challenges in play order, shown on the Lock in step. */
  const lockList = picks.map((id) => lineup.find((challenge) => challenge.id === id)).filter((c): c is Challenge => !!c);

  /* Generated by the Worker through AI Gateway when the lineup locks, then stored in D1. */
  const sessionTitle = useStreamedTitle(state.session.name ?? '');
  const [titleOpen, setTitleOpen] = useState(false);

  const cancelRound = () => {
    void controller.mutate(async () => {
      try {
        const result = await controller.actions.cancelSession();
        sessionTitle.clear();
        setRound(freshRound());
        setOpened(false);
        setAccepting(false);
        setCancelOpen(false);
        toast.add({
          title: 'Round cancelled',
          description: result.inboxCount ? `${result.inboxCount} unfinished idea${result.inboxCount === 1 ? '' : 's'} moved to Inbox` : 'The board is ready for a new round',
        });
      } catch (caught) {
        toast.add({ title: 'Could not cancel round', description: caught instanceof Error ? caught.message : 'Try again' });
        throw caught;
      }
    });
  };

  /** Lock in and Start are one step: starting locks the lineup and goes live with challenge 1. */
  const startSession = () => {
    const first = lockList[0];
    if (first) void controller.mutate(() => controller.actions.start(first.id));
  };

  const finish = (side: Side, from?: HTMLElement | null) => {
    setRound((r) => ({ ...r, result: side }));
    if (current) void controller.mutate(() => controller.actions.resolve(current.id, side === 'streamer' ? 'streamer_won' : 'chat_won'));
    if (from) burst(centerOf(from), { count: 18 });
  };

  const next = () => {
    setRound(freshRound());
    const upcoming = lineup.find((item) => !played.some((done) => done.c.id === item.id) && item.id !== current?.id);
    if (upcoming) void controller.mutate(() => controller.actions.start(upcoming.id));
    else void controller.mutate(() => controller.actions.completeSession());
  };

  /* Auto-start: once a winner is called, count down and move on unless Undo, Next or Cancel comes first. */
  const { autoNext, autoNextSecs } = useSessionSettings();
  const [autoLeft, setAutoLeft] = useState<number | null>(null);
  useEffect(() => {
    setAutoLeft(stage === 'live' && round.result && autoNext ? autoNextSecs : null);
  }, [stage, round.result, autoNext, autoNextSecs]);
  useEffect(() => {
    if (autoLeft == null) return;
    if (autoLeft <= 0) {
      next();
      return;
    }
    const id = setTimeout(() => setAutoLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(id);
    // Only the count drives this; `next` is recreated every render.
  }, [autoLeft]);

  const skip = () => {
    if (!current) return;
    const upcoming = lineup[index + 1];
    void controller.mutate(async () => {
      await controller.actions.resolve(current.id, 'skipped');
      if (upcoming) await controller.actions.start(upcoming.id);
      else await controller.actions.completeSession();
    });
  };

  /** Files the finished (or abandoned) run into history and resets for a new one. */
  const startNew = () => {
    sessionTitle.clear();
    setRound(freshRound());
    setOpened(false);
    if (state.session.phase === 'complete') void controller.mutate(() => controller.actions.createSession());
  };

  const onNewSession = () => (stage === 'done' ? startNew() : undefined);

  /* ───────── Render ───────── */

  const pendingResult = current && round.result && !played.some((item) => item.c.id === current.id)
    ? { c: current, winner: round.result }
    : null;
  const run = score(played, pendingResult);
  const sessionWinner: Side | null = run.streamer === run.chat ? null : run.streamer > run.chat ? 'streamer' : 'chat';
  const thisRun: Session | null =
    stage !== 'done' && run.wins.streamer + run.wins.chat > 0
      ? {
          name: state.session.name ?? 'This round',
          date: 'Today',
          time: startedAt,
          streamer: run.streamer,
          chat: run.chat,
          bouts: [run.wins.streamer, run.wins.chat],
        }
      : null;
  return (
    <div className="page-bg flex min-h-screen flex-col text-ink">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 pt-6 pb-36 sm:px-8">
        {/* ───────── Top bar ───────── */}
        <Panel as="header" className="flex items-center gap-3 rounded-[20px] py-4 pr-4 pl-4 sm:gap-4 sm:pl-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link to={{ pathname: '/', search: location.search }} className="flex flex-none rounded-lg no-underline" aria-label="Control panel home">
              <Logo size={24} />
            </Link>
            <VLine />
            {role === 'owner' ? (
              <button
                type="button"
                onClick={() => setChannelsOpen(true)}
                aria-haspopup="dialog"
                aria-label={`Board: ${channel.displayName}, switch board`}
                className="group -mx-2 flex min-w-0 cursor-pointer items-center gap-1.5 rounded-[10px] border-0 bg-transparent px-2 py-1.5 text-ink-soft transition-colors hover:bg-white/[.06] hover:text-ink-strong"
              >
                <span className="truncate text-[15px] leading-none font-semibold sm:text-[17px]">{channel.displayName}</span>
                <ChevronDownIcon size={15} className="flex-none opacity-60 transition-opacity group-hover:opacity-100" />
              </button>
            ) : (
              <span className="min-w-0 truncate text-[15px] leading-none font-semibold text-ink-soft sm:text-[17px]" title={channel.displayName}>
                {channel.displayName}
              </span>
            )}
          </div>
          <div className="flex-1" />
          {role === 'mod' && displayName && (
            <span className="flex min-w-0 items-center gap-2 rounded-[10px] border border-white/[.07] bg-white/[.035] px-2.5 py-2 text-[13px] text-ink-soft" title={`Signed in as ${displayName}`}>
              <span className="grid size-5 flex-none place-items-center rounded-full bg-accent/15 text-[11px] font-bold text-accent-text" aria-hidden="true">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="max-w-[120px] truncate font-semibold">{displayName}</span>
              <span className="text-ink-muted max-md:hidden">Moderator</span>
            </span>
          )}
          <div className="flex gap-2">
            {/* Only while a session is running — from the Set up screen there's nothing to restart. */}
            {stage !== 'new' && (
              <Tooltip content={stage === 'done' ? 'New Round' : 'Cancel Round'}>
                <Button
                  variant="quiet"
                  icon
                  onClick={stage === 'done' ? onNewSession : () => setCancelOpen(true)}
                  aria-label={stage === 'done' ? 'New round' : 'Cancel round'}
                >
                  {stage === 'done' ? <PlusIcon size={17} /> : <StopIcon size={15} />}
                </Button>
              </Tooltip>
            )}
            <Button
              variant="quiet"
              icon
              onClick={() => showInbox(!onInbox)}
              aria-label={`Challenge inbox, ${newInInbox} new`}
              aria-pressed={onInbox}
              title="Challenge Inbox"
            >
              <InboxIcon size={17} />
              <CountBadge n={newInInbox} />
            </Button>
            {role === 'owner' && <Tooltip content="Overlay Elements">
              <Button
                variant="quiet"
                icon
                onClick={() => setElementsOpen(true)}
                aria-label={`Overlay elements, ${elementsOn} on screen`}
                data-active={elementsOn > 0 || undefined}
              >
                <LayoutIcon size={17} />
                <CountBadge n={elementsOn} accent />
              </Button>
            </Tooltip>}
            {role === 'owner' && <Button variant="quiet" className="max-sm:px-3" onClick={() => showSettings(!onSettings)} aria-label="Settings" aria-pressed={onSettings}>
              <SettingsIcon size={15} />
              <span className="max-sm:hidden">Settings</span>
            </Button>}
          </div>
        </Panel>

        {onSettings ? (
          role === 'owner' ? <Settings tab={settingsTab} channel={channel} onSaved={controller.refresh} /> : <Panel className="p-8 text-center text-ink-sub">Owner access required.</Panel>
        ) : onInbox ? (
          <Inbox
            items={inbox}
            queued={queued}
            submitting={stage === 'open' && accepting}
            canOpen={stage === 'new' || stage === 'done'}
            onAdd={addFromInbox}
            onReject={rejectFromInbox}
            onAddAll={addAllFromInbox}
            onOpen={openSubmissions}
          />
        ) : (
          <>
            {/* ───────── Steps ───────── */}
            {/* Setup (no session yet) isn't a step: the row starts at Open, unlit until a session starts */}
            <nav aria-label="Round progress" className="-mb-1 flex items-center gap-1 pr-3 pl-4 sm:gap-3 sm:pr-6 sm:pl-7">
              {STAGES.map((s, i) =>
                s === 'new' ? null : (
                  <Fragment key={s}>
                    {i > 1 && <span className={cn('h-px min-w-1 flex-1 sm:min-w-3', i <= at ? 'bg-accent/50' : 'bg-white/10')} aria-hidden="true" />}
                    <span
                      className={cn(
                        'flex flex-none items-center gap-1.5 text-[14px] font-semibold sm:gap-2',
                        i === at ? 'text-ink-strong' : i < at ? 'text-ink-sub' : 'text-ink-faint',
                      )}
                      aria-current={i === at ? 'step' : undefined}
                    >
                      <span
                        className={cn(
                          'grid size-4 flex-none place-items-center rounded-full',
                          i === at
                            ? 'bg-accent text-white shadow-[0_0_14px_-2px_rgba(var(--ar),.8)]'
                            : i < at
                              ? 'bg-accent/20 text-accent-text'
                              : 'shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]',
                        )}
                      >
                        {i < at ? <CheckIcon size={10} strokeWidth={3.5} /> : i === at && <span className="size-1.5 rounded-full bg-white" />}
                      </span>
                      <span className={cn(i !== at && 'max-sm:sr-only')}>{STEP_LABEL[s]}</span>
                    </span>
                  </Fragment>
                ),
              )}
            </nav>

            {/* ───────── Core ───────── */}
            <Panel as="section" aria-label="Current round" className="flex min-w-0 flex-col gap-5 p-5 sm:p-7">
              {/* NEW — nothing running */}
              {stage === 'new' && (
                <>
                  <Screen className="flex flex-col items-start gap-3 px-6 py-8 sm:px-8">
                    <span className="status">No round running</span>
                    <p className="m-0 text-[28px] leading-tight font-bold tracking-[-.015em] text-white">Start a new round</p>
                    <Button variant="accent" className="mt-2 max-sm:self-stretch" onClick={openSubmissions}>
                      <PlayCircleIcon size={18} />
                      Open submissions
                    </Button>
                    <p className="m-0 mt-1 text-[14px] leading-relaxed text-ink-sub">
                      Chat sends ideas, you pick which go to a vote, and the winners make the lineup
                      {queued.length > 0 && ` · ${queued.length} from your inbox will be added`}
                    </p>
                  </Screen>
                </>
              )}

              {/* OPEN — ideas stream in; closing pauses the stream so the best can be picked for the vote */}
              {stage === 'open' && (
                <>
                  <Screen className="flex flex-col gap-4 px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-col gap-2.5">
                        <span className="status">{accepting ? 'Taking ideas' : 'Submissions paused'}</span>
                        <span className="text-sm text-ink-soft">
                          {accepting ? (
                            <>
                              Viewers suggest with <b className="mono text-ink-strong">!challenge</b> + their idea
                            </>
                          ) : (
                            // Lives in the window (one line either way) so the controls below never shift
                            <span aria-live="polite">
                              {approved.length < n ? (
                                <>
                                  Pick at least <b className="text-ink-strong">{n}</b> for the vote, or choose a smaller top #
                                </>
                              ) : leftovers.length > 0 ? (
                                <>
                                  Ready — <b className="text-ink-strong">{leftovers.length}</b> unpicked will go to the inbox, marked as seen
                                </>
                              ) : (
                                <>
                                  Ready — the top <b className="text-ink-strong">{n}</b> make the round
                                </>
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Label className="text-ink-sub">{!accepting ? 'Paused' : submitLeft ? 'Suggested time left' : 'Suggested time is up'}</Label>
                        <Timer value={formatClock(submitLeft)} className={cn('lit-crisp text-[48px]', !accepting && 'opacity-45')} />
                      </div>
                    </div>
                    <SegmentMeter value={submitLeft / SUBMIT_LENGTH} className="lit-crisp" />
                  </Screen>

                  {/* Vote settings appear once the stream is paused: how many make the round, and how long the vote runs */}
                  {!accepting && (
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                      <SegmentedControl
                        aria-label="How many make the round"
                        options={['3', '5', '7', '10'].map((v) => ({
                          value: v,
                          label: `Top ${v}`,
                        }))}
                        value={size}
                        onValueChange={setSize}
                      />
                      <SegmentedControl
                        aria-label="Voting time"
                        options={VOTE_LENGTHS}
                        value={voteLength}
                        onValueChange={setVoteLength}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <Well className="flex min-h-[45px] items-center gap-3 px-5 py-2 text-[14px] text-ink-sub sm:mr-auto" aria-live="polite">
                      {accepting ? <LiveDot className={LIVE_DOT} /> : <PauseIcon size={12} className="text-ink-muted" />}
                      <span>
                        <b className="font-semibold text-ink-strong">{ideas.length}</b> idea{ideas.length === 1 ? '' : 's'}
                      </span>
                      {!accepting && (
                        <>
                          <span className="text-ink-faint">·</span>
                          <span>
                            <b className={cn('font-semibold', approved.length >= n ? 'text-accent-text' : 'text-ink-strong')}>{approved.length}</b> picked
                          </span>
                        </>
                      )}
                    </Well>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      {accepting ? (
                        <>
                          <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                            Cancel
                          </Button>
                          <Button variant="accent" onClick={closeSubmissions} disabled={!ideas.length}>
                            <StopIcon size={13} />
                            Close
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" onClick={reopenSubmissions}>
                            <PlayCircleIcon size={17} />
                            Reopen
                          </Button>
                          {approved.length >= n ? (
                            <Button variant="accent" onClick={startVoting}>
                              <MegaphoneIcon size={17} />
                              Open voting · {approved.length}
                            </Button>
                          ) : (
                            // Not ready: a quiet ghost key, with a tooltip on the wrapper since a disabled button gets no hover or focus
                            <Tooltip
                              content={
                                <>
                                  Pick at least <b>{n}</b> ideas to open voting ({approved.length} picked), or choose a smaller top #.
                                </>
                              }
                            >
                              <span tabIndex={0} className="flex rounded-[12px] [&>.btn]:pointer-events-none [&>.btn]:flex-1">
                                <Button variant="ghost" disabled>
                                  <MegaphoneIcon size={17} />
                                  {approved.length ? `Open voting · ${approved.length}` : 'Open voting'}
                                </Button>
                              </span>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {/* Same table treatment as the inbox and history, bleeding to the panel's edges */}
                  <div className="-mx-5 sm:-mx-7">
                    <table className={PANEL_TABLE}>
                      <thead>
                        <tr>
                          <th>Challenge</th>
                          <th className="w-[160px] max-sm:hidden">From</th>
                          <th className="w-[110px] text-right sm:w-[120px]">
                            {!accepting && ideas.length > 0 && (
                              <button
                                type="button"
                                className="cursor-pointer border-0 bg-transparent p-0 font-[inherit] tracking-[inherit] text-ink-muted uppercase hover:text-ink-strong"
                                onClick={toggleAllApproved}
                              >
                                {approved.length === ideas.length ? 'Clear' : 'Select all'}
                              </button>
                            )}
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ideas.length === 0 && (
                          <tr>
                            <td colSpan={3} className="py-10 text-center text-[14px] text-ink-muted">
                              <span className="inline-flex items-center gap-3">
                                <LiveDot className={LIVE_DOT} />
                                Waiting for the first idea…
                              </span>
                            </td>
                          </tr>
                        )}
                        {ideas.slice((ideaPage - 1) * IDEA_PAGE, ideaPage * IDEA_PAGE).map((c) => {
                          const on = approved.includes(c.id);
                          return (
                            <tr key={c.id} className="animate-[boot-in_.3s_ease-out] transition-colors hover:[&>td]:bg-white/[.03]">
                              <td>
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <span className="truncate text-[15px] font-semibold text-ink-strong">{c.title}</span>
                                </span>
                                <ChallengeMeta c={c} className="pt-1.5" />
                                <span className="mono block truncate pt-0.5 text-[11px] text-ink-muted sm:hidden">@{c.by}</span>
                              </td>
                              <td className="mono truncate text-[14px] text-ink-soft max-sm:hidden">@{c.by}</td>
                              <td>
                                <span className="flex items-center justify-end gap-2">
                                  {/* Picking is only possible once the stream is paused */}
                                  <Button
                                    size="xs"
                                    icon
                                    variant={on ? 'accent' : 'ghost'}
                                    disabled={accepting}
                                    onClick={() => toggleApproved(c.id)}
                                    aria-pressed={on}
                                    aria-label={on ? `Remove ${c.title} from the vote` : `Add ${c.title} to the vote`}
                                    title={accepting ? 'Close to pick ideas' : undefined}
                                  >
                                    {on ? <CheckIcon size={14} /> : <PlusIcon size={15} />}
                                  </Button>
                                  <Menu
                                    trigger={
                                      <Button size="xs" icon variant="ghost" aria-label={`Remove ${c.title}`}>
                                        <TrashIcon size={14} />
                                      </Button>
                                    }
                                    items={[
                                      {
                                        label: 'Move to inbox',
                                        icon: <InboxIcon size={15} />,
                                        onSelect: () => moveToInbox(c),
                                      },
                                      {
                                        label: 'Delete',
                                        icon: <TrashIcon size={15} />,
                                        onSelect: () => rejectIdea(c),
                                        danger: true,
                                      },
                                    ]}
                                  />
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {ideas.length > 0 && (
                      <Pagination
                        page={ideaPage}
                        pageSize={IDEA_PAGE}
                        total={ideas.length}
                        noun="ideas"
                        onPageChange={setIdeaPage}
                        className="border-t border-black/40 pt-3 pr-3 pl-5 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] sm:pr-6 sm:pl-7"
                      />
                    )}
                  </div>
                </>
              )}

              {/* VOTE — chat votes; the list is locked in */}
              {stage === 'vote' && (
                <>
                  <Screen className="flex flex-col gap-4 px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex flex-col gap-2.5">
                        <span className="status">Chat is voting</span>
                        <span className="text-sm text-ink-soft">
                          Viewers vote with <b className="mono text-ink-strong">!vote 1</b>–<b className="mono text-ink-strong">{entries.length}</b> · top {n}{' '}
                          make the round
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Label className="text-ink-sub">Closes in</Label>
                        <Timer value={formatClock(voteLeft)} className="lit-crisp text-[48px]" />
                      </div>
                    </div>
                    <SegmentMeter value={voteLeft / voteSecs} className="lit-crisp" />
                  </Screen>

                  {/* Same row as the Open step: a live tile on the left, actions on the right, above the table */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <Well className="flex min-h-[45px] items-center gap-3 px-5 py-2 text-[14px] text-ink-sub sm:mr-auto" aria-live="polite">
                      <LiveDot className={LIVE_DOT} />
                      <span>
                        <b className="font-semibold text-ink-strong">{totalVotes.toLocaleString()}</b> votes
                      </span>
                    </Well>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                        Cancel
                      </Button>
                      <Button variant="accent" onClick={closeVoting}>
                        <CheckIcon size={20} />
                        Close voting
                      </Button>
                    </div>
                  </div>

                  {/* Plain table like the submissions list: no lit rows, the bars and the cut line show who's in the top */}
                  <div className="-mx-5 sm:-mx-7">
                    <table className={PANEL_TABLE}>
                      <thead>
                        <tr>
                          <th>Challenge</th>
                          <th className="w-[80px] text-right">Votes</th>
                        </tr>
                      </thead>
                      {/* Sorted by votes; auto-animate slides rows to their new place as the count changes */}
                      <tbody ref={voteRows}>
                        {ranked.flatMap((e, rank) => {
                          const inTop = rank < n;
                          const pct = totalVotes ? Math.round((e.votes / totalVotes) * 100) : 0;
                          const lastIn = rank === n - 1 && ranked.length > n;
                          // One flat list of rows, so the cut line keeps its key and slides like the rest
                          return [
                            <tr
                              key={e.c.id}
                              tabIndex={0}
                              aria-label={`${e.c.title}, ${e.votes} votes, show voters`}
                              onClick={() => setVotersFor(e.c.id)}
                              onKeyDown={(ev) => ev.key === 'Enter' && setVotersFor(e.c.id)}
                              className={cn(
                                'cursor-pointer transition-colors outline-none hover:[&>td]:bg-white/[.045] focus-visible:[&>td]:bg-white/[.045]',
                                lastIn && '[&>td]:border-b-0',
                              )}
                            >
                              <td>
                                <span className="flex min-w-0 items-center gap-2.5">
                                  <span className="truncate text-[15px] font-semibold text-ink-strong">{e.c.title}</span>
                                  {/* The !vote number stays with its challenge as rows move */}
                                  <span className="mono flex-none text-[11px] text-ink-muted max-sm:hidden">
                                    !vote {voteNum(e)} · @{e.c.by}
                                  </span>
                                </span>
                                <VoteBar pct={Math.max(2, pct)} dim={!inTop} className="mt-2" />
                              </td>
                              <td className="pixel text-right text-[20px] text-ink-strong">{e.votes}</td>
                            </tr>,
                            // Cut line: everything above it makes the session
                            lastIn && (
                              <tr key="cut" aria-hidden="true">
                                {/* Full bleed: a glowing segmented rail across the panel, with a lit TOP chip lined up with the titles */}
                                <td colSpan={2} className="!p-0">
                                  <span className="relative flex h-8 items-center">
                                    <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[repeating-linear-gradient(90deg,var(--a-hi)_0_12px,transparent_12px_17px)] drop-shadow-[0_0_5px_rgba(var(--ar),.9)]" />
                                    <span className="mono relative ml-5 flex items-center gap-1.5 rounded-full bg-[linear-gradient(180deg,var(--a-hi),var(--a))] px-2.5 py-1 text-[10px] leading-none font-bold tracking-[.16em] text-[#160b06] shadow-[0_0_14px_rgba(var(--ar),.75),inset_0_1px_0_rgba(255,255,255,.45)] sm:ml-7">
                                      <TrophyIcon size={11} />
                                      TOP {n}
                                    </span>
                                  </span>
                                </td>
                              </tr>
                            ),
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* LOCK — the lineup chat voted in; starting from here goes live */}
              {stage === 'lock' && (
                <>
                  {/* The window carries the session's name: suggested by AI, editable from the settings key */}
                  <Screen className="relative flex flex-col gap-3 px-6 py-6 sm:px-8">
                    <span className="status">Locked in</span>
                    <StreamedTitle text={sessionTitle.text} phase={sessionTitle.phase} />
                    <Button
                      size="xs"
                      icon
                      variant="ghost"
                      className="absolute top-4 right-4"
                      onClick={() => setTitleOpen(true)}
                      aria-label="Edit round title"
                      title="Edit round title"
                    >
                      <SettingsIcon size={14} />
                    </Button>
                  </Screen>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <Well className="flex min-h-[45px] items-center gap-3 px-5 py-2 text-[14px] text-ink-sub sm:mr-auto">
                      <span>
                        <b className="font-semibold text-ink-strong">{lockList.length}</b> Challenges
                      </span>
                      <span className="text-ink-faint">·</span>
                      <span>
                        <b className="font-semibold text-ink-strong">{fmt(lockList.reduce((s, c) => s + c.roundValue, 0))}</b> pts
                      </span>
                    </Well>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                        Cancel round
                      </Button>
                      <Button variant="ghost" onClick={() => (setVoteLeft(30), go('vote'))}>
                        Reopen voting
                      </Button>
                      <Button variant="accent" onClick={startSession} disabled={!lockList.length}>
                        <RocketIcon size={17} />
                        Start round
                      </Button>
                    </div>
                  </div>

                  {/* Only the picked challenges, in play order — plain table like the other steps */}
                  <div className="-mx-5 sm:-mx-7">
                    <table className={PANEL_TABLE}>
                      <thead>
                        <tr>
                          <th>Challenge</th>
                          <th className="w-[220px] text-right max-sm:w-[150px]">Votes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lockList.map((c) => (
                          <tr
                            key={c.id}
                            tabIndex={0}
                            aria-label={`${c.title}, show voters`}
                            onClick={() => setVotersFor(c.id)}
                            onKeyDown={(ev) => ev.key === 'Enter' && setVotersFor(c.id)}
                            className="cursor-pointer transition-colors [&>td]:pb-4 outline-none hover:[&>td]:bg-white/[.045] focus-visible:[&>td]:bg-white/[.045]"
                          >
                            <td>
                              <span className="block truncate text-[20px] font-semibold text-ink-strong">{c.title}</span>
                              <ChallengeMeta c={c} className="mt-2" />
                            </td>
                            <td>
                              <span className="flex items-baseline justify-end gap-3">
                                <span className="mono truncate text-[14px] text-ink-soft">@{c.by}</span>
                                <span className="pixel text-[20px] text-ink-strong">{c.voteCount}</span>
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* PLAY — one challenge at a time */}
              {stage === 'live' && current && (
                <>
                  <div className="flex items-center gap-4">
                    {/* Lineup strip, built like the segmented split: one cell per challenge, lit in the winner's colour once decided; the live one breathes */}
                    <div
                      className="cells flex-1"
                      data-crisp=""
                      style={{ '--cell-h': '14px' } as CSSProperties}
                      role="img"
                      aria-label={`Challenge ${index + 1} of ${lineup.length}`}
                    >
                      {lineup.map((c, i) => {
                        const side = i < index ? played[i]?.winner : i === index ? round.result : null;
                        const live = i === index && !round.result;
                        return (
                          <div key={c.id} className="cell" title={c.title} data-accent={side === 'chat' ? 'chat' : undefined}>
                            {side ? (
                              <i data-pop="" />
                            ) : live ? (
                              <i data-live="" data-paused={round.paused || timeUp || undefined} />
                            ) : (
                              i < index && <i data-skip="" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <span className="mono flex-none text-[12px] text-ink-sub">
                      {fmt(run.streamer)} – {fmt(run.chat)}
                    </span>
                  </div>

                  <Screen className="flex flex-col gap-4 px-6 pt-5 pb-6">
                    <div className="flex items-center justify-between gap-3">
                      {/* Status only when it isn't simply running */}
                      <span className="status">{round.result ? 'Finished' : round.paused ? 'Paused' : timeUp ? 'Time up' : ''}</span>
                      <span className="mono text-[11px] tracking-[.14em] text-ink-sub">
                        {index + 1} OF {lineup.length} · +{current.roundValue} PTS
                      </span>
                    </div>
                    {/* Title, objective and suggester read as one tight block */}
                    <div className="-mt-1 flex flex-col gap-1.5">
                      <p className="m-0 text-[38px] leading-[1.05] font-bold tracking-[-.015em] text-white [text-shadow:0_0_24px_rgba(var(--ar),.25)]">
                        {current.title}
                      </p>
                      <p className="m-0 text-[21px] leading-snug text-ink">{current.objective}</p>
                      <span className="mono pt-0.5 text-[18px] tracking-wider text-accent-text">@{current.by}</span>
                    </div>

                    {round.result ? (
                      <div className="mt-2 flex flex-col items-start gap-2" data-side={round.result}>
                        <span className="sb-lit text-[clamp(30px,5vw,46px)] leading-none font-black tracking-[.02em]">
                          {SIDE_NAME[round.result].toUpperCase()} WINS
                        </span>
                        <span className="mono text-[12px] tracking-[.1em] text-ink-sub">
                          +{current.roundValue} PTS · {formatClock(round.elapsed)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="mt-1 flex flex-wrap items-end justify-between gap-5">
                          <div className="flex flex-col gap-2">
                            <Timer
                              value={formatClock(limit == null ? round.elapsed : Math.max(0, limit - round.elapsed))}
                              className={cn('lit-crisp', round.paused && 'opacity-45')}
                            />
                          </div>
                          {current.maxAttempts && (
                            <div className="flex flex-col items-end gap-2">
                              <Label className="text-ink-sub">Attempt</Label>
                              <span className="pixel text-[30px] leading-none text-ink-strong">
                                {round.attempts}
                                <span className="text-ink-faint">/{current.maxAttempts}</span>
                              </span>
                            </div>
                          )}
                        </div>
                        {limit != null && <SegmentMeter value={1 - round.elapsed / limit} className="lit-crisp" />}
                      </>
                    )}
                  </Screen>

                  {round.result ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Auto-start countdown, quiet on the left */}
                      {autoLeft != null ? (
                        <div className="flex min-w-0 flex-col gap-2 sm:w-[260px]" aria-live="polite">
                          <span className="flex items-center justify-between gap-3 text-[13px] text-ink-sub">
                            <span>
                              {index + 1 < lineup.length ? 'Next challenge' : 'Results'} in <span className="mono text-ink-soft">{autoLeft}s</span>
                            </span>
                            <button type="button" className="cursor-pointer text-[12px] text-ink-muted hover:text-ink-strong" onClick={() => setAutoLeft(null)}>
                              Cancel
                            </button>
                          </span>
                          <span className="h-[3px] overflow-hidden rounded-full bg-white/[.06]">
                            <span
                              className="block h-full rounded-full bg-[var(--a)] opacity-60 transition-[width] duration-1000 ease-linear"
                              style={{ width: `${(autoLeft / autoNextSecs) * 100}%` }}
                            />
                          </span>
                        </div>
                      ) : (
                        <span />
                      )}
                      <div className="flex flex-col gap-3 sm:flex-row-reverse">
                        <Button variant="accent" onClick={next}>
                          {index + 1 < lineup.length ? `Next · ${lineup[index + 1].title}` : 'See results'}
                          <ArrowRightIcon size={18} />
                        </Button>
                        <Button variant="ghost" disabled title="Undo is not available for a server-recorded result yet">
                          <UndoIcon size={18} />
                          Undo
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <WinButtons onWin={finish} />
                      <div className="grid grid-cols-3 gap-3">
                        <Button size="sm" onClick={() => setRound((r) => ({ ...r, paused: !r.paused }))} disabled={timeUp}>
                          {round.paused ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
                          {round.paused ? 'Resume' : 'Pause'}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => current && void controller.mutate(() => controller.actions.attempt(current.id, 1))}
                          disabled={!!current.maxAttempts && round.attempts >= current.maxAttempts}
                        >
                          Failed try
                        </Button>
                        <Button size="sm" onClick={skip}>
                          Skip
                        </Button>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* RESULTS — the lineup is played: who won, and the challengers to shout out */}
              {stage === 'done' && (
                <>
                  <Screen className="flex flex-col gap-3 px-6 py-6 sm:px-8">
                    <span className="status">Round over</span>
                    <p className="m-0 text-[32px] leading-[1.1] font-bold tracking-[-.015em] text-white">{sessionTitle.text || 'This round'}</p>
                    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1" data-side={sessionWinner ?? undefined}>
                      <span className={cn('pixel text-[clamp(26px,4vw,34px)] leading-none', sessionWinner ? 'sb-lit sb-lit-crisp' : 'text-ink-strong')}>
                        {sessionWinner ? `${SIDE_NAME[sessionWinner].toUpperCase()} WINS` : 'DRAW'}
                      </span>
                      <span className="mono text-[13px] tracking-[.08em] text-ink-sub">
                        {run.wins.streamer}–{run.wins.chat} IN CHALLENGES · {fmt(run.streamer)} – {fmt(run.chat)} PTS
                      </span>
                    </div>
                  </Screen>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    <Well className="flex min-h-[45px] items-center gap-3 px-5 py-2 text-[14px] text-ink-sub sm:mr-auto">
                      <span>
                        <b className="font-semibold text-ink-strong">{played.filter((p) => p.winner).length}</b> Played
                      </span>
                      {played.some((p) => !p.winner) && (
                        <>
                          <span className="text-ink-faint">·</span>
                          <span>
                            <b className="font-semibold text-ink-strong">{played.filter((p) => !p.winner).length}</b> Skipped
                          </span>
                        </>
                      )}
                    </Well>
                    <div className="flex flex-col-reverse gap-3 sm:flex-row">
                      <Button variant="ghost" onClick={startNew}>
                        <HomeIcon size={16} />
                        Home
                      </Button>
                      <Button variant="accent" onClick={() => (startNew(), openSubmissions())}>
                        <PlusIcon size={18} />
                        New round
                      </Button>
                    </div>
                  </div>

                  {/* The lineup and how each went, then the challengers to shout out */}
                  <div className="-mx-5 flex flex-col gap-6 sm:-mx-7">
                    <ChallengeResults played={played} tableClass={PANEL_TABLE} />
                    <ChallengerRecap
                      rows={challengerRecap(played, challengers, state.session.scoringRules.challenger)}
                      tableClass={PANEL_TABLE}
                    />
                  </div>
                </>
              )}
            </Panel>

            {/* While a session runs, keep the page about it: totals only, no history or leaderboard. */}
            <OverallBoard history={history} current={thisRun} simple={inSession} streamerName={state.channel.displayName} />
            {!inSession && (
              <>
                <HistoryBoard
                  history={history}
                  current={thisRun}
                  live={inSession}
                  challengers={challengers}
                  onDelete={(gone) => {
                    setHistory((h) => h.filter((x) => x !== gone));
                    toast.add({
                      title: 'Round deleted',
                      description: gone.name,
                    });
                  }}
                />
                <ChallengerBoard challengers={challengers} sessions={history} />
              </>
            )}
          </>
        )}

        {/* ───────── Footer ───────── */}
        <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 pt-2 pr-3 pl-4 sm:pr-6 sm:pl-7">
          {/* Simplified mark: small, still, and greyed so it doesn't compete with the page. */}
          <a href={SITE} target="_blank" rel="noopener noreferrer" className="flex rounded-md no-underline" aria-label="Challenge.Chat">
            <Logo size={16} animated={false} challengeBg="#3a4046" challengeText="#d6dce1" chatBg="#24282b" chatText="#8f99a2" />
          </a>
          <nav aria-label="Links" className="flex items-center gap-4 text-[13px]">
            {[
              ['Docs', `${SITE}/docs`],
              ['Website', SITE],
            ].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-ink-muted no-underline hover:text-ink-strong">
                {label}
                <ExternalIcon size={11} />
              </a>
            ))}
          </nav>
        </footer>
      </div>

      {SHOW_STAGE_SWITCHER && !offMain && <StageSwitcher stage={stage} go={go} />}

      {role === 'owner' && (
        <ChannelsSheet
          open={channelsOpen}
          onOpenChange={setChannelsOpen}
          channels={channels}
          currentId={channel.id}
          defaultTwitchChannel={channel.broadcasterLogin}
          onPick={(c) => {
            setChannelsOpen(false);
            window.location.assign(channelPath('/', c.id));
          }}
          onCreate={async (name, slug, twitchChannel, colorPreset) => {
            const accent = ACCENT_PRESETS[colorPreset] ?? ACCENT_PRESETS[0];
            const { channel: created } = await api.createChannel(name, slug, {
              twitchLogin: twitchChannel,
              primary: accent.hex,
              accent: complement(accent.hex),
            });
            window.location.assign(channelPath('/', created.id));
          }}
        />
      )}

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this round?"
        description="Unfinished ideas move to Inbox so you can use them later. Votes, scores, and completed challenges from this round are discarded."
        confirmLabel="Cancel round"
        cancelLabel="Keep round"
        confirmVariant="danger"
        onConfirm={cancelRound}
      />

      <OverlayElementsSheet open={elementsOpen} onOpenChange={setElementsOpen} />
      <SessionTitleSheet open={titleOpen} onOpenChange={setTitleOpen} title={sessionTitle} />
      <VotersSheet
        open={
          votersEntry
            ? {
                c: votersEntry.c,
                num: voteNum(votersEntry),
                votes: votersEntry.votes,
                share: totalVotes ? Math.round((votersEntry.votes / totalVotes) * 100) : 0,
                rank: ranked.indexOf(votersEntry) + 1,
                voters: voteLog.current.get(votersEntry.c.id) ?? [],
              }
            : null
        }
        onClose={() => setVotersFor(null)}
      />
    </div>
  );
}

/** Points and wins per side across the played list (plus the one just decided, if any). */
function score(played: Played[], pending?: Played | null) {
  const all = pending ? [...played, pending] : played;
  const of = (side: Side) => all.filter((p) => p.winner === side);
  return {
    streamer: of('streamer').reduce((s, p) => s + p.c.roundValue, 0),
    chat: of('chat').reduce((s, p) => s + p.c.roundValue, 0),
    wins: { streamer: of('streamer').length, chat: of('chat').length },
  };
}

/* ───────── Mock switcher (design review only) ───────── */

function StageSwitcher({ stage, go }: { stage: Stage; go: (s: Stage) => void }) {
  const [open, setOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="chip fixed right-4 bottom-4 z-30 cursor-pointer border-0">
        Mock ▴
      </button>
    );
  }
  return (
    <Panel
      className="fixed right-3 bottom-3 z-30 flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-2.5 rounded-[16px] p-3 pl-4"
      aria-label="Mock stage switcher"
    >
      <Label className="text-accent-text">Stage</Label>
      <div className="segc well flex-wrap" role="group" aria-label="Jump to stage">
        {STAGES.map((s) => (
          <button key={s} type="button" className={cn('segc-item min-h-[32px] px-2.5 text-[11.5px]', stage === s && 'active')} onClick={() => go(s)}>
            {STEP_LABEL[s]}
          </button>
        ))}
      </div>
      <Button size="xs" variant="ghost" onClick={() => setOpen(false)} aria-label="Hide mock switcher">
        ▾
      </Button>
    </Panel>
  );
}

import type { LiveRunProjection } from '../../../shared/framework';
import type { PublicChallenge, PublicOverlayState, PublicSubmission } from '../../../shared/public-state';
import { channelPath } from '@/framework/channel';
import type {
  Challenge,
  Clock,
  Metric,
  OverlaySnapshot,
  OverlaySource,
  Result,
  Session,
  Side,
  Stage,
} from '@/overlay/sdk';
import { getTheme, listThemes } from '@/overlay/sdk';
import '@/overlay/themes';

const PHASE_STAGE: Record<PublicOverlayState['session']['phase'], Stage> = {
  collecting: 'open',
  voting: 'vote',
  ready: 'lock',
  live: 'live',
  complete: 'done',
};

const at = (value: string | null | undefined): number | null => value ? new Date(value).getTime() : null;

function challenge(value: PublicChallenge | PublicSubmission): Challenge {
  return {
    id: value.id,
    title: value.title,
    objective: value.objective,
    by: value.authorLogin,
    difficulty: value.difficulty,
    points: value.roundValue,
    timeLimit: value.timeLimitSeconds,
    maxAttempts: value.maxAttempts,
    game: value.game,
  };
}

function result(value: PublicChallenge, attempts: number): Result | null {
  const winner: Side | null = value.status === 'streamer_won' ? 'streamer' : value.status === 'chat_won' ? 'chat' : null;
  if (!['streamer_won', 'chat_won', 'skipped', 'voided'].includes(value.status)) return null;
  return { challengeId: value.id, winner, attempts, took: 0 };
}

function metricsOf(run: LiveRunProjection | null): Metric[] {
  return (run?.metrics ?? []).map((metric) => ({
    id: metric.id,
    kind: metric.kind,
    label: metric.label,
    value: metric.value,
    target: metric.target,
  }));
}

function clock(startsAt: number, endsAt: number | null, pausedAt: number | null = null): Clock {
  return { startsAt, endsAt, pausedAt };
}

export function mapPublicOverlayState(
  state: PublicOverlayState,
  liveRun: LiveRunProjection | null = null,
  revision = 0,
  serverTime = Date.now(),
): OverlaySnapshot {
  const lineup = state.lineup.map(challenge);
  const active = state.activeChallenge ? challenge(state.activeChallenge) : null;
  const resolved = state.lineup.map((item) => result(item, item.id === state.activeRound?.challengeId ? state.activeRound.attemptsUsed : 0)).filter((item): item is Result => !!item);
  const activeIndex = active ? Math.max(0, lineup.findIndex((item) => item.id === active.id)) : -1;
  const recent = state.recentResult ? challenge(state.recentResult) : null;
  const recentIndex = recent ? Math.max(0, lineup.findIndex((item) => item.id === recent.id)) : -1;
  const startsAt = at(state.activeRound?.startedAt) ?? at(liveRun?.startsAt) ?? serverTime;
  const endsAt = at(state.activeRound?.endsAt) ?? at(liveRun?.endsAt);
  const pausedAt = at(liveRun?.pausedAt);

  let round: Session['round'] = null;
  if (active && state.activeRound) {
    round = {
      index: activeIndex,
      clock: clock(startsAt, endsAt, pausedAt),
      attempt: Math.max(1, state.activeRound.attemptsUsed + 1),
      call: null,
    };
  } else if (recent && state.session.phase === 'live') {
    const winner: Side = state.recentResult?.status === 'chat_won' ? 'chat' : 'streamer';
    round = {
      index: recentIndex,
      clock: clock(serverTime, serverTime, serverTime),
      attempt: Math.max(1, state.activeRound?.attemptsUsed ?? 1),
      call: { winner, at: serverTime, next: null },
    };
  }

  const ballotEnd = at(state.ballot?.endsAt);
  const stage = PHASE_STAGE[state.session.phase];
  const displayTheme = getTheme(state.overlayConfig.theme) ?? listThemes()[0];
  const session: Session = {
    id: state.session.id,
    name: null,
    stage,
    startedAt: ballotEnd ? ballotEnd - state.session.scoringRules.voting.durationSeconds * 1000 : serverTime,
    submissions: {
      open: stage === 'open' && state.session.submissionsOpen,
      clock: null,
      ideas: state.submissions.map((item) => ({ challenge: challenge(item), at: at(item.createdAt) ?? serverTime })),
      command: '!challenge',
    },
    ballot: state.ballot && ballotEnd ? {
      clock: clock(ballotEnd - state.session.scoringRules.voting.durationSeconds * 1000, ballotEnd),
      winners: state.ballot.winnersCount,
      votesPerViewer: state.ballot.votesPerViewer,
      entries: state.ballot.entries.map((entry) => ({ challenge: challenge(entry.challenge), votes: entry.votes })),
      command: '!vote',
    } : null,
    lineup,
    results: resolved,
    round,
  };

  return {
    revision,
    serverTime,
    channel: { id: state.channel.id, name: state.channel.displayName, login: state.channel.broadcasterLogin },
    sides: {
      streamer: { name: state.channel.displayName, color: state.theme.primary },
      chat: { name: 'Chat', color: state.theme.accent },
    },
    session,
    history: state.sessionHistory.map((entry) => ({
      id: entry.id,
      name: entry.completedAt ? new Date(entry.completedAt).toLocaleDateString() : 'Session',
      endedAt: at(entry.completedAt) ?? serverTime,
      points: { streamer: entry.streamerScore, chat: entry.chatScore },
      wins: { streamer: entry.streamerChallengeWins, chat: entry.chatChallengeWins },
    })),
    challengers: state.leaderboard.map((entry) => ({ id: entry.userId, name: entry.displayName, points: entry.points, played: 0, won: 0 })),
    scoring: {
      selectedPoints: state.session.scoringRules.challenger.selectedPoints,
      defeatedPoints: state.session.scoringRules.challenger.defeatedStreamerPoints,
    },
    metrics: metricsOf(liveRun),
    sponsors: [],
    display: {
      theme: displayTheme?.id ?? 'broadcast',
      settings: state.overlayConfig.settings[displayTheme?.id ?? 'broadcast'] ?? {},
      elements: state.overlayConfig.elements,
    },
  };
}

type SocketUpdate =
  | { type: 'overlay.changed'; revision: number; state: PublicOverlayState }
  | { type: 'framework.run.changed'; projection: LiveRunProjection };

export function createLiveSource(): OverlaySource {
  return {
    connect(sink) {
      let disposed = false;
      let socket: WebSocket | null = null;
      let retry = 0;
      let retryTimer: number | undefined;
      let state: PublicOverlayState | null = null;
      let run: LiveRunProjection | null = null;
      let revision = 0;

      const publish = () => {
        if (state) sink.snapshot(mapPublicOverlayState(state, run, revision, Date.now()));
      };

      const bootstrap = async () => {
        const response = await fetch(channelPath('/api/public/state'));
        if (!response.ok) throw new Error('Could not load overlay state');
        state = await response.json() as PublicOverlayState;
        revision += 1;
        publish();
      };

      const connect = () => {
        if (disposed) return;
        sink.status(retry ? 'reconnecting' : 'connecting');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${window.location.host}${channelPath('/api/v1/live/socket?scope=overlay')}`);
        socket.addEventListener('open', () => {
          retry = 0;
          sink.status('live');
        });
        socket.addEventListener('message', (message) => {
          if (message.data === 'pong') return;
          const update = JSON.parse(String(message.data)) as SocketUpdate;
          if (update.type === 'overlay.changed') {
            state = update.state;
            revision = Math.max(revision + 1, update.revision);
          } else if (update.type === 'framework.run.changed') {
            run = update.projection;
            revision += 1;
          }
          publish();
        });
        socket.addEventListener('close', () => {
          if (disposed) return;
          retry += 1;
          sink.status('reconnecting');
          retryTimer = window.setTimeout(connect, Math.min(1_000 * 2 ** retry, 15_000));
        });
        socket.addEventListener('error', () => socket?.close());
      };

      void bootstrap().then(connect).catch(() => {
        sink.status('reconnecting');
        retryTimer = window.setTimeout(() => void bootstrap().then(connect), 2_000);
      });

      return () => {
        disposed = true;
        if (retryTimer) window.clearTimeout(retryTimer);
        socket?.close();
      };
    },
  };
}

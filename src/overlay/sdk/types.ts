/**
 * The overlay data contract: everything a theme can show, as one normalized snapshot.
 *
 * A source (the Durable Object socket, D1 bootstrap, or the mock) produces snapshots; the SDK derives
 * scores, streaks, clocks and leaderboards from them, so themes never do game maths. All times are
 * server epoch milliseconds. Field names follow the backend's public overlay state where they overlap
 * (endsAt, pausedAt, serverTime, revision, counter/gauge/flag metrics) so the adapter stays thin.
 */

export type Side = 'streamer' | 'chat';
export const SIDES: readonly Side[] = ['streamer', 'chat'];

/**
 * Where a session is. The control room's `new` is `idle` here; the backend's phases map as
 * collecting → open, voting → vote, ready → lock, live → live, complete → done.
 */
export type Stage = 'idle' | 'open' | 'vote' | 'lock' | 'live' | 'done';
export const STAGES: readonly Stage[] = ['idle', 'open', 'vote', 'lock', 'live', 'done'];

/** What the overlay should be showing: the stage, with the moment a winner is called split out of `live`. */
export type Scene = Stage | 'result';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'ridiculous';

export type Challenge = {
  id: string;
  title: string;
  objective: string;
  /** Who sent it in. */
  by: string;
  difficulty: Difficulty;
  /** Points to whichever side takes it. */
  points: number;
  /** Seconds, or null for untimed. */
  timeLimit: number | null;
  /** Tries the streamer gets, or null for unlimited. */
  maxAttempts: number | null;
  game?: string | null;
};

/**
 * A server-owned clock. Counts from `startsAt` (a future `startsAt` is a countdown to the start) and
 * runs out at `endsAt`, or counts up forever when that's null. Resuming shifts both ends forward by
 * the pause, so elapsed is always `(pausedAt ?? now) − startsAt`.
 */
export type Clock = {
  startsAt: number;
  endsAt: number | null;
  pausedAt: number | null;
};

export type Idea = { challenge: Challenge; at: number };

export type Submissions = {
  /** Chat can still send ideas. */
  open: boolean;
  /** How long submissions are meant to run. A guide only; it never closes anything. */
  clock: Clock | null;
  /** Newest first. */
  ideas: Idea[];
  /** The chat command, e.g. "!challenge". */
  command: string;
};

export type BallotEntry = { challenge: Challenge; votes: number };

export type Ballot = {
  clock: Clock;
  /** How many make the lineup. */
  winners: number;
  votesPerViewer: number;
  /** In the order they were put up: chat votes by this position, which doesn't change as votes come in. */
  entries: BallotEntry[];
  command: string;
};

/** How one lineup slot ended. `winner: null` is a skip. */
export type Result = { challengeId: string; winner: Side | null; attempts: number; took: number };

export type Round = {
  /** Into the lineup. */
  index: number;
  /** The challenge clock. A future `startsAt` is the pre-start countdown. */
  clock: Clock;
  /** The try in progress, from 1. */
  attempt: number;
  /** Set once a winner is called, until the next challenge starts. `next` counts down to it when auto-next is on. */
  call: { winner: Side; at: number; next: Clock | null } | null;
};

export type Session = {
  id: string;
  name: string | null;
  stage: Stage;
  startedAt: number;
  submissions: Submissions;
  ballot: Ballot | null;
  /** Play order, once locked. */
  lineup: Challenge[];
  /** One per slot played so far, in play order. */
  results: Result[];
  round: Round | null;
};

/** A finished session, for the season board. */
export type SessionRecord = {
  id: string;
  name: string;
  endedAt: number;
  points: Record<Side, number>;
  /** Challenges each side took. */
  wins: Record<Side, number>;
};

/** Someone whose ideas have been played, with their season standing before tonight. */
export type ChallengerStanding = {
  id: string;
  name: string;
  points: number;
  /** Their ideas that were played. */
  played: number;
  /** Of those, how many beat the streamer. */
  won: number;
};

/**
 * A live number or switch the board tracks beyond the game itself (kills, a follower goal, a flag).
 * Same kinds as the backend framework: a counter counts, a gauge moves toward a `target`, a flag is on or off.
 */
export type Metric = {
  id: string;
  kind: 'counter' | 'gauge' | 'flag';
  label: string;
  value: number | boolean;
  target: number | boolean | null;
};

export type Sponsor = { id: string; name: string; logoUrl?: string | null };

/** How challengers earn leaderboard points (the backend's `scoringRules.challenger`). */
export type Scoring = {
  /** For an idea making the lineup. */
  selectedPoints: number;
  /** For an idea the streamer fails. */
  defeatedPoints: number;
};

/**
 * What the overlay looks like and which elements are on. Lives in the snapshot so the control room can
 * change it live: an OBS browser source has no UI of its own.
 */
export type Display = {
  theme: string;
  /** Settings for `theme`, by key. Missing keys fall back to the theme's defaults. */
  settings: Record<string, unknown>;
  /** Overlay elements switched on, by element id. */
  elements: Record<string, boolean>;
};

export type OverlaySnapshot = {
  /** Bumped by the source on every change. */
  revision: number;
  /** The server's clock when this was sent, for skew correction. */
  serverTime: number;
  channel: { id: string; name: string; login: string };
  /** What each side is called on screen, and its colour if the board picked one. */
  sides: Record<Side, { name: string; color: string | null }>;
  /** The session in progress, through its results screen. Null between sessions. */
  session: Session | null;
  /** Finished sessions this season, newest first. */
  history: SessionRecord[];
  /** Season standings before tonight. */
  challengers: ChallengerStanding[];
  scoring: Scoring;
  metrics: Metric[];
  sponsors: Sponsor[];
  display: Display;
};

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

/* ───────────────────────── Events ───────────────────────── */

/**
 * Moments worth animating or playing a sound for. The SDK derives these by diffing snapshots, so a
 * source only has to send state; a source can also push its own (`custom`).
 */
export type OverlayEvent =
  | { type: 'stage'; from: Stage | null; to: Stage | null }
  | { type: 'idea'; challenge: Challenge }
  | { type: 'votes'; total: number; delta: number; leader: string | null }
  | { type: 'lineup'; lineup: Challenge[] }
  | { type: 'round.start'; challenge: Challenge; index: number }
  | { type: 'round.attempt'; challenge: Challenge; attempt: number; max: number | null }
  | { type: 'round.pause'; challenge: Challenge }
  | { type: 'round.resume'; challenge: Challenge }
  | { type: 'round.call'; challenge: Challenge; winner: Side; points: number }
  | { type: 'round.undo'; challenge: Challenge }
  | { type: 'round.end'; challenge: Challenge; winner: Side | null }
  | { type: 'lead'; leader: Side | null; from: Side | null }
  | { type: 'streak'; side: Side; count: number }
  | { type: 'session.end'; winner: Side | null; points: Record<Side, number> }
  | { type: 'metric'; id: string; value: number | boolean; from: number | boolean }
  | { type: 'goal'; id: string; value: number }
  | { type: 'custom'; name: string; data?: unknown };

export type OverlayEventType = OverlayEvent['type'];
export type EventOf<T extends OverlayEventType> = Extract<OverlayEvent, { type: T }>;

/* ───────────────────────── Sources ───────────────────────── */

/** Where a source sends what it hears. */
export type SourceSink = {
  /** Replace the whole state. */
  snapshot(next: OverlaySnapshot): void;
  /** Merge top-level parts, e.g. `{ session }` from the socket while `{ history, challengers }` come from D1. */
  patch(part: Partial<OverlaySnapshot>): void;
  /** Pass through a moment the snapshot can't express. */
  event(e: OverlayEvent): void;
  status(s: ConnectionStatus): void;
};

/**
 * Anything that can feed the overlay: the live Worker connection, a replay, or the mock. `connect` starts
 * it and returns a function that stops it.
 */
export type OverlaySource = {
  connect(sink: SourceSink): () => void;
};

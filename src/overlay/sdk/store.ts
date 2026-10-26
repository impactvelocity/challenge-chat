import { deriveBoard, deriveRound, type BoardModel, type RoundModel } from './derive';
import { diffEvents } from './events';
import type { ConnectionStatus, OverlayEvent, OverlaySnapshot, OverlaySource, SourceSink } from './types';

/** Before a source has said anything: an empty board, so hooks never see null. */
export const EMPTY_SNAPSHOT: OverlaySnapshot = {
  revision: 0,
  serverTime: 0,
  channel: { id: '', name: '', login: '' },
  sides: { streamer: { name: 'Streamer', color: null }, chat: { name: 'Chat', color: null } },
  session: null,
  history: [],
  challengers: [],
  scoring: { selectedPoints: 0, defeatedPoints: 0 },
  metrics: [],
  sponsors: [],
  display: { theme: '', settings: {}, elements: {} },
};

export type OverlayState = {
  snapshot: OverlaySnapshot;
  round: RoundModel;
  board: BoardModel;
  status: ConnectionStatus;
  /** A first snapshot has arrived. */
  ready: boolean;
};

type Listener = () => void;

/** How often time-reading hooks are checked. They only re-render when a shown second changes. */
const TICK_MS = 250;

/**
 * Holds the latest snapshot and what's derived from it, and a shared clock. React reads it through
 * `useOverlay`; it has no React in it, so a source, a test or a non-React overlay can drive it too.
 */
export class OverlayStore {
  private state: OverlayState;
  private offset = 0;
  private nowMs = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly timeListeners = new Set<Listener>();
  private readonly eventListeners = new Set<(e: OverlayEvent) => void>();

  constructor(initial?: OverlaySnapshot | null) {
    const snap = initial ?? EMPTY_SNAPSHOT;
    const round = deriveRound(snap);
    this.state = { snapshot: snap, round, board: deriveBoard(snap, round), status: 'connecting', ready: !!initial };
    if (initial) this.offset = initial.serverTime - Date.now();
  }

  get = () => this.state;

  /** Server time as of the last tick. Stable between ticks, as `useSyncExternalStore` needs. */
  now = () => this.nowMs;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };

  /** Ticks while anyone reads the clock. */
  subscribeTime = (l: Listener) => {
    this.timeListeners.add(l);
    if (!this.timer) {
      this.nowMs = Date.now() + this.offset;
      this.timer = setInterval(() => {
        this.nowMs = Date.now() + this.offset;
        for (const fn of this.timeListeners) fn();
      }, TICK_MS);
    }
    return () => {
      this.timeListeners.delete(l);
      if (!this.timeListeners.size && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  };

  onEvent = (l: (e: OverlayEvent) => void) => {
    this.eventListeners.add(l);
    return () => void this.eventListeners.delete(l);
  };

  emit = (e: OverlayEvent) => {
    for (const fn of this.eventListeners) fn(e);
  };

  setSnapshot = (next: OverlaySnapshot) => {
    const prev = this.state;
    // A late message from before a reconnect
    if (prev.ready && next.revision < prev.snapshot.revision) return;
    this.offset = next.serverTime - Date.now();
    this.nowMs = Date.now() + this.offset;
    const round = deriveRound(next);
    this.state = { ...prev, snapshot: next, round, board: deriveBoard(next, round), ready: true };
    const events = diffEvents(prev.ready ? prev.snapshot : null, next, prev.ready ? prev.round : null, round);
    for (const fn of this.listeners) fn();
    for (const e of events) this.emit(e);
  };

  patch = (part: Partial<OverlaySnapshot>) => {
    const s = this.state.snapshot;
    this.setSnapshot({ ...s, ...part, revision: part.revision ?? s.revision + 1, serverTime: part.serverTime ?? Date.now() + this.offset });
  };

  setStatus = (status: ConnectionStatus) => {
    if (status === this.state.status) return;
    this.state = { ...this.state, status };
    for (const fn of this.listeners) fn();
  };

  /** The sink a source writes to. */
  readonly sink: SourceSink = {
    snapshot: (s) => this.setSnapshot(s),
    patch: (p) => this.patch(p),
    event: (e) => this.emit(e),
    status: (s) => this.setStatus(s),
  };

  connect = (source: OverlaySource) => {
    const stop = source.connect(this.sink);
    return () => {
      stop();
      this.setStatus('offline');
    };
  };
}

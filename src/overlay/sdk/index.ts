/**
 * Overlay SDK: a provider that holds the board's live state, hooks that read it, and a theme registry.
 *
 *   <OverlayProvider source={source}>
 *     <OverlayRenderer />          // the theme from the snapshot's display config
 *   </OverlayProvider>
 *
 * Inside a theme: `useRound()` for the game loop (stage, lineup, live challenge, clock, attempts, score,
 * streaks), `useBoard()` for the season (totals, records, history, leaderboard, metrics), or the narrow
 * hooks when a piece only needs one thing. `useOverlayEvent()` for moments worth animating.
 */

export * from './types';
export { formatSeconds, readClock, viewClock, clockFrom, pauseClock, resumeClock, clockDone, type ClockView } from './clock';
export type { BallotRow, BoardModel, ChallengerRow, LineupSlot, MetricView, RoundModel, Score, SideScore, SessionSummary, Streak } from './derive';
export { deriveBoard, deriveRound } from './derive';
export { diffEvents } from './events';
export { EMPTY_SNAPSHOT, OverlayStore, type OverlayState } from './store';
export { OverlayProvider, useOverlay, useOverlayStore, shallowEqual, type Selection } from './provider';
export * from './hooks';
export * from './theme';
export { ElementOutlet, OverlayRenderer, SceneOutlet, useElementOn, useSceneKey, useThemeSettings, type PlacedElement } from './render';

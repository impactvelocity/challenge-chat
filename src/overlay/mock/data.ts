import { READY_DECK, REVIEW_QUEUE, type Challenge as AppChallenge } from '@/data/app';
import { clockFrom } from '@/overlay/sdk/clock';
import type { Challenge, Metric, OverlaySnapshot, Scene, Session, SessionRecord, Side } from '@/overlay/sdk/types';
import { SIDE_NAME } from '@/pages/main/Boards';
import { CHALLENGERS, HISTORY } from '@/data/board';
import type { EngineOptions } from './engine';

/** The mock board's season so far, and a session that can be dropped in at any stage. */

const toChallenge = (c: AppChallenge): Challenge => ({
  id: c.id,
  title: c.title,
  objective: c.objective,
  by: c.by,
  difficulty: c.difficulty,
  points: c.roundValue,
  timeLimit: c.timeLimit,
  maxAttempts: c.maxAttempts,
  game: c.game,
});

const extra = (id: string, title: string, objective: string, by: string, difficulty: Challenge['difficulty'], points: number, timeLimit: number | null, maxAttempts: number | null): Challenge => ({
  id,
  title,
  objective,
  by,
  difficulty,
  points,
  timeLimit,
  maxAttempts,
  game: 'Valorant',
});

/** Every idea chat might send, in the order they arrive. */
export const POOL: Challenge[] = [
  ...[...READY_DECK, ...REVIEW_QUEUE].map(toChallenge),
  extra('c_110', 'No Minimap', 'Win a round with the minimap turned off', 'nova_rx', 'medium', 500, 120, null),
  extra('c_111', 'Eco Every Round', 'Win 3 rounds without buying a rifle', 'pixelbrat', 'hard', 750, null, 3),
  extra('c_112', 'Sheriff Sniper', 'Get 3 headshot kills with the Sheriff in one round', 'lowkeyleo', 'hard', 750, 90, 1),
  extra('c_113', 'Backwards Walk', 'Walk backwards for an entire round', 'birb_watch', 'easy', 250, null, null),
  extra('c_114', 'One-Tap Only', 'Win a round where every kill is a one-tap headshot', 'kodawan', 'ridiculous', 1000, 120, 3),
  extra('c_115', 'Spray Painter', 'Win a round without letting go of the trigger once you start shooting', 'mossgirl', 'medium', 500, 90, 3),
  extra('c_116', 'Pacifist Plant', 'Plant the spike without getting a kill that round', 'quietqueen', 'medium', 500, 120, null),
  extra('c_117', 'Duck Hunt', 'Get two kills while crouched in one round', 'lowkeyleo', 'medium', 500, 120, 5),
];

const byTitle = (title: string) => POOL.find((c) => c.title === title)!;

export const SESSION_NAME = 'Blades & Bad Ideas';
/** Tonight's lineup in play order: the third is the one live, the last still to come. */
const LINEUP = ['Knife Only Round', 'Inverted 10', 'Crouch Walk Only', 'Silent Round'].map(byTitle);
const LIVE_AT = 2;
/** Who took the challenges before the live one, and the last one once the night's over. */
const DECIDED: Side[] = ['streamer', 'chat'];
const LAST: Side = 'chat';
const BALLOT: [Challenge, number][] = [
  [LINEUP[0], 84],
  [LINEUP[2], 71],
  [LINEUP[1], 58],
  [LINEUP[3], 44],
  [byTitle('Ace Attempt'), 19],
];

/** "Oct 22" + "7:30pm" → epoch ms. */
function when(date: string, time: string) {
  const d = new Date(`${date}, 2026`);
  const [, h, m, ap] = time.match(/(\d+):(\d+)(am|pm)/) ?? ['', '8', '00', 'pm'];
  d.setHours((Number(h) % 12) + (ap === 'pm' ? 12 : 0), Number(m));
  return d.getTime();
}

const history: SessionRecord[] = HISTORY.map((s, i) => ({
  id: `s_past_${i}`,
  name: s.name,
  endedAt: when(s.date, s.time),
  points: { streamer: s.streamer, chat: s.chat },
  wins: { streamer: s.bouts[0], chat: s.bouts[1] },
}));

export const KILLS: Metric = { id: 'kills', kind: 'counter', label: 'Kills', value: 0, target: null };
export const FOLLOWERS: Metric = { id: 'goal', kind: 'gauge', label: 'Follower goal', value: 842, target: 1000 };

/** Everything but the session and display config. */
export function mockBoard(now: number): Omit<OverlaySnapshot, 'session' | 'display'> {
  return {
    revision: 1,
    serverTime: now,
    channel: { id: 'ch_7k2m9q', name: 'Nova Plays', login: 'nova_plays' },
    sides: { streamer: { name: 'Nova Plays', color: null }, chat: { name: SIDE_NAME.chat, color: null } },
    history,
    challengers: CHALLENGERS.map((c) => ({ id: `u_${c.name}`, name: c.name, points: c.points, played: c.played, won: c.won })),
    scoring: { selectedPoints: 50, defeatedPoints: 100 },
    metrics: [KILLS, FOLLOWERS],
    sponsors: ['HYPERFUEL', 'Kestrel Gear', 'NORTHWIND', 'Pulse Audio', 'Glyph Seating'].map((name) => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name })),
  };
}

const ago = (now: number, secs: number) => now - secs * 1000;

/** A session dropped in mid-way through `scene`, like the control room's stage switcher. */
export function seedSession(scene: Scene, now: number, o: EngineOptions, winner: Side = 'streamer'): Session | null {
  if (scene === 'idle') return null;
  const ideas = POOL.filter((c) => !LINEUP.includes(c))
    .slice(0, 8)
    .concat(LINEUP)
    .map((challenge, i, all) => ({ challenge, at: ago(now, 95 - (i * 90) / all.length) }))
    .reverse();
  const base: Session = {
    id: 's_tonight',
    name: null,
    stage: 'open',
    startedAt: ago(now, 600),
    submissions: { open: true, clock: clockFrom(ago(now, 95), o.submitSecs), ideas, command: '!challenge' },
    ballot: null,
    lineup: [],
    results: [],
    round: null,
  };
  if (scene === 'open') return base;

  const ballot = {
    clock: clockFrom(ago(now, 27), o.voteSecs),
    winners: LINEUP.length,
    votesPerViewer: 1,
    entries: BALLOT.map(([challenge, votes]) => ({ challenge, votes })),
    command: '!vote',
  };
  const voting: Session = { ...base, stage: 'vote', submissions: { ...base.submissions, open: false }, ballot };
  if (scene === 'vote') return voting;

  const locked: Session = { ...voting, stage: 'lock', name: SESSION_NAME, lineup: LINEUP, ballot: { ...ballot, clock: clockFrom(ago(now, 120), o.voteSecs) } };
  if (scene === 'lock') return locked;

  const results = DECIDED.map((w, i) => ({ challengeId: LINEUP[i].id, winner: w, attempts: 1 + i, took: [212, 300][i] }));
  if (scene === 'done') {
    return {
      ...locked,
      stage: 'done',
      round: null,
      results: [...results, { challengeId: LINEUP[2].id, winner, attempts: 2, took: 141 }, { challengeId: LINEUP[3].id, winner: LAST, attempts: 2, took: 300 }],
    };
  }

  const c = LINEUP[LIVE_AT];
  const start = ago(now, 74);
  const live: Session = {
    ...locked,
    stage: 'live',
    results,
    round: { index: LIVE_AT, clock: clockFrom(start, c.timeLimit), attempt: 2, call: null },
  };
  if (scene === 'live') return live;

  return {
    ...live,
    round: { ...live.round!, clock: { ...live.round!.clock, pausedAt: now }, call: { winner, at: now, next: o.autoNext ? clockFrom(now, o.autoNextSecs) : null } },
  };
}

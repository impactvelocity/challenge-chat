import type { Challenger, Session } from '@/pages/main/Boards';

/** TG's season so far: the control room, the public page and the overlay mock all read it. */

/** Finished sessions, newest first. Includes flawless sweeps and a live win streak for TG. */
export const HISTORY: Session[] = [
  {
    name: 'Blindfolded Blitz',
    date: 'Oct 22',
    time: '7:30pm',
    streamer: 4250,
    chat: 3500,
    bouts: [7, 5],
  },
  {
    name: 'Pistols at Dawn',
    date: 'Oct 20',
    time: '8:00pm',
    streamer: 3500,
    chat: 0,
    bouts: [6, 0],
  },
  {
    name: "Chat Picks Everything: The Extended Director's Cut",
    date: 'Oct 17',
    time: '6:45pm',
    streamer: 5000,
    chat: 2250,
    bouts: [9, 3],
  },
  {
    name: 'Celeste Pain Run',
    date: 'Oct 15',
    time: '9:15pm',
    streamer: 1500,
    chat: 3250,
    bouts: [3, 6],
  },
  {
    name: 'No Heals, No Mercy',
    date: 'Oct 13',
    time: '3:00pm',
    streamer: 0,
    chat: 3000,
    bouts: [0, 5],
  },
  {
    name: 'Knife Fight Friday',
    date: 'Oct 10',
    time: '7:00pm',
    streamer: 2750,
    chat: 0,
    bouts: [5, 0],
  },
  {
    name: 'Elden Ring Gauntlet',
    date: 'Oct 8',
    time: '8:30pm',
    streamer: 2000,
    chat: 4500,
    bouts: [3, 8],
  },
];

/** Everyone whose ideas have been played, for the top-challengers board. */
export const CHALLENGERS: Challenger[] = [
  { name: 'nova_rx', points: 2140, played: 14, won: 9 },
  { name: 'kodawan', points: 1890, played: 12, won: 7 },
  { name: 'pixelbrat', points: 1655, played: 11, won: 6 },
  { name: 'mossgirl', points: 1420, played: 9, won: 5 },
  { name: 'teaandtoast', points: 1275, played: 8, won: 5 },
  { name: 'birb_watch', points: 1110, played: 9, won: 3 },
  { name: 'lowkeyleo', points: 980, played: 7, won: 4 },
  { name: 'quietqueen', points: 845, played: 6, won: 2 },
  { name: 'fragqueen', points: 720, played: 5, won: 3 },
  { name: 'sneakybeak', points: 610, played: 5, won: 1 },
  { name: 'latecomer99', points: 240, played: 2, won: 0 },
];

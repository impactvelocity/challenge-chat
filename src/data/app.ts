/**
 * Mock data for the /app screens. Shapes follow the real contracts in
 * codex-twitch/shared (Challenge, Ballot, Leaderboard, ChannelSummary) closely
 * enough that swapping in the API client later is mostly renaming.
 */

export type Role = 'owner' | 'mod';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'ridiculous';

export const DIFFICULTIES: { value: Difficulty; label: string; points: number }[] = [
  { value: 'easy', label: 'Easy', points: 250 },
  { value: 'medium', label: 'Medium', points: 500 },
  { value: 'hard', label: 'Hard', points: 750 },
  { value: 'ridiculous', label: 'Ridiculous', points: 1000 },
];

export type Challenge = {
  id: string;
  title: string;
  objective: string;
  rawText: string;
  by: string;
  game: string | null;
  difficulty: Difficulty;
  timeLimit: number | null;
  maxAttempts: number | null;
  roundValue: number;
  parser: 'ai' | 'fallback';
  constraints: string[];
  warnings: string[];
};

export type Channel = {
  id: string;
  displayName: string;
  slug: string;
  broadcasterLogin: string;
  live: boolean;
  review: number;
  ready: number;
  mods: number;
  score: { streamer: number; chat: number };
  lastActive: string;
  /** Moderators only see channels they are assigned to. */
  assignedToMod: boolean;
};

export const CHANNELS: Channel[] = [
  {
    id: 'ch_7k2m9q',
    displayName: 'Nova Plays',
    slug: 'nova-plays',
    broadcasterLogin: 'nova_plays',
    live: true,
    review: 4,
    ready: 6,
    mods: 3,
    score: { streamer: 2250, chat: 3500 },
    lastActive: 'Live now',
    assignedToMod: true,
  },
  {
    id: 'ch_p4w8zd',
    displayName: 'Nova Speedruns',
    slug: 'nova-speedruns',
    broadcasterLogin: 'nova_plays',
    live: false,
    review: 0,
    ready: 11,
    mods: 1,
    score: { streamer: 0, chat: 0 },
    lastActive: '2 days ago',
    assignedToMod: true,
  },
  {
    id: 'ch_t1x6bn',
    displayName: 'Friday Co-op Night',
    slug: 'friday-coop',
    broadcasterLogin: 'nova_plays',
    live: false,
    review: 2,
    ready: 3,
    mods: 0,
    score: { streamer: 0, chat: 0 },
    lastActive: 'Oct 18',
    assignedToMod: false,
  },
];

export const REVIEW_QUEUE: Challenge[] = [
  {
    id: 'c_101',
    title: 'Pistol Purist',
    objective: 'Win the next round using only pistols',
    rawText: 'win a round with only pistols no excuses',
    by: 'nova_rx',
    game: 'Valorant',
    difficulty: 'medium',
    timeLimit: 600,
    maxAttempts: 3,
    roundValue: 500,
    parser: 'ai',
    constraints: ['Loadout: pistols only'],
    warnings: [],
  },
  {
    id: 'c_102',
    title: 'No Heals Run',
    objective: 'Finish the next match without using a healing item',
    rawText: 'no healing for the whole next match lol and also do it blindfolded maybe??',
    by: 'pixelbrat',
    game: 'Apex Legends',
    difficulty: 'hard',
    timeLimit: null,
    maxAttempts: 1,
    roundValue: 750,
    parser: 'ai',
    constraints: ['No healing items'],
    warnings: ['Ignored a second, optional request (“blindfolded maybe”)', 'No time limit given — set one or leave untimed'],
  },
  {
    id: 'c_103',
    title: 'Inverted 10',
    objective: 'Play for 10 minutes with inverted look controls',
    rawText: 'inverted controls for 10 min',
    by: 'kodawan',
    game: null,
    difficulty: 'easy',
    timeLimit: 600,
    maxAttempts: null,
    roundValue: 250,
    parser: 'fallback',
    constraints: ['Input: inverted Y-axis'],
    warnings: ['Parsed without AI — check the objective reads well on stream'],
  },
  {
    id: 'c_104',
    title: 'Five Stack Streak',
    objective: 'Get 5 eliminations in a row without dying',
    rawText: '5 kills in a row no deaths',
    by: 'teaandtoast',
    game: 'Valorant',
    difficulty: 'hard',
    timeLimit: 900,
    maxAttempts: 3,
    roundValue: 750,
    parser: 'ai',
    constraints: [],
    warnings: [],
  },
];

export const READY_DECK: Challenge[] = [
  {
    id: 'c_090',
    title: 'Knife Only Round',
    objective: 'Win one round using only your melee weapon',
    rawText: 'knife only round',
    by: 'mossgirl',
    game: 'Valorant',
    difficulty: 'hard',
    timeLimit: 300,
    maxAttempts: 3,
    roundValue: 750,
    parser: 'ai',
    constraints: ['Loadout: melee only'],
    warnings: [],
  },
  {
    id: 'c_091',
    title: 'Nature Doc',
    objective: 'Narrate the next round like a wildlife documentary',
    rawText: 'narrate like david attenborough',
    by: 'birb_watch',
    game: null,
    difficulty: 'easy',
    timeLimit: 240,
    maxAttempts: null,
    roundValue: 250,
    parser: 'ai',
    constraints: [],
    warnings: [],
  },
  {
    id: 'c_092',
    title: 'Ace Attempt',
    objective: 'Eliminate the entire enemy team by yourself in one round',
    rawText: 'get an ace',
    by: 'nova_rx',
    game: 'Valorant',
    difficulty: 'ridiculous',
    timeLimit: 900,
    maxAttempts: 5,
    roundValue: 1000,
    parser: 'ai',
    constraints: [],
    warnings: [],
  },
  {
    id: 'c_093',
    title: 'Crouch Walk Only',
    objective: 'Win a round without ever standing up',
    rawText: 'crouch the whole round',
    by: 'lowkeyleo',
    game: 'Valorant',
    difficulty: 'medium',
    timeLimit: 300,
    maxAttempts: 3,
    roundValue: 500,
    parser: 'fallback',
    constraints: ['Movement: crouch only'],
    warnings: [],
  },
  {
    id: 'c_094',
    title: 'Chat Picks Agent',
    objective: 'Play the next match on whichever agent chat picks',
    rawText: 'we pick your agent next game',
    by: 'kodawan',
    game: 'Valorant',
    difficulty: 'easy',
    timeLimit: null,
    maxAttempts: 1,
    roundValue: 250,
    parser: 'ai',
    constraints: [],
    warnings: [],
  },
  {
    id: 'c_095',
    title: 'Silent Round',
    objective: 'Win a round without saying a single word',
    rawText: 'dont talk for a whole round',
    by: 'quietqueen',
    game: null,
    difficulty: 'medium',
    timeLimit: 300,
    maxAttempts: 2,
    roundValue: 500,
    parser: 'ai',
    constraints: [],
    warnings: [],
  },
];

export type Moderator = { id: string; name: string; added: string; lastSeen: string; online: boolean };

export const MODERATORS: Moderator[] = [
  { id: 'u_1', name: 'pixelbrat', added: 'Sep 2', lastSeen: 'Online now', online: true },
  { id: 'u_2', name: 'mossgirl', added: 'Sep 14', lastSeen: '3 hours ago', online: false },
  { id: 'u_3', name: 'kodawan', added: 'Oct 9', lastSeen: 'Yesterday', online: false },
];

/** Deployment checks shown on the first-run screen (bindings from wrangler.jsonc). */
export const SETUP_CHECKS = [
  { id: 'db', kind: 'D1', name: 'DB', note: 'Database bound · migrations applied', required: true },
  { id: 'do', kind: 'DO', name: 'LIVE_SESSIONS', note: 'Durable Object bound', required: true },
  { id: 'r2', kind: 'R2', name: 'ASSETS_BUCKET', note: 'Bucket bound', required: true },
  { id: 'owner', kind: 'D1', name: 'OWNER PROFILE', note: 'Created during first-run setup', required: true },
  { id: 'openai', kind: 'SECRET', name: 'OPENAI_API_KEY', note: 'Not set — the fallback parser will be used', required: false },
] as const;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export const ORIGIN = 'https://challenge.nova.workers.dev';

/** The product site, opened from logos and footer links. */
export const SITE = 'https://challenge.chat';

/** How long a vote can run, in seconds. Shared by the live vote picker and the channel default. */
export const VOTE_LENGTHS = [
  { value: '300', label: '5 min' },
  { value: '600', label: '10 min' },
  { value: '900', label: '15 min' },
];

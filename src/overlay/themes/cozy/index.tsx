import { defineTheme } from '@/overlay/sdk';
import { COMMON, styledLayout } from '../kit';
import { Goal, TodoNote } from './elements';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from './scenes';
import { SETTINGS } from './settings';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/caveat';
import './cozy.css';

export const cozy = defineTheme({
  id: 'cozy',
  name: 'Cozy Corner',
  description: 'Warm paper cards, soft shadows, gentle motion and handwritten notes, with a sticky-note to-do list. For farming, crafting, life sims and chill streams',
  settings: SETTINGS,
  Layout: styledLayout('cozy'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  // Stack order is the order here
  elements: {
    scoreboard: COMMON.scoreboard,
    todo: { label: 'To-Do Note', description: "Tonight's lineup as a sticky-note checklist, under the scoreboard", region: 'stack', on: true, Component: TodoNote },
    goal: { ...COMMON.goal, Component: Goal },
    leaderboard: COMMON.leaderboard,
    kills: COMMON.kills,
    alerts: COMMON.alerts,
    sponsor: COMMON.sponsor,
  },
});

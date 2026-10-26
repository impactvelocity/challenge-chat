import { defineTheme } from '@/overlay/sdk';
import { COMMON, styledLayout } from '../kit';
import { Goal, ImpactWords, Scoreboard } from './elements';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from './scenes';
import { SETTINGS } from './settings';
import '@fontsource/bangers/latin-400.css';
import '@fontsource/comic-neue/latin-700.css';
import './comic.css';

export const comic = defineTheme({
  id: 'comic',
  name: 'Comic Chaos',
  description: 'Inked comic panels, halftones, speech bubbles and POW-sized impact words with springy motion. For party games, comedy, multiplayer and reaction streams',
  settings: SETTINGS,
  Layout: styledLayout('comic'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  elements: {
    ...COMMON,
    scoreboard: { ...COMMON.scoreboard, description: 'Both sides as inked name plates with big outlined scores', Component: Scoreboard },
    goal: { ...COMMON.goal, Component: Goal },
    impact: { label: 'Impact Words', description: 'POW! BAM! KAPOW! on calls, lead changes, streaks, goals and raids', region: 'fx', Component: ImpactWords },
  },
});

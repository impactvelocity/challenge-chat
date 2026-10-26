import { defineTheme } from '@/overlay/sdk';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from '../broadcast/scenes';
import { COMMON, styledLayout } from '../kit';
import { ComboPops, VsBar } from './elements';
import { SETTINGS } from './settings';
import '@fontsource/bungee/latin-400.css';
import './arcade.css';

export const arcade = defineTheme({
  id: 'arcade',
  name: 'Arcade Clash',
  description: 'Loud and playful: chunky type, sticker panels, fighting-game health bars and combo pops. For platformers, retro games, speedruns and variety streams',
  settings: SETTINGS,
  Layout: styledLayout('arcade'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  elements: {
    ...COMMON,
    scoreboard: { ...COMMON.scoreboard, description: 'Streamer vs Chat health bars, top centre', region: 'banner', Component: VsBar },
    combo: { label: 'Combo Pops', description: 'STAGE CLEAR on every call and COMBO bursts on win streaks', region: 'fx', on: true, Component: ComboPops },
  },
});

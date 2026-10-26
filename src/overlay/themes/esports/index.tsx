import { defineTheme } from '@/overlay/sdk';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from '../broadcast/scenes';
import { COMMON, styledLayout } from '../kit';
import { HudScore, MatchStatus } from './elements';
import { SETTINGS } from './settings';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import './esports.css';

export const esports = defineTheme({
  id: 'esports',
  name: 'Esports Command',
  description: 'A precise tactical HUD: chamfered panels, hairlines, status lights and mono numerals in a serious competitive tone. For FPS, MOBAs, battle royale and tactical games',
  settings: SETTINGS,
  Layout: styledLayout('esports'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  elements: {
    ...COMMON,
    scoreboard: { ...COMMON.scoreboard, description: 'A compact HUD score with wins, points and the lead', Component: HudScore },
    status: { label: 'Match Status', description: 'A slim strip, top centre: live state, stage, clock, tries and link', region: 'banner', on: true, Component: MatchStatus },
  },
});

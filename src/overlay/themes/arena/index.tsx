import { defineTheme } from '@/overlay/sdk';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from '../broadcast/scenes';
import { COMMON, styledLayout } from '../kit';
import { ReplaySting, ScoreBug } from './elements';
import { SETTINGS } from './settings';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import './arena.css';

export const arena = defineTheme({
  id: 'arena',
  name: 'Arena',
  description: 'A polished TV-sports package: score bug, condensed type, team colours and replay stings. For sports, racing, fighters and tournaments',
  settings: SETTINGS,
  Layout: styledLayout('arena'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  elements: {
    ...COMMON,
    scoreboard: { ...COMMON.scoreboard, description: 'A TV score bug with the clock, top corner', region: 'corner', Component: ScoreBug },
    replay: { label: 'Replay Sting', description: 'A team-coloured wipe across the frame on every call', region: 'fx', Component: ReplaySting },
  },
});

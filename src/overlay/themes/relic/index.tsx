import { defineTheme } from '@/overlay/sdk';
import { IdeasScene, LineupScene, RecapScene, VoteScene } from '../broadcast/scenes';
import { COMMON, styledLayout } from '../kit';
import { DoomClock } from './elements';
import { LiveScene, ResultScene } from './scenes';
import { SETTINGS } from './settings';
import '@fontsource/pirata-one/latin-400.css';
import '@fontsource-variable/oswald';
import './relic.css';

export const relic = defineTheme({
  id: 'relic',
  name: 'Dark Relic',
  description: 'Cinematic darkness: torn, grainy panels, gothic type, candle flicker and a doom clock. For horror, survival, gothic games and dark fantasy',
  settings: SETTINGS,
  Layout: styledLayout('relic'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  // Doom Clock leads the corner; the kill counter sits under it
  elements: {
    doom: { label: 'Doom Clock', description: 'An ominous timer for the live challenge, top corner', region: 'corner', on: true, Component: DoomClock },
    ...COMMON,
  },
});

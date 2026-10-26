import { defineTheme } from '@/overlay/sdk';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from '../broadcast/scenes';
import { COMMON, styledLayout } from '../kit';
import { HypeMeter } from './elements';
import { SETTINGS } from './settings';
import '@fontsource-variable/unbounded';
import './neon.css';

const { scoreboard, ...rest } = COMMON;

export const neon = defineTheme({
  id: 'neon',
  name: 'Creator Neon',
  description: 'Glowing glass frames on deep indigo, luminous streamer-to-chat gradients, scan lines and fluid electric motion. For cyberpunk, sci-fi, rhythm games and colourful VTubers',
  settings: SETTINGS,
  Layout: styledLayout('neon'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  // Stack order is the order here: the hype meter rides right under the score
  elements: {
    scoreboard,
    hype: { label: 'Hype Meter', description: 'A glowing meter that charges with chat activity, under the scoreboard', region: 'stack', Component: HypeMeter },
    ...rest,
  },
});

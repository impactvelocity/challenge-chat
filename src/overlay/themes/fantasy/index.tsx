import { defineTheme } from '@/overlay/sdk';
import { COMMON, styledLayout } from '../kit';
import { FramedAlerts, FramedCounter, FramedLeaderboard, FramedScoreboard, Goal, QuestLog } from './elements';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from './scenes';
import { SETTINGS } from './settings';
import '@fontsource-variable/cinzel';
import '@fontsource-variable/eb-garamond';
import './fantasy.css';

export const fantasy = defineTheme({
  id: 'fantasy',
  name: 'Fantasy Quest',
  description: 'Illustrated quest cards on parchment or jewel tones, gold ornaments and magical reveals; every challenge is a quest. For RPGs, MMOs, adventures and fantasy VTubers',
  settings: SETTINGS,
  Layout: styledLayout('fantasy'),
  scenes: { open: IdeasScene, vote: VoteScene, lock: LineupScene, live: LiveScene, result: ResultScene, done: RecapScene },
  // Stack order is the order here
  elements: {
    scoreboard: { ...COMMON.scoreboard, description: 'The streamer-versus-chat tally, top of the stack', Component: FramedScoreboard },
    quests: { label: 'Quest Log', description: "Tonight's quests with what became of each, under the scoreboard", region: 'stack', Component: QuestLog },
    goal: { ...COMMON.goal, Component: Goal },
    leaderboard: { ...COMMON.leaderboard, Component: FramedLeaderboard },
    kills: { ...COMMON.kills, Component: FramedCounter },
    alerts: { ...COMMON.alerts, Component: FramedAlerts },
    sponsor: COMMON.sponsor,
  },
});

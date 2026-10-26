import { useMemo, type CSSProperties } from 'react';
import { defineTheme, ElementOutlet, SceneOutlet, useConnection, useElementOn, useSides } from '@/overlay/sdk';
import { accentVars } from '@/theme/accent';
import { Alerts, Counter, Goal, Leaderboard, Scoreboard, SponsorBar } from './elements';
import { IdeasScene, LineupScene, LiveScene, RecapScene, ResultScene, VoteScene } from './scenes';
import { SETTINGS, useBroadcastSettings } from './settings';
import '@/scoreboard/scoreboard.css';
import './broadcast.css';

/** A colour's full shade set under `prefix` (--a… for the streamer, --c… for chat), or nothing to follow the board. */
function shades(prefix: '--a' | '--c', hex: string | null) {
  return hex ? Object.fromEntries(Object.entries(accentVars(hex)).map(([k, v]) => [k.replace('--a', prefix), v])) : {};
}

/**
 * Regions: `corner` (top, opposite the stack), `stack` (folds elements in and out down one side),
 * `top` (alerts, top centre), `bottom` (full-width strip). Scenes place themselves: challenge cards low on the stack's far side,
 * big moments in the middle.
 */
function Layout() {
  const s = useBroadcastSettings();
  const sides = useSides();
  const sponsor = useElementOn('sponsor');
  const status = useConnection();
  const style = useMemo(
    () =>
      ({
        ...shades('--a', s.streamerColor ?? sides.streamer.color),
        ...shades('--c', s.chatColor ?? sides.chat.color),
        '--bc-radius': `${s.radius}px`,
        '--bc-alpha': s.panel / 100,
        '--bc-scale': s.scale / 100,
      }) as CSSProperties,
    [s.streamerColor, s.chatColor, s.radius, s.panel, s.scale, sides],
  );

  return (
    <div className="bc" data-density={s.density} data-motion={s.motion} data-side={s.side} data-sponsor={sponsor || undefined} style={style}>
      <div className="bc-corner flex flex-col gap-4">
        <ElementOutlet region="corner">
          {(el) => (
            <div className="bc-pop" data-on={el.on || undefined} aria-hidden={!el.on}>
              <el.Component />
            </div>
          )}
        </ElementOutlet>
      </div>
      <div className="bc-stack">
        <ElementOutlet region="stack">
          {(el) => (
            <div className="bc-slot" data-on={el.on || undefined} aria-hidden={!el.on}>
              <div className="bc-slot-in">
                <el.Component />
              </div>
            </div>
          )}
        </ElementOutlet>
      </div>
      <div className="bc-top">
        <ElementOutlet region="top">
          {(el) => (
            <div className="bc-top-in" data-on={el.on || undefined} aria-hidden={!el.on}>
              <el.Component />
            </div>
          )}
        </ElementOutlet>
      </div>
      <SceneOutlet />
      <ElementOutlet region="bottom">
        {(el) => (
          <div className="bc-bottom" data-on={el.on || undefined} aria-hidden={!el.on}>
            <el.Component />
          </div>
        )}
      </ElementOutlet>
      {status === 'reconnecting' && <div className="bc-offline">Reconnecting</div>}
    </div>
  );
}

export const broadcast = defineTheme({
  id: 'broadcast',
  name: 'Broadcast',
  description: 'Sports-TV slabs with a team-coloured edge',
  settings: SETTINGS,
  Layout,
  scenes: {
    open: IdeasScene,
    vote: VoteScene,
    lock: LineupScene,
    live: LiveScene,
    result: ResultScene,
    done: RecapScene,
  },
  // Stack order is the order here
  elements: {
    scoreboard: { label: 'Scoreboard', description: 'The streamer-versus-chat score in the top corner', region: 'stack', on: true, Component: Scoreboard },
    goal: { label: 'Follower Goal', description: 'Progress toward the next follower goal, under the scoreboard', region: 'stack', group: 'Custom', Component: Goal },
    leaderboard: { label: 'Leaderboard', description: 'Top challengers by points, down one side', region: 'stack', Component: Leaderboard },
    kills: { label: 'Kill Counter', description: 'A live kill count for the current challenge', region: 'corner', group: 'Custom', Component: Counter },
    alerts: { label: 'Alerts', description: 'Follows, subs, gifts, raids and cheers, top centre', region: 'top', on: true, Component: Alerts },
    sponsor: { label: 'Sponsor Banner', description: 'The sponsor bar along the bottom edge', region: 'bottom', group: 'Custom', Component: SponsorBar },
  },
});

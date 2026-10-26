import { useMemo, type CSSProperties } from 'react';
import { ElementOutlet, SceneOutlet, useConnection, useElementOn, useSides, useThemeContext, type ElementDef, type SettingsSchema } from '@/overlay/sdk';
import { accentVars } from '@/theme/accent';
import { Alerts, Counter, Goal, Leaderboard, Scoreboard, SponsorBar } from '../broadcast/elements';
import '@/scoreboard/scoreboard.css';
import '../broadcast/broadcast.css';
import './kit.css';

/*
 * The styled themes (Arena, Arcade Clash, Creator Neon…) share Broadcast's scenes, elements and markup, and
 * restyle them from their own stylesheet under `.sk[data-skin='…']`. Each adds a few settings of its own and
 * swaps in components where its idea needs different markup.
 */

/** What every styled theme carries: each side's colour, which side the stack sits on, and size. */
export const CORE = {
  streamerColor: { type: 'color', label: 'Streamer colour', default: null, group: 'Colour', description: 'Unset follows the board' },
  chatColor: { type: 'color', label: 'Chat colour', default: null, group: 'Colour', description: 'Unset follows the board' },
  side: {
    type: 'select',
    label: 'Stack side',
    default: 'right',
    group: 'Layout',
    description: 'The scoreboard and its stack sit here; challenge cards take the other side',
    options: [
      { value: 'left', label: 'Left' },
      { value: 'right', label: 'Right' },
    ],
  },
  scale: { type: 'number', label: 'Size', default: 100, min: 80, max: 125, step: 5, unit: '%', group: 'Layout' },
} as const satisfies SettingsSchema;

/**
 * The conventional elements, drawn by Broadcast's components and restyled by the skin. A theme spreads these
 * and overrides any it draws itself; keeping the ids means a streamer's switches carry over between themes.
 */
export const COMMON = {
  scoreboard: { label: 'Scoreboard', description: 'The streamer-versus-chat score', region: 'stack', Component: Scoreboard },
  goal: { label: 'Follower Goal', description: 'Progress toward the next follower goal', region: 'stack', group: 'Custom', Component: Goal },
  leaderboard: { label: 'Leaderboard', description: 'Top challengers by points', region: 'stack', Component: Leaderboard },
  kills: { label: 'Kill Counter', description: 'A live kill count for the current challenge', region: 'corner', group: 'Custom', Component: Counter },
  alerts: { label: 'Alerts', description: 'Follows, subs, gifts, raids and cheers, top centre', region: 'top', Component: Alerts },
  sponsor: { label: 'Sponsor Banner', description: 'The sponsor bar along the bottom edge', region: 'bottom', group: 'Custom', Component: SponsorBar },
} satisfies Record<string, ElementDef>;

const kebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** A colour's full shade set under `prefix` (--a… for the streamer, --c… for chat), or nothing to follow the board. */
function shades(prefix: '--a' | '--c', hex: string | null) {
  return hex ? Object.fromEntries(Object.entries(accentVars(hex)).map(([k, v]) => [k.replace('--a', prefix), v])) : {};
}

/**
 * A theme's own settings as hooks for its stylesheet: selects and booleans become `data-*` attributes on the root
 * (`data-surface="jewel"`, `data-scanlines`), numbers become `--sk-*` variables (percentages as 0–1).
 */
function skinAttrs(schema: SettingsSchema, values: Record<string, unknown>) {
  const data: Record<string, string | undefined> = {};
  const vars: Record<string, number> = {};
  for (const [key, d] of Object.entries(schema)) {
    if (key in CORE) continue;
    const v = values[key];
    if (d.type === 'select') data[`data-${kebab(key)}`] = String(v);
    else if (d.type === 'boolean') data[`data-${kebab(key)}`] = v ? '' : undefined;
    else if (d.type === 'number') vars[`--sk-${kebab(key)}`] = d.unit === '%' ? Number(v) / 100 : Number(v);
  }
  return { data, vars };
}

/**
 * The shared Layout, under `.bc.sk[data-skin=skin]`. Regions:
 * `corner` (top, opposite the stack), `stack` (folds in and out down one side), `banner` (top centre, full width
 * of its content), `top` (alerts, under the banner), `bottom` (full-width strip) and `fx` (the whole frame, above
 * everything, for moments; its elements only mount while on).
 */
export function styledLayout(skin: string) {
  function Layout() {
    const { theme, settings } = useThemeContext();
    const s = settings as { streamerColor: string | null; chatColor: string | null; side: string; scale: number };
    const sides = useSides();
    const sponsor = useElementOn('sponsor');
    const status = useConnection();
    const { data, vars } = useMemo(() => skinAttrs(theme.settings, settings), [theme.settings, settings]);
    const style = useMemo(
      () =>
        ({
          ...shades('--a', s.streamerColor ?? sides.streamer.color),
          ...shades('--c', s.chatColor ?? sides.chat.color),
          '--bc-scale': s.scale / 100,
          ...vars,
        }) as CSSProperties,
      [s.streamerColor, s.chatColor, s.scale, sides, vars],
    );

    return (
      <div className="bc sk" data-skin={skin} data-side={s.side} data-sponsor={sponsor || undefined} {...data} style={style}>
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
        <div className="sk-head">
          <ElementOutlet region="banner">
            {(el) => (
              <div className="sk-banner" data-on={el.on || undefined} aria-hidden={!el.on}>
                <div className="sk-banner-in">
                  <el.Component />
                </div>
              </div>
            )}
          </ElementOutlet>
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
        <div className="sk-fx" aria-hidden="true">
          <ElementOutlet region="fx">{(el) => el.on && <el.Component />}</ElementOutlet>
        </div>
        {status === 'reconnecting' && <div className="bc-offline">Reconnecting</div>}
      </div>
    );
  }
  Layout.displayName = `${skin}Layout`;
  return Layout;
}

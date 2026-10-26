import { useState } from 'react';
import { SIDES, useAttempts, useClock, useConnection, useLineup, useOverlayEvent, useScene, useScore, useSeason, useSides, useStage, useStreak, type Side } from '@/overlay/sdk';
import { fmt, Num } from '@/scoreboard/parts';

/** A compact HUD scoreboard: wins and points per side, the lead, and a segment per challenge. */
export function HudScore() {
  const stage = useStage();
  const { score, leader, lead } = useScore();
  const { current: streak } = useStreak();
  const { slots, progress } = useLineup();
  const season = useSeason();
  const sides = useSides();
  const [flash, setFlash] = useState<{ side: string | null; n: number }>({ side: null, n: 0 });
  useOverlayEvent('lead', (e) => setFlash((f) => ({ side: e.leader, n: f.n + 1 })));

  // Before the lineup's played, the board carries the season instead of tonight's 0–0
  const tonight = stage === 'live' || stage === 'done';
  const value = (side: Side) => (tonight ? score[side].points : season.totals[side].sessions);

  return (
    <div className="bc-card es-score">
      <div className="es-head">
        <span>{tonight ? (stage === 'done' ? 'Final' : 'Match') : 'Season'}</span>
        <span className="bc-num ml-auto">{tonight ? `C${stage === 'done' ? progress.played : progress.number}/${progress.total}` : `${season.history.length} SES`}</span>
      </div>
      {SIDES.map((side) => (
        <div key={side} className="es-row" data-side={side} data-lead={(tonight && leader === side) || undefined} data-flash={side === flash.side ? (flash.n % 2 ? 'a' : 'b') : undefined}>
          <i className="es-chip" />
          <b className="es-name">{sides[side].name}</b>
          {tonight && streak.side === side && streak.count >= 2 && (
            <span key={streak.count} className="es-streak">
              {streak.count}W
            </span>
          )}
          {tonight && <span className="bc-num es-w">{score[side].wins}W</span>}
          <Num value={value(side)} className="bc-num es-n" />
        </div>
      ))}
      {tonight && (
        <div className="es-foot">
          <span className="es-lead">{leader ? `${sides[leader].name} +${fmt(lead)}` : 'Level'}</span>
          <div className="es-segs" aria-hidden="true">
            {slots.map((slot) => (
              <i
                key={slot.challenge.id}
                data-side={slot.winner ?? undefined}
                data-skip={slot.skipped || undefined}
                data-live={(slot.status === 'live' && !slot.winner) || undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const STAGE_LABEL = { idle: 'Standby', open: 'Ideas', vote: 'Voting', lock: 'Lineup', result: 'Result', done: 'Final' } as const;

/** The slim strip along the top: live or standby, where the session is, its clock, tries left, and the link to the board. */
export function MatchStatus() {
  const scene = useScene();
  const status = useConnection();
  const { progress } = useLineup();
  const attempts = useAttempts();
  const clocks = { round: useClock('round'), ballot: useClock('ballot'), submissions: useClock('submissions'), next: useClock('next') };

  const live = scene === 'open' || scene === 'vote' || scene === 'live' || scene === 'result';
  const label = scene === 'live' ? `Challenge ${progress.number}/${progress.total}` : STAGE_LABEL[scene];
  const clock = scene === 'live' ? clocks.round : scene === 'vote' ? clocks.ballot : scene === 'open' ? clocks.submissions : scene === 'result' ? clocks.next : null;
  const shown = clock && !clock.expired ? clock : null;
  const low = !!shown && shown.remaining != null && shown.remaining <= (scene === 'live' ? 30 : 10);
  const tries = scene === 'live' && attempts?.max != null && attempts.max > 1 ? attempts : null;

  return (
    <div className="es-status">
      <span className="es-cell" data-live={live || undefined}>
        <i className="es-led" />
        {live ? 'Live' : 'Standby'}
      </span>
      <span className="es-cell es-stage">{label}</span>
      {shown && (
        <span className="es-cell es-time bc-num" data-low={low || undefined} data-paused={shown.paused || undefined}>
          {shown.text}
        </span>
      )}
      {tries && tries.max != null && (
        <span className="es-cell">
          Try
          <span className="es-tries" aria-label={`Try ${tries.current} of ${tries.max}`}>
            {Array.from({ length: tries.max }, (_, i) => (
              <i key={i} data-used={i < tries.current - 1 || undefined} data-on={i === tries.current - 1 || undefined} />
            ))}
          </span>
        </span>
      )}
      <span className="es-cell es-link" data-status={status}>
        <i className="es-led" />
        Link
      </span>
    </div>
  );
}

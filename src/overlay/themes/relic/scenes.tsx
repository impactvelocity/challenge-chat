import { useChallenge, useLineup, useOverlaySelector, useSides } from '@/overlay/sdk';
import { fmt, LiveDot } from '@/scoreboard/parts';
import { Center, Lower, Pips } from '../broadcast/parts';
import { useBroadcastSettings } from '../broadcast/settings';

/* Broadcast's live and result scenes with horror copy: challenges are trials, a call is a survival or a soul taken. */

export function LiveScene() {
  const { challenge: c, phase, clock, countdown, attempts } = useChallenge();
  const { progress } = useLineup();
  if (!c || !clock) return null;
  const low = phase === 'playing' && clock.remaining != null && clock.remaining <= 30;
  return (
    <Lower wide>
      <div className="bc-kicker">
        {phase === 'playing' && <LiveDot />} Trial {progress.number} of {progress.total}
        <span className="dr-by ml-auto">offered by {c.by}</span>
      </div>
      <div className="mt-4 flex items-end gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="bc-title bc-t1">{c.title}</div>
          <p className="bc-sub">{c.objective}</p>
        </div>
        {phase === 'countdown' ? (
          <div className="bc-clock">
            <span key={countdown} className="bc-num bc-count">
              {countdown}
            </span>
            <span className="bc-clock-l">Brace</span>
          </div>
        ) : (
          <div className="bc-clock" data-low={low || undefined} data-paused={phase === 'paused' || undefined}>
            <span className="bc-num">{clock.text}</span>
            <span className="bc-clock-l">{clock.remaining != null ? 'Left' : 'Endured'}</span>
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="bc-tag bc-num">+{fmt(c.points)} pts</span>
        {attempts?.max != null && attempts.max > 1 && (
          <span className="bc-tag">
            Life {attempts.current} of {attempts.max}
            <Pips current={attempts.current} max={attempts.max} />
          </span>
        )}
        {phase === 'paused' && (
          <span className="bc-tag" data-alert="">
            Frozen
          </span>
        )}
        {phase === 'timeup' && (
          <span className="bc-tag" data-alert="hot">
            Too late
          </span>
        )}
        {phase === 'playing' && attempts?.last && attempts.max != null && attempts.max > 1 && (
          <span className="bc-tag" data-alert="hot">
            Last breath
          </span>
        )}
      </div>
      {clock.duration != null && (
        <div className="bc-bar mt-6" data-low={low || undefined} aria-hidden="true">
          <i style={{ width: `${(1 - clock.progress) * 100}%` }} />
        </div>
      )}
    </Lower>
  );
}

/** The call: a verdict in the middle of the frame for a few seconds, then a card with what comes next. */
export function ResultScene() {
  const { challenge: c, call, next, upNext } = useChallenge();
  const { progress } = useLineup();
  const sides = useSides();
  const { bannerSecs } = useBroadcastSettings();
  const folded = useOverlaySelector((s) => !!s.round.call && s.now - s.round.call.at >= bannerSecs * 1000, { time: true });
  if (!c || !call) return null;
  const name = sides[call.winner].name;
  const headline = call.winner === 'streamer' ? `${name} survives` : `${name} claims a soul`;

  if (!folded) {
    return (
      <Center>
        <div className="bc-card bc-winner" data-side={call.winner} data-flat="">
          <div className="bc-rays" aria-hidden="true" />
          <div className="bc-kicker justify-center">
            Trial {progress.number} · {c.title}
          </div>
          <div className="bc-title bc-lit bc-winner-title mt-5">{headline}</div>
          <div className="bc-num bc-winner-pts mt-5">
            +{fmt(call.points)} to {name}
          </div>
        </div>
      </Center>
    );
  }

  return (
    <Lower side={call.winner}>
      <div className="bc-kicker">
        Trial {progress.number} · {c.title}
      </div>
      <div className="bc-after mt-5">
        <span className="bc-after-side">+{fmt(call.points)}</span>
        <div className="bc-title bc-t3 bc-lit min-w-0">{headline}</div>
      </div>
      <div className="bc-foot mt-6 flex items-baseline gap-3">
        {upNext ? (
          <>
            <span className="dr-dim">Next trial</span>
            <b className="dr-next min-w-0 truncate">{upNext.title}</b>
          </>
        ) : (
          <span>The reckoning is near</span>
        )}
        {next && <span className="bc-num ml-auto">{next.text}</span>}
      </div>
      {next?.duration && (
        <div className="bc-bar mt-4" aria-hidden="true">
          <i style={{ width: `${(1 - next.progress) * 100}%` }} />
        </div>
      )}
    </Lower>
  );
}

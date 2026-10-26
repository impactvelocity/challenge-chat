import { useBallot, useChallenge, useLineup, useOverlaySelector, useRound, useSides, useSubmissions } from '@/overlay/sdk';
import { fmt, LiveDot } from '@/scoreboard/parts';
import { Center, DifficultyTag, Lower } from '../broadcast/parts';
import { Heart, Hearts, Note, Tape } from './parts';

/*
 * Cozy's scenes: Broadcast's, rewritten for a light paper card (no white text) and friendlier words.
 * Same hooks, same places on the frame.
 */

/** How long the call's banner stays up before it folds into the up-next card. */
const BANNER_SECS = 8;

export function IdeasScene() {
  const subs = useSubmissions();
  return (
    <Lower>
      <Tape />
      <div className="bc-kicker">
        {subs.open ? (
          <>
            <LiveDot /> The idea jar is open
          </>
        ) : (
          'Jar closed'
        )}
        {subs.open && subs.clock && !subs.clock.expired && <span className="bc-num cz-soft ml-auto">{subs.clock.text}</span>}
      </div>
      <div className="bc-title bc-t2 mt-3">{subs.open ? 'Drop an idea in the jar' : 'Picking the ballot'}</div>
      {subs.open && (
        <div className="bc-cmdline mt-5">
          <span className="bc-cmd">{subs.command}</span> <span className="cz-soft">your idea</span>
        </div>
      )}
      {subs.count > 0 && (
        <ul className="bc-list mt-5">
          {subs.ideas.slice(0, 3).map((idea, i) => (
            <li key={idea.challenge.id} className="bc-idea" data-new={(i === 0 && subs.open) || undefined}>
              <b className="min-w-0 truncate">{idea.challenge.title}</b>
              <span className="bc-by">{idea.challenge.by}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="bc-foot mt-4">
        <span className="bc-num cz-ink">{subs.count}</span> {subs.count === 1 ? 'idea' : 'ideas'} in the jar
      </div>
      {subs.open && <Note at="ideas">ooh, what&rsquo;ll it be?</Note>}
    </Lower>
  );
}

export function VoteScene() {
  const ballot = useBallot();
  if (!ballot) return null;
  const clock = ballot.clock;
  const low = !!clock && clock.remaining != null && clock.remaining <= 10;
  return (
    <Lower wide>
      <Tape at="left" />
      <div className="bc-kicker">
        <LiveDot /> Chat vote
        {clock && <span className="bc-num cz-ink ml-auto">{clock.text}</span>}
      </div>
      <div className="bc-title bc-t3 mt-3">Help pick today&rsquo;s plan</div>
      <p className="bc-sub mt-2">
        Type <b className="cz-ink">{ballot.command} 1</b> to {ballot.rows.length}. The top {ballot.winners} make the plan
      </p>
      <ol className="bc-list mt-5">
        {ballot.rows.map((r) => (
          <li key={r.challenge.id} className="bc-vote" data-lead={r.leading || undefined} data-making={r.making || undefined}>
            <span className="bc-key">{r.key}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex items-baseline gap-3">
                <b className="min-w-0 flex-1 truncate">{r.challenge.title}</b>
                <span className="bc-num bc-pct">{Math.round(r.share * 100)}%</span>
              </span>
              <span className="bc-bar">
                <i style={{ width: `${r.ofTop * 100}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ol>
      {clock && clock.duration && (
        <div className="bc-bar mt-5" data-low={low || undefined} aria-hidden="true">
          <i style={{ width: `${(1 - clock.progress) * 100}%` }} />
        </div>
      )}
    </Lower>
  );
}

export function LineupScene() {
  const { slots } = useLineup();
  const name = useOverlaySelector((s) => s.round.session?.name);
  return (
    <Lower>
      <Tape />
      <div className="bc-kicker">Today&rsquo;s plan</div>
      <div className="bc-title bc-t2 mt-3">{name ?? 'Up next'}</div>
      <ol className="bc-list mt-5">
        {slots.map(({ challenge: c, index }) => (
          <li key={c.id} className="bc-line" data-first={index === 0 || undefined}>
            <span className="bc-key">{index + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <b className="truncate">{c.title}</b>
              <span className="bc-by">{index === 0 ? 'Up first' : `${c.difficulty[0].toUpperCase()}${c.difficulty.slice(1)} · from ${c.by}`}</span>
            </span>
            <span className="bc-num bc-pts">+{fmt(c.points)}</span>
          </li>
        ))}
      </ol>
      <Note at="lineup">cozy vibes only</Note>
    </Lower>
  );
}

export function LiveScene() {
  const { challenge: c, phase, clock, countdown, attempts } = useChallenge();
  const { progress } = useLineup();
  if (!c || !clock) return null;
  const low = phase === 'playing' && clock.remaining != null && clock.remaining <= 30;
  return (
    <Lower wide>
      <Tape at="right" />
      <div className="bc-kicker">
        {phase === 'playing' && <LiveDot />} Challenge {progress.number} of {progress.total}
        <span className="cz-soft ml-auto">from {c.by}</span>
      </div>
      <div className="mt-3 flex items-end gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="bc-title bc-t1">{c.title}</div>
          <p className="bc-sub">{c.objective}</p>
        </div>
        {phase === 'countdown' ? (
          <div className="bc-clock">
            <span key={countdown} className="bc-num bc-count">
              {countdown}
            </span>
            <span className="bc-clock-l">Get comfy</span>
          </div>
        ) : (
          <div className="bc-clock" data-low={low || undefined} data-paused={phase === 'paused' || undefined}>
            <span className="bc-num">{clock.text}</span>
            <span className="bc-clock-l">{clock.remaining != null ? 'Left' : 'Elapsed'}</span>
          </div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <DifficultyTag c={c} />
        <span className="bc-tag bc-num">+{fmt(c.points)} pts</span>
        {attempts?.max != null && attempts.max > 1 && (
          <span className="bc-tag">
            Try {attempts.current} of {attempts.max}
            <Hearts current={attempts.current} max={attempts.max} />
          </span>
        )}
        {phase === 'paused' && (
          <span className="bc-tag" data-alert="">
            Tea break
          </span>
        )}
        {phase === 'timeup' && (
          <span className="bc-tag" data-alert="hot">
            Time&rsquo;s up
          </span>
        )}
        {phase === 'playing' && attempts?.last && attempts.max != null && attempts.max > 1 && (
          <span className="bc-tag" data-alert="hot">
            Last try
          </span>
        )}
      </div>
      {clock.duration != null && (
        <div className="bc-bar mt-5" data-low={low || undefined} aria-hidden="true">
          <i style={{ width: `${(1 - clock.progress) * 100}%` }} />
        </div>
      )}
      {phase === 'playing' && <Note at="live">you got this!</Note>}
    </Lower>
  );
}

/** The call: a warm banner with hearts floating up, then a card with what's next. */
export function ResultScene() {
  const { challenge: c, call, next, upNext } = useChallenge();
  const { progress } = useLineup();
  const sides = useSides();
  const folded = useOverlaySelector((s) => !!s.round.call && s.now - s.round.call.at >= BANNER_SECS * 1000, { time: true });
  if (!c || !call) return null;
  const name = sides[call.winner].name;
  const headline = call.winner === 'streamer' ? `${name} did it!` : `${name} wins this one`;

  if (!folded) {
    return (
      <Center>
        <div className="bc-card cz-cheer" data-side={call.winner}>
          <Tape at="left" />
          <Tape at="right" />
          <span className="cz-float" aria-hidden="true">
            {Array.from({ length: 7 }, (_, i) => (
              <Heart key={i} className="cz-float-heart" data-n={i} />
            ))}
          </span>
          <div className="bc-kicker justify-center">
            Challenge {progress.number} · {c.title}
          </div>
          <div className="bc-title bc-lit cz-cheer-title mt-4">{headline}</div>
          <div className="bc-num cz-cheer-pts mt-4">
            +{fmt(call.points)} to {name}
          </div>
          <Note at="cheer">{call.winner === 'streamer' ? 'so proud ♥' : 'gg, chat!'}</Note>
        </div>
      </Center>
    );
  }

  return (
    <Lower side={call.winner}>
      <div className="bc-kicker">
        Challenge {progress.number} · {c.title}
      </div>
      <div className="bc-after mt-4">
        <span className="bc-after-side">+{fmt(call.points)}</span>
        <div className="bc-title bc-t3 bc-lit min-w-0">{headline}</div>
      </div>
      <div className="bc-foot mt-5 flex items-baseline gap-3">
        {upNext ? (
          <>
            <span>Up next</span>
            <b className="cz-ink min-w-0 truncate tracking-normal normal-case">{upNext.title}</b>
          </>
        ) : (
          <span>Results next</span>
        )}
        {next && <span className="bc-num cz-ink ml-auto">{next.text}</span>}
      </div>
      {next?.duration && (
        <div className="bc-bar mt-4" aria-hidden="true">
          <i style={{ width: `${(1 - next.progress) * 100}%` }} />
        </div>
      )}
    </Lower>
  );
}

export function RecapScene() {
  const r = useRound();
  const sides = useSides();
  const top = r.winner;
  return (
    <Center>
      <div className="bc-card bc-recap cz-recap bc-enter" data-side={top ?? undefined}>
        <Tape at="left" />
        <Tape at="right" />
        <div className="bc-kicker justify-center">That&rsquo;s a wrap{r.session?.name ? ` · ${r.session.name}` : ''}</div>
        <div className="bc-recap-score mt-7">
          {(['streamer', 'chat'] as const).map((side, i) => (
            <div key={side} className="bc-recap-side" data-side={side} data-won={top === side || undefined} style={{ order: i * 2 }}>
              <span className="bc-recap-name">{sides[side].name}</span>
              <span className="bc-num bc-recap-pts">{fmt(r.score[side].points)}</span>
              <span className="bc-by">
                {r.score[side].wins} of {r.progress.total} challenges
              </span>
            </div>
          ))}
          <span className="bc-recap-vs" style={{ order: 1 }}>
            &amp;
          </span>
        </div>
        <div className="bc-recap-track mt-7" aria-hidden="true">
          {r.lineup.map((s) => (
            <i key={s.challenge.id} data-side={s.winner ?? undefined} />
          ))}
        </div>
        <div className="bc-title bc-lit bc-t1 mt-7">{top ? `${sides[top].name} takes the day` : 'A cozy tie'}</div>
        <p className="bc-sub mt-3">
          {r.sweep && top === r.sweep && <b className="cz-ink">Clean sweep! </b>}
          {r.mvp && (
            <>
              Top challenger today: <b className="cz-ink">{r.mvp.name}</b> <span className="bc-num">+{fmt(r.mvp.points)}</span>
            </>
          )}
        </p>
        <Note at="recap">thanks for hanging out ♥</Note>
      </div>
    </Center>
  );
}

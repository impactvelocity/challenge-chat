import { useBallot, useChallenge, useLineup, useOverlaySelector, useRound, useSides, useSubmissions } from '@/overlay/sdk';
import { fmt, LiveDot } from '@/scoreboard/parts';
import { Center, DifficultyTag, Lower, Pips } from './parts';
import { useBroadcastSettings } from './settings';

/* One component per scene. Each reads only the hooks it needs; the SDK keys them so they animate in. */

export function IdeasScene() {
  const subs = useSubmissions();
  return (
    <Lower>
      <div className="bc-kicker">
        {subs.open ? (
          <>
            <LiveDot /> Taking ideas
          </>
        ) : (
          'Ideas closed'
        )}
        {subs.open && subs.clock && !subs.clock.expired && <span className="bc-num ml-auto text-white/70">{subs.clock.text}</span>}
      </div>
      <div className="bc-title bc-t2 mt-4">{subs.open ? 'Send a challenge' : 'Picking the ballot'}</div>
      {subs.open && (
        <div className="bc-cmdline mt-5">
          <span className="bc-cmd">{subs.command}</span> <span className="text-white/55">your idea</span>
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
        <span className="bc-num text-white">{subs.count}</span> {subs.count === 1 ? 'idea' : 'ideas'} in
      </div>
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
      <div className="bc-kicker">
        <LiveDot /> Chat vote
        {clock && <span className="bc-num ml-auto text-white">{clock.text}</span>}
      </div>
      <div className="bc-title bc-t3 mt-4">Pick tonight&rsquo;s challenges</div>
      <p className="bc-sub mt-2">
        Type <b className="text-white">{ballot.command} 1</b> to {ballot.rows.length}. The top {ballot.winners} make the lineup
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
      <div className="bc-kicker">Tonight&rsquo;s lineup</div>
      <div className="bc-title bc-t2 mt-4">{name ?? 'Up next'}</div>
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
      <div className="bc-kicker">
        {phase === 'playing' && <LiveDot />} Challenge {progress.number} of {progress.total}
        <span className="ml-auto text-white/70">from {c.by}</span>
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
            <span className="bc-clock-l">Get ready</span>
          </div>
        ) : (
          <div className="bc-clock" data-low={low || undefined} data-paused={phase === 'paused' || undefined}>
            <span className="bc-num">{clock.text}</span>
            <span className="bc-clock-l">{clock.remaining != null ? 'Left' : 'Elapsed'}</span>
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <DifficultyTag c={c} />
        <span className="bc-tag bc-num">+{fmt(c.points)} pts</span>
        {attempts?.max != null && attempts.max > 1 && (
          <span className="bc-tag">
            Try {attempts.current} of {attempts.max}
            <Pips current={attempts.current} max={attempts.max} />
          </span>
        )}
        {phase === 'paused' && (
          <span className="bc-tag" data-alert="">
            Paused
          </span>
        )}
        {phase === 'timeup' && (
          <span className="bc-tag" data-alert="hot">
            Time up
          </span>
        )}
        {phase === 'playing' && attempts?.last && attempts.max != null && attempts.max > 1 && (
          <span className="bc-tag" data-alert="hot">
            Last try
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

/** The call: a big banner for a few seconds, then a card with what's next. */
export function ResultScene() {
  const { challenge: c, call, next, upNext } = useChallenge();
  const { progress } = useLineup();
  const sides = useSides();
  const { bannerSecs } = useBroadcastSettings();
  const folded = useOverlaySelector((s) => !!s.round.call && s.now - s.round.call.at >= bannerSecs * 1000, { time: true });
  if (!c || !call) return null;
  const name = sides[call.winner].name;
  const headline = call.winner === 'streamer' ? `${name} clears it` : `${name} wins it`;

  if (!folded) {
    return (
      <Center>
        <div className="bc-card bc-winner" data-side={call.winner} data-flat="">
          <div className="bc-rays" aria-hidden="true" />
          <div className="bc-kicker justify-center">
            Challenge {progress.number} · {c.title}
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
        Challenge {progress.number} · {c.title}
      </div>
      <div className="bc-after mt-5">
        <span className="bc-after-side">+{fmt(call.points)}</span>
        <div className="bc-title bc-t3 bc-lit min-w-0">{headline}</div>
      </div>
      <div className="bc-foot mt-6 flex items-baseline gap-3">
        {upNext ? (
          <>
            <span className="text-white/45">Up next</span>
            <b className="min-w-0 truncate tracking-normal text-white normal-case">{upNext.title}</b>
          </>
        ) : (
          <span>Results next</span>
        )}
        {next && <span className="bc-num ml-auto text-white">{next.text}</span>}
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
      <div className="bc-card bc-recap bc-enter" data-side={top ?? undefined} data-flat="">
        <div className="bc-kicker justify-center">Session over{r.session?.name ? ` · ${r.session.name}` : ''}</div>
        <div className="bc-recap-score mt-8">
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
            vs
          </span>
        </div>
        <div className="bc-recap-track mt-8" aria-hidden="true">
          {r.lineup.map((s) => (
            <i key={s.challenge.id} data-side={s.winner ?? undefined} />
          ))}
        </div>
        <div className="bc-title bc-lit bc-t1 mt-8">{top ? `${sides[top].name} takes the night` : 'All square'}</div>
        <p className="bc-sub mt-3">
          {r.sweep && top === r.sweep && <b className="text-white">Clean sweep. </b>}
          {r.mvp && (
            <>
              Top challenger tonight: <b className="text-white">{r.mvp.name}</b> <span className="bc-num">+{fmt(r.mvp.points)}</span>
            </>
          )}
        </p>
      </div>
    </Center>
  );
}

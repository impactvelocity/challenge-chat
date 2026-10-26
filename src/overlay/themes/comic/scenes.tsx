import type { ReactNode } from 'react';
import { useBallot, useChallenge, useLineup, useOverlaySelector, useRound, useSides, useSubmissions, type Side } from '@/overlay/sdk';
import { fmt, LiveDot } from '@/scoreboard/parts';
import { Center, DifficultyTag, Lower, Pips } from '../broadcast/parts';

/* Broadcast's scenes with comic copy and black-on-paper markup (its light-on-dark utilities can't be restyled). */

/** How long the starburst holds before folding into the up-next card. */
const BANNER_MS = 8000;

/** A panel's top row: the caption box, and anything else pushed to the right. */
function Head({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="cc-head">
      <span className="cc-cap">{children}</span>
      {aside && <span className="cc-chip bc-num ml-auto">{aside}</span>}
    </div>
  );
}

export function IdeasScene() {
  const subs = useSubmissions();
  return (
    <Lower>
      <Head aside={subs.open && subs.clock && !subs.clock.expired ? subs.clock.text : undefined}>
        {subs.open ? (
          <>
            <LiveDot /> Taking dares
          </>
        ) : (
          'Dares closed'
        )}
      </Head>
      <div className="cc-title cc-t2 mt-5">{subs.open ? 'What’s the dare?' : 'Picking the best ones…'}</div>
      {subs.open && (
        <div className="cc-bubble mt-5">
          <span className="cc-cmd">{subs.command}</span> your idea
        </div>
      )}
      {subs.count > 0 && (
        <ul className="cc-list mt-6">
          {subs.ideas.slice(0, 3).map((idea, i) => (
            <li key={idea.challenge.id} className="cc-row" data-new={(i === 0 && subs.open) || undefined}>
              <b className="min-w-0 flex-1 truncate">{idea.challenge.title}</b>
              <span className="cc-by">{idea.challenge.by}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="cc-foot mt-4">
        <b className="bc-num">{subs.count}</b> {subs.count === 1 ? 'dare' : 'dares'} in
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
      <Head aside={clock?.text}>
        <LiveDot /> Chat vote
      </Head>
      <div className="cc-title cc-t2 mt-5">Vote now!</div>
      <p className="cc-sub mt-2">
        Type <b className="cc-cmd">{ballot.command} 1</b> to {ballot.rows.length}. Top {ballot.winners} make the show
      </p>
      <ol className="cc-list mt-5">
        {ballot.rows.map((r) => (
          <li key={r.challenge.id} className="cc-vote" data-lead={r.leading || undefined} data-making={r.making || undefined}>
            <span className="cc-key">{r.key}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex items-baseline gap-3">
                <b className="min-w-0 flex-1 truncate">{r.challenge.title}</b>
                <span className="bc-num cc-pct">{Math.round(r.share * 100)}%</span>
              </span>
              <span className="cc-bar">
                <i style={{ width: `${r.ofTop * 100}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ol>
      {clock && clock.duration && (
        <div className="cc-bar mt-5" data-low={low || undefined} aria-hidden="true">
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
      <Head>Coming up</Head>
      <div className="cc-title cc-t2 mt-5">{name ?? 'Tonight’s episodes'}</div>
      <ol className="cc-list mt-5">
        {slots.map(({ challenge: c, index }) => (
          <li key={c.id} className="cc-row" data-new={index === 0 || undefined}>
            <span className="cc-key">{index + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <b className="truncate">{c.title}</b>
              <span className="cc-by">{index === 0 ? 'Up first!' : `${c.difficulty[0].toUpperCase()}${c.difficulty.slice(1)} · from ${c.by}`}</span>
            </span>
            <span className="cc-chip bc-num">+{fmt(c.points)}</span>
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
      <Head aside={`from ${c.by}`}>
        {phase === 'playing' && <LiveDot />} Episode {progress.number} of {progress.total}
      </Head>
      <div className="mt-5 flex items-center gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="cc-title cc-t1">{c.title}</div>
          <p className="cc-sub">{c.objective}</p>
        </div>
        {phase === 'countdown' ? (
          <div className="cc-clock" data-count="">
            <span key={countdown} className="bc-num cc-clock-n cc-count">
              {countdown}
            </span>
            <span className="cc-clock-l">Get ready!</span>
          </div>
        ) : (
          <div className="cc-clock" data-low={low || undefined} data-paused={phase === 'paused' || undefined}>
            <span className="bc-num cc-clock-n">{clock.text}</span>
            <span className="cc-clock-l">{clock.remaining != null ? 'Left' : 'So far'}</span>
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
            Hold it!
          </span>
        )}
        {phase === 'timeup' && (
          <span className="bc-tag" data-alert="hot">
            Time’s up!
          </span>
        )}
        {phase === 'playing' && attempts?.last && attempts.max != null && attempts.max > 1 && (
          <span className="bc-tag" data-alert="hot">
            Last try!
          </span>
        )}
      </div>
      {clock.duration != null && (
        <div className="cc-bar mt-6" data-low={low || undefined} aria-hidden="true">
          <i style={{ width: `${(1 - clock.progress) * 100}%` }} />
        </div>
      )}
    </Lower>
  );
}

const headline = (side: Side, name: string) => (side === 'streamer' ? `${name} did it!` : `${name} wins!`);

/** The call: a starburst for a few seconds, then a panel with what's next. */
export function ResultScene() {
  const { challenge: c, call, next, upNext } = useChallenge();
  const { progress } = useLineup();
  const sides = useSides();
  const folded = useOverlaySelector((s) => !!s.round.call && s.now - s.round.call.at >= BANNER_MS, { time: true });
  if (!c || !call) return null;
  const name = sides[call.winner].name;

  if (!folded) {
    return (
      <Center>
        <div className="cc-boom" data-side={call.winner}>
          <div className="cc-boom-in">
            <span className="cc-cap">
              Episode {progress.number} · {c.title}
            </span>
            <div className="cc-title cc-boom-title">{headline(call.winner, name)}</div>
            <div className="bc-num cc-boom-pts">
              +{fmt(call.points)} to {name}
            </div>
          </div>
        </div>
      </Center>
    );
  }

  return (
    <Lower side={call.winner}>
      <Head>
        Episode {progress.number} · {c.title}
      </Head>
      <div className="cc-after mt-5">
        <span className="cc-after-pts bc-num">+{fmt(call.points)}</span>
        <div className="cc-title cc-t2 min-w-0">{headline(call.winner, name)}</div>
      </div>
      <div className="cc-foot mt-6 flex items-baseline gap-3">
        {upNext ? (
          <>
            <span>Next time…</span>
            <b className="min-w-0 truncate">{upNext.title}</b>
          </>
        ) : (
          <span>Results next!</span>
        )}
        {next && <span className="bc-num ml-auto">{next.text}</span>}
      </div>
      {next?.duration && (
        <div className="cc-bar mt-4" aria-hidden="true">
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
      <div className="bc-card cc-recap bc-enter" data-side={top ?? undefined}>
        <span className="cc-cap">The end… for now{r.session?.name ? ` · ${r.session.name}` : ''}</span>
        <div className="cc-recap-score mt-8">
          {(['streamer', 'chat'] as const).map((side, i) => (
            <div key={side} className="cc-recap-side" data-side={side} data-won={top === side || undefined} style={{ order: i * 2 }}>
              <span className="cc-name">{sides[side].name}</span>
              <span className="bc-num cc-recap-pts">{fmt(r.score[side].points)}</span>
              <span className="cc-by">
                {r.score[side].wins} of {r.progress.total} episodes
              </span>
            </div>
          ))}
          <span className="cc-vs" style={{ order: 1 }}>
            VS
          </span>
        </div>
        <div className="cc-track cc-recap-track mt-8" aria-hidden="true">
          {r.lineup.map((s) => (
            <i key={s.challenge.id} data-side={s.winner ?? undefined} />
          ))}
        </div>
        <div className="cc-title cc-t1 mt-8">{top ? `${sides[top].name} takes the night!` : 'It’s a tie!'}</div>
        <p className="cc-sub mt-3">
          {r.sweep && top === r.sweep && <b>Clean sweep! </b>}
          {r.mvp && (
            <>
              Star of the show: <b>{r.mvp.name}</b> <span className="bc-num">+{fmt(r.mvp.points)}</span>
            </>
          )}
        </p>
      </div>
    </Center>
  );
}

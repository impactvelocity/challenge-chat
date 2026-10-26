import { useBallot, useChallenge, useLineup, useOverlaySelector, useRound, useSides, useSubmissions } from '@/overlay/sdk';
import { fmt, LiveDot } from '@/scoreboard/parts';
import { Center } from '../broadcast/parts';
import { cap, Card, Danger, Lives, Scroll, Seal } from './parts';

/* One component per scene, written for parchment's dark ink: challenges are quests, points are gold. */

/** How long the call's banner holds before it folds into the up-next card. */
const BANNER_SECS = 8;

export function IdeasScene() {
  const subs = useSubmissions();
  return (
    <Scroll>
      <div className="fq-kicker">
        {subs.open ? (
          <>
            <LiveDot /> The quest board is open
          </>
        ) : (
          'The board is sealed'
        )}
        {subs.open && subs.clock && !subs.clock.expired && <span className="bc-num fq-kicker-r">{subs.clock.text}</span>}
      </div>
      <div className="bc-title fq-t2 mt-4">{subs.open ? 'Post a quest' : 'Choosing the worthy'}</div>
      {subs.open && (
        <div className="fq-cmd mt-5">
          <span className="fq-cmd-k">{subs.command}</span> <span className="fq-soft">your quest</span>
        </div>
      )}
      {subs.count > 0 && (
        <ul className="fq-list mt-5">
          {subs.ideas.slice(0, 3).map((idea, i) => (
            <li key={idea.challenge.id} className="fq-row" data-new={(i === 0 && subs.open) || undefined}>
              <b className="min-w-0 flex-1 truncate">{idea.challenge.title}</b>
              <span className="fq-by">by {idea.challenge.by}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="fq-foot mt-4">
        <span className="bc-num fq-strong">{subs.count}</span> {subs.count === 1 ? 'quest' : 'quests'} posted
      </div>
    </Scroll>
  );
}

export function VoteScene() {
  const ballot = useBallot();
  if (!ballot) return null;
  const clock = ballot.clock;
  const low = !!clock && clock.remaining != null && clock.remaining <= 10;
  return (
    <Scroll wide>
      <div className="fq-kicker">
        <LiveDot /> The council votes
        {clock && <span className="bc-num fq-kicker-r">{clock.text}</span>}
      </div>
      <div className="bc-title fq-t3 mt-4">Choose tonight&rsquo;s quests</div>
      <p className="fq-sub mt-2">
        Type <b className="fq-strong">{ballot.command} 1</b> to {ballot.rows.length}. The top {ballot.winners} are sworn in
      </p>
      <ol className="fq-list mt-5">
        {ballot.rows.map((r) => (
          <li key={r.challenge.id} className="fq-vote" data-lead={r.leading || undefined} data-making={r.making || undefined}>
            <span className="fq-medal">{r.key}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="flex items-baseline gap-3">
                <b className="min-w-0 flex-1 truncate">{r.challenge.title}</b>
                <span className="bc-num fq-pct">{Math.round(r.share * 100)}%</span>
              </span>
              <span className="fq-bar">
                <i style={{ width: `${r.ofTop * 100}%` }} />
              </span>
            </span>
          </li>
        ))}
      </ol>
      {clock && clock.duration && (
        <div className="fq-bar mt-5" data-low={low || undefined} aria-hidden="true">
          <i style={{ width: `${(1 - clock.progress) * 100}%` }} />
        </div>
      )}
    </Scroll>
  );
}

export function LineupScene() {
  const { slots } = useLineup();
  const name = useOverlaySelector((s) => s.round.session?.name);
  return (
    <Scroll>
      <div className="fq-kicker">Tonight&rsquo;s quests</div>
      <div className="bc-title fq-t2 mt-4">{name ?? 'The road ahead'}</div>
      <ol className="fq-list mt-5">
        {slots.map(({ challenge: c, index }) => (
          <li key={c.id} className="fq-row fq-line" data-first={index === 0 || undefined}>
            <span className="fq-medal">{index + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <b className="truncate">{c.title}</b>
              <span className="fq-by">{index === 0 ? 'The first quest' : `${cap(c.difficulty)} · posted by ${c.by}`}</span>
            </span>
            <span className="bc-num fq-gold-n">{fmt(c.points)} gold</span>
          </li>
        ))}
      </ol>
    </Scroll>
  );
}

/** The live challenge as a quest card: the objective, the reward, its danger, the lives left and the hourglass. */
export function LiveScene() {
  const { challenge: c, phase, clock, countdown, attempts } = useChallenge();
  const { progress } = useLineup();
  if (!c || !clock) return null;
  const low = phase === 'playing' && clock.remaining != null && clock.remaining <= 30;
  return (
    <Scroll wide>
      <div className="fq-kicker">
        {phase === 'playing' && <LiveDot />} Quest {progress.number} of {progress.total}
        <span className="fq-kicker-r fq-soft">posted by {c.by}</span>
      </div>
      <div className="mt-4 flex items-end gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="bc-title fq-t1">{c.title}</div>
          <p className="fq-sub fq-objective">{c.objective}</p>
        </div>
        {phase === 'countdown' ? (
          <div className="fq-clock">
            <span key={countdown} className="bc-num fq-count">
              {countdown}
            </span>
            <span className="fq-clock-l">Prepare</span>
          </div>
        ) : (
          <div className="fq-clock" data-low={low || undefined} data-paused={phase === 'paused' || undefined}>
            <span className="bc-num">{clock.text}</span>
            <span className="fq-clock-l">{clock.remaining != null ? 'Remains' : 'Elapsed'}</span>
          </div>
        )}
      </div>
      <div className="fq-rule mt-5" aria-hidden="true" />
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="fq-tag" data-d={c.difficulty}>
          <Danger d={c.difficulty} />
          {cap(c.difficulty)}
        </span>
        <span className="fq-tag fq-reward">
          Reward · <span className="bc-num">{fmt(c.points)}</span> gold
        </span>
        {attempts?.max != null && attempts.max > 1 && (
          <span className="fq-tag">
            Lives
            <Lives current={attempts.current} max={attempts.max} />
          </span>
        )}
        {phase === 'paused' && (
          <span className="fq-tag" data-alert="">
            The hourglass rests
          </span>
        )}
        {phase === 'timeup' && (
          <span className="fq-tag" data-alert="hot">
            The sands run out
          </span>
        )}
        {phase === 'playing' && attempts?.last && attempts.max != null && attempts.max > 1 && (
          <span className="fq-tag" data-alert="hot">
            Last life
          </span>
        )}
      </div>
      {clock.duration != null && (
        <div className="fq-bar mt-5" data-low={low || undefined} aria-hidden="true">
          <i style={{ width: `${(1 - clock.progress) * 100}%` }} />
        </div>
      )}
    </Scroll>
  );
}

/** The call: a sealed proclamation for a few seconds, then a card with the next quest. */
export function ResultScene() {
  const { challenge: c, call, next, upNext } = useChallenge();
  const { progress } = useLineup();
  const sides = useSides();
  const folded = useOverlaySelector((s) => !!s.round.call && s.now - s.round.call.at >= BANNER_SECS * 1000, { time: true });
  if (!c || !call) return null;
  const name = sides[call.winner].name;
  const headline = call.winner === 'streamer' ? 'Quest complete' : `${name} claims victory`;

  if (!folded) {
    return (
      <Center>
        <div className="fq-banner-wrap">
          <span className="fq-burst" aria-hidden="true" />
          <Card side={call.winner} className="fq-banner" magic>
            <div className="fq-banner-seal">
              <Seal side={call.winner} size={96} />
            </div>
            <div className="fq-kicker justify-center">
              Quest {progress.number} · {c.title}
            </div>
            <div className="bc-title fq-lit fq-banner-title mt-4">{headline}</div>
            <div className="bc-num fq-banner-pts mt-4">
              {name} {call.winner === 'streamer' ? 'earns' : 'seizes'} {fmt(call.points)} gold
            </div>
          </Card>
        </div>
      </Center>
    );
  }

  return (
    <Scroll side={call.winner}>
      <div className="fq-kicker">
        Quest {progress.number} · {c.title}
      </div>
      <div className="fq-after mt-5">
        <Seal side={call.winner} size={68} />
        <div className="flex min-w-0 flex-col gap-1">
          <div className="bc-title fq-t3 fq-lit min-w-0">{headline}</div>
          <span className="bc-num fq-gold-n">+{fmt(call.points)} gold to {name}</span>
        </div>
      </div>
      <div className="fq-foot mt-6 flex items-baseline gap-3">
        {upNext ? (
          <>
            <span className="fq-faint">Next quest</span>
            <b className="fq-next min-w-0 truncate">{upNext.title}</b>
          </>
        ) : (
          <span>The chronicle awaits</span>
        )}
        {next && <span className="bc-num fq-strong ml-auto">{next.text}</span>}
      </div>
      {next?.duration && (
        <div className="fq-bar mt-4" aria-hidden="true">
          <i style={{ width: `${(1 - next.progress) * 100}%` }} />
        </div>
      )}
    </Scroll>
  );
}

/** The night's chronicle: both sides' gold, a gem per quest, and the hero of the night. */
export function RecapScene() {
  const r = useRound();
  const sides = useSides();
  const top = r.winner;
  return (
    <Center>
      <Card side={top ?? undefined} className="fq-recap bc-enter" magic>
        <div className="fq-kicker justify-center">The chronicle{r.session?.name ? ` · ${r.session.name}` : ''}</div>
        <div className="fq-recap-score mt-8">
          {(['streamer', 'chat'] as const).map((side, i) => (
            <div key={side} className="fq-recap-side" data-side={side} data-won={top === side || undefined} style={{ order: i * 2 }}>
              <Seal side={side} size={56} />
              <span className="fq-recap-name">{sides[side].name}</span>
              <span className="bc-num fq-recap-pts">{fmt(r.score[side].points)}</span>
              <span className="fq-by">
                {r.score[side].wins} of {r.progress.total} quests
              </span>
            </div>
          ))}
          <span className="fq-recap-vs" style={{ order: 1 }}>
            versus
          </span>
        </div>
        <div className="fq-gems mt-8" aria-hidden="true">
          {r.lineup.map((s) => (
            <i key={s.challenge.id} data-side={s.winner ?? undefined} />
          ))}
        </div>
        <div className="bc-title fq-lit fq-t1 mt-8">{top ? `${sides[top].name} triumphs` : 'The night ends in a draw'}</div>
        <p className="fq-sub mt-3">
          {r.sweep && top === r.sweep && <b className="fq-strong">A flawless campaign. </b>}
          {r.mvp && (
            <>
              Hero of the night: <b className="fq-strong">{r.mvp.name}</b> <span className="bc-num">{fmt(r.mvp.points)} gold</span>
            </>
          )}
        </p>
      </Card>
    </Center>
  );
}

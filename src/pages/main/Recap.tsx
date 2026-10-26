import { SparkleIcon, TrendDownIcon, TrendUpIcon } from '@/components/icons';
import type { Challenge } from '@/model';
import { cn } from '@/lib/cn';
import type { Side } from '@/scoreboard/model';
import { RankShield, SIDE_NAME, SideDot, type Challenger } from './Boards';

type PlayedChallenge = { c: Challenge; winner: Side | null };

type Row = {
  name: string;
  challenges: PlayedChallenge[];
  earned: number;
  /** Leaderboard rank before and after this session; null = wasn't on the board. */
  before: number | null;
  after: number;
};

/** Who suggested this session's challenges, what each earned, and how they moved on the leaderboard. */
export function challengerRecap(
  played: PlayedChallenge[],
  board: Challenger[],
  scoring: { selectedPoints: number; defeatedStreamerPoints: number },
): Row[] {
  const earned = new Map<string, PlayedChallenge[]>();
  for (const p of played) earned.set(p.c.by, [...(earned.get(p.c.by) ?? []), p]);

  const points = (list: PlayedChallenge[]) =>
    list.reduce((sum, challenge) =>
      sum + scoring.selectedPoints + (challenge.winner === 'chat' ? scoring.defeatedStreamerPoints : 0), 0);

  const rank = (list: { name: string; points: number }[]) => [...list]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((x) => x.name);
  const before = rank(board.map((challenger) => ({
    name: challenger.name,
    points: Math.max(0, challenger.points - points(earned.get(challenger.name) ?? [])),
  })));
  const after = rank(board);

  return [...earned]
    .map(([name, list]) => {
      const was = before.indexOf(name);
      return { name, challenges: list, earned: points(list), before: was < 0 ? null : was + 1, after: after.indexOf(name) + 1 };
    })
    .sort((a, b) => b.earned - a.earned || a.after - b.after);
}

/** The session's challenges in play order: who suggested each, who won it, and the points it was worth. */
export function ChallengeResults({ played, tableClass }: { played: PlayedChallenge[]; tableClass: string }) {
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>Challenge</th>
          <th className="w-[130px] max-sm:w-[96px]">Result</th>
          <th className="w-[90px] text-right">Points</th>
        </tr>
      </thead>
      <tbody>
        {played.map((p) => (
          <tr key={p.c.id}>
            <td>
              <span className="flex min-w-0 items-baseline gap-2.5">
                <span className="truncate text-[17px] font-semibold text-ink-strong">{p.c.title}</span>
                <span className="mono flex-none text-[11px] text-ink-muted max-sm:hidden">@{p.c.by}</span>
              </span>
            </td>
            <td>
              {p.winner ? (
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink-soft" data-side={p.winner}>
                  <SideDot side={p.winner} />
                  {SIDE_NAME[p.winner]} won
                </span>
              ) : (
                <span className="flex items-center gap-2 text-[14px] text-ink-muted">
                  <span className="size-2.5 flex-none rounded-full bg-white/15" />
                  Skipped
                </span>
              )}
            </td>
            <td className="mono text-right text-[15px]" data-side={p.winner ?? undefined}>
              {p.winner ? <span className="text-[var(--t-hi)]">+{p.c.roundValue}</span> : <span className="text-ink-faint">—</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** How a challenger moved on the leaderboard, in words first: "Up 2 / from #4", "New / joins the board". */
function RankMove({ before, after }: { before: number | null; after: number }) {
  const moved = before == null ? null : before - after;
  const [label, sub, tone, icon] =
    moved == null
      ? ['New', 'joins the board', 'text-accent-text', <SparkleIcon key="i" size={13} />]
      : moved > 0
        ? [`Up ${moved}`, `from #${before}`, 'text-[var(--c-hi)]', <TrendUpIcon key="i" size={14} />]
        : moved < 0
          ? [`Down ${-moved}`, `from #${before}`, 'text-ink-soft', <TrendDownIcon key="i" size={14} />]
          : ['Holds', `at #${after}`, 'text-ink-sub', null];
  return (
    <span className="flex items-center justify-end gap-3">
      <span className="flex flex-col items-end gap-0.5 leading-tight">
        <span className={cn('flex items-center gap-1 text-[14px] font-bold', tone)}>
          {icon}
          {label}
        </span>
        <span className="mono text-[11.5px] text-ink-muted">{sub}</span>
      </span>
      <RankShield rank={after} size={32} />
    </span>
  );
}

/** Challengers to read out: name, points for suggesting and beating the streamer, and their move on the leaderboard. */
export function ChallengerRecap({ rows, tableClass }: { rows: Row[]; tableClass: string }) {
  return (
    <table className={tableClass}>
      <thead>
        <tr>
          <th>Challenger</th>
          <th className="w-[90px] text-right">Earned</th>
          <th className="w-[170px] text-right max-sm:w-[130px]">Rank</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>
              <span className="mono block truncate text-[17px] font-semibold tracking-wide text-ink-strong">@{r.name}</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-muted">
                {r.challenges.length} challenge{r.challenges.length === 1 ? '' : 's'}
                {r.challenges.some((p) => p.winner === 'chat') && ` · beat ${SIDE_NAME.streamer} ${r.challenges.filter((p) => p.winner === 'chat').length}×`}
              </span>
            </td>
            <td className="text-right">
              <span data-side="chat" className="pixel sb-lit sb-lit-crisp text-[22px] leading-none">
                +{r.earned}
              </span>
            </td>
            <td>
              <RankMove before={r.before} after={r.after} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

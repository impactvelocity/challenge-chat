import { useState } from 'react';
import { useLineup, useMetric, useOverlayEvent, type LineupSlot } from '@/overlay/sdk';
import { fmt } from '@/scoreboard/parts';
import { Alerts, Counter, Leaderboard, Scoreboard } from '../broadcast/elements';
import { Card, CheckGlyph, CrossGlyph, Framed, SwordsGlyph } from './parts';

/* Broadcast's cards framed with gold flourishes, plus the theme's own Goal and Quest Log. */

export const FramedScoreboard = () => (
  <Framed>
    <Scoreboard />
  </Framed>
);
export const FramedLeaderboard = () => (
  <Framed>
    <Leaderboard />
  </Framed>
);
export const FramedCounter = () => (
  <Framed>
    <Counter />
  </Framed>
);
export const FramedAlerts = () => (
  <Framed>
    <Alerts />
  </Framed>
);

type QuestStatus = 'complete' | 'failed' | 'active' | 'pending' | 'skipped';

function statusOf(slot: LineupSlot): QuestStatus {
  if (slot.winner) return slot.winner === 'streamer' ? 'complete' : 'failed';
  if (slot.status === 'done') return 'skipped';
  return slot.status === 'live' ? 'active' : 'pending';
}

const STATUS_LABEL: Record<QuestStatus, string> = {
  complete: 'Complete',
  failed: 'Claimed by chat',
  active: 'Underway',
  pending: 'Awaits',
  skipped: 'Abandoned',
};

function StatusGlyph({ status }: { status: QuestStatus }) {
  if (status === 'complete') return <CheckGlyph size={18} />;
  if (status === 'failed') return <CrossGlyph size={18} />;
  if (status === 'active') return <SwordsGlyph size={18} />;
  return <i className="fq-pip" />;
}

/** Tonight's lineup as a quest log: each quest with a glyph for complete, claimed by chat, underway, waiting or abandoned. */
export function QuestLog() {
  const { slots, progress } = useLineup();
  return (
    <Card className="fq-log">
      <div className="fq-kicker">
        Quest log
        {slots.length > 0 && (
          <span className="bc-num fq-kicker-r">
            {progress.played} / {progress.total}
          </span>
        )}
      </div>
      {slots.length ? (
        <ol className="fq-log-list mt-4">
          {slots.map((slot) => {
            const status = statusOf(slot);
            return (
              <li key={slot.challenge.id} className="fq-log-row" data-status={status} data-side={slot.winner ?? undefined} title={STATUS_LABEL[status]}>
                <span className="fq-log-glyph">
                  <StatusGlyph status={status} />
                </span>
                <b className="min-w-0 flex-1 truncate">{slot.challenge.title}</b>
                <span className="bc-num fq-log-gold">{fmt(slot.challenge.points)}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="fq-log-empty mt-3">No quests sworn yet</p>
      )}
    </Card>
  );
}

/** A gauge metric with a target, e.g. followers. Turns to burnished gold once reached. */
export function Goal({ metric = 'goal' }: { metric?: string }) {
  const m = useMetric(metric);
  const [party, setParty] = useState(0);
  useOverlayEvent('goal', (e) => e.id === metric && setParty((n) => n + 1));
  if (!m || typeof m.value !== 'number') return null;
  return (
    <Card key={party} className={`fq-goal ${party ? 'fq-celebrate' : ''}`}>
      <div className="flex items-baseline gap-3">
        <span className="fq-kicker">{m.label}</span>
        <span className="bc-num fq-goal-n ml-auto">
          {fmt(m.value)}
          {typeof m.target === 'number' && <span className="fq-faint"> / {fmt(m.target)}</span>}
        </span>
      </div>
      <div className="fq-bar mt-3" data-size="lg" data-reached={m.reached || undefined}>
        <i style={{ width: `${(m.progress ?? 0) * 100}%` }} />
      </div>
    </Card>
  );
}

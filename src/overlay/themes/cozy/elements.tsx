import { useState } from 'react';
import { CheckIcon } from '@/components/icons';
import { useLineup, useMetric, useOverlayEvent } from '@/overlay/sdk';
import { fmt } from '@/scoreboard/parts';
import { Heart, Note, Tape } from './parts';

/** Tonight's lineup as a sticky-note checklist: ticked off as each one's decided, a heart on every streamer win. */
export function TodoNote() {
  const { slots } = useLineup();
  return (
    <div className="cz-todo">
      <Tape />
      <div className="cz-todo-title">today&rsquo;s to-do</div>
      {slots.length ? (
        <ul className="cz-todo-list">
          {slots.map((slot) => {
            const done = slot.status === 'done' || !!slot.winner || slot.skipped;
            return (
              <li
                key={slot.challenge.id}
                className="cz-todo-item"
                data-done={done || undefined}
                data-skip={slot.skipped || undefined}
                data-live={(slot.status === 'live' && !slot.winner) || undefined}
                data-side={slot.winner ?? undefined}
              >
                <span className="cz-box">{done && !slot.skipped && <CheckIcon size={18} strokeWidth={3} />}</span>
                <span className="cz-todo-text">{slot.challenge.title}</span>
                {slot.winner === 'streamer' && <Heart className="cz-todo-heart" />}
                {slot.winner === 'chat' && <span className="cz-todo-by">chat!</span>}
                {slot.skipped && <span className="cz-todo-by">skipped</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="cz-todo-empty">waiting on chat&rsquo;s picks…</p>
      )}
    </div>
  );
}

/** A gauge metric with a target, e.g. followers, on a paper card. Turns honey-gold once reached. */
export function Goal({ metric = 'goal' }: { metric?: string }) {
  const m = useMetric(metric);
  const [party, setParty] = useState(0);
  useOverlayEvent('goal', (e) => e.id === metric && setParty((n) => n + 1));
  if (!m || typeof m.value !== 'number') return null;
  return (
    <div key={party} className="bc-card bc-goal cz-goal" data-reached={m.reached || undefined} data-celebrate={party || undefined}>
      <div className="flex items-baseline gap-3">
        <span className="bc-kicker">{m.label}</span>
        <span className="bc-num cz-goal-n ml-auto">
          {fmt(m.value)}
          {typeof m.target === 'number' && <span className="cz-soft"> / {fmt(m.target)}</span>}
        </span>
      </div>
      <div className="bc-bar mt-3" data-size="lg">
        <i style={{ width: `${(m.progress ?? 0) * 100}%` }} />
      </div>
      {m.reached && <Note at="goal">we did it! ♥</Note>}
    </div>
  );
}

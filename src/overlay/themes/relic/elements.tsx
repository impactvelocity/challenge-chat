import { useChallenge } from '@/overlay/sdk';

/** A dim warding sigil, for when nothing is counting down. */
function Sigil() {
  return (
    <svg className="dr-sigil" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="28" />
      <circle cx="32" cy="32" r="21" />
      <path d="M32 9 L52 46 H12 Z" />
      <path d="M32 4 V60 M4 32 H60" />
    </svg>
  );
}

/**
 * The live challenge's clock as an omen: big narrow digits that bleed red under 30 seconds, beat like a heart
 * under 10, and gutter out at time up. A sleeping sigil between challenges.
 */
export function DoomClock() {
  const { challenge, phase, clock, countdown } = useChallenge();

  if (!challenge || !clock) {
    return (
      <div className="dr-doom-wrap" data-state="idle">
        <div className="bc-card dr-doom dr-doom-idle" data-flat="">
          <Sigil />
          <span className="dr-doom-l">The clock sleeps</span>
        </div>
      </div>
    );
  }

  const left = clock.remaining;
  const dead = phase === 'timeup' || clock.expired;
  const state = dead ? 'dead' : left != null && left <= 10 ? 'heart' : left != null && left <= 30 ? 'low' : undefined;
  const label = phase === 'countdown' ? 'It begins in' : phase === 'paused' ? 'Time stands still' : dead ? 'Too late' : left != null ? 'Time remaining' : 'Time endured';

  return (
    <div className="dr-doom-wrap" data-state={state}>
      <div className="bc-card dr-doom" data-flat="" data-paused={phase === 'paused' || undefined}>
        <span className="dr-doom-l">{label}</span>
        {phase === 'countdown' ? (
          <span key={countdown} className="bc-num dr-doom-n dr-doom-count">
            {countdown}
          </span>
        ) : (
          <span className="bc-num dr-doom-n">{clock.text}</span>
        )}
        {clock.duration != null && (
          <span className="dr-doom-bar" aria-hidden="true">
            <i style={{ width: `${(1 - clock.progress) * 100}%` }} />
          </span>
        )}
      </div>
    </div>
  );
}

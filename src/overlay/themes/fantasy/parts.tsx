import type { ReactNode } from 'react';
import type { Difficulty, Side } from '@/overlay/sdk';
import { useFantasySettings } from './settings';

/* Ornaments and glyphs. Glyphs are inline SVG in currentColor, so they follow the ink of whatever holds them. */

const glyph = (d: string, evenOdd?: boolean) =>
  function Glyph({ size = 18, className }: { size?: number; className?: string }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d={d} fillRule={evenOdd ? 'evenodd' : undefined} />
      </svg>
    );
  };

export const SkullGlyph = glyph(
  'M12 2C7 2 3.5 5.6 3.5 10.2c0 2.8 1.3 4.9 3.3 6.1V20a1 1 0 0 0 1 1h1.6v-2h1.4v2h2.4v-2h1.4v2h1.6a1 1 0 0 0 1-1v-3.7c2-1.2 3.3-3.3 3.3-6.1C20.5 5.6 17 2 12 2Zm-3.4 7.4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6.8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM12 13.6l-1.2 2.2h2.4Z',
  true,
);
export const HeartGlyph = glyph(
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
);
export const CheckGlyph = glyph('M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z');
export const CrossGlyph = glyph('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z');
/** Crossed swords: blade, guard and grip of each. */
export function SwordsGlyph({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className={className} aria-hidden="true">
      <path d="M4 4l11 11M12.5 17.5l5-5M16 16l4 4M20 4 9 15M6.5 12.5l5 5M8 16l-4 4" />
    </svg>
  );
}
export const CrownGlyph = glyph('M3 17h18l1.2-10.5-5.7 4.3L12 3.5l-4.5 7.3-5.7-4.3Zm0 2h18v2H3Z');

/** Gold corner flourishes, drawn over a card's double rule. */
export function Corners() {
  return (
    <span className="fq-corners" aria-hidden="true">
      <i data-c="tl" />
      <i data-c="tr" />
      <i data-c="bl" />
      <i data-c="br" />
    </span>
  );
}

const SPARKS = [
  { left: '-1%', top: '18%', delay: '0s', size: 16 },
  { left: '12%', top: '-4%', delay: '0.7s', size: 11 },
  { left: '58%', top: '-3%', delay: '1.5s', size: 14 },
  { left: '97%', top: '24%', delay: '0.4s', size: 12 },
  { left: '88%', top: '96%', delay: '1.1s', size: 16 },
  { left: '30%', top: '98%', delay: '1.9s', size: 10 },
];

/** A golden glint across the card as it opens, then a few twinkles around its edge. Only with sparkles on. */
export function Magic() {
  const { sparkles } = useFantasySettings();
  if (!sparkles) return null;
  return (
    <>
      <span className="fq-glint" aria-hidden="true" />
      {SPARKS.map((s, i) => (
        <i key={i} className="fq-spark" style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay }} aria-hidden="true" />
      ))}
    </>
  );
}

/** A framed card: parchment or jewel, double gold rule, corner flourishes. */
export function Card({ side, className, magic, children }: { side?: Side; className?: string; magic?: boolean; children: ReactNode }) {
  return (
    <div className={`bc-card fq-card ${className ?? ''}`} data-side={side}>
      <Corners />
      {magic && <Magic />}
      {children}
    </div>
  );
}

/** A scene card along the bottom, opposite the stack. It unfurls in. */
export function Scroll({ wide, side, children }: { wide?: boolean; side?: Side; children: ReactNode }) {
  return (
    <div className="bc-lower" data-wide={wide || undefined}>
      <Card side={side} className="bc-enter fq-scroll" magic>
        {children}
      </Card>
    </div>
  );
}

/**
 * Wraps one of Broadcast's cards with the corner flourishes. Renders nothing visible when the card inside
 * renders nothing (an alert queue that's empty, a missing metric).
 */
export function Framed({ children }: { children: ReactNode }) {
  return (
    <div className="fq-frame">
      <Corners />
      {children}
    </div>
  );
}

/** A wax seal in a side's colour: a crown for the streamer, crossed swords for chat. */
export function Seal({ side, size = 72 }: { side: Side; size?: number }) {
  const Glyph = side === 'streamer' ? CrownGlyph : SwordsGlyph;
  return (
    <span className="fq-seal" data-side={side} style={{ width: size, height: size }} aria-hidden="true">
      <Glyph size={Math.round(size * 0.46)} />
    </span>
  );
}

const DANGER: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3, ridiculous: 4 };

/** Difficulty as one to four skulls. */
export function Danger({ d }: { d: Difficulty }) {
  return (
    <span className="fq-danger" aria-label={d}>
      {Array.from({ length: 4 }, (_, i) => (
        <SkullGlyph key={i} size={18} className={i < DANGER[d] ? 'fq-on' : undefined} />
      ))}
    </span>
  );
}

/** Tries as lives: hearts lost, the one being spent, and what's left. */
export function Lives({ current, max }: { current: number; max: number }) {
  return (
    <span className="fq-lives" aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <HeartGlyph key={i} size={18} className={i < current - 1 ? 'fq-lost' : i === current - 1 ? 'fq-now' : undefined} />
      ))}
    </span>
  );
}

export const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

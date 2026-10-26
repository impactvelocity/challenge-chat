import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import './logo.css';

/** Any CSS colour. Anything left out keeps the default. */
export type LogoColors = {
  /** Challenge (streamer) block. Default: near-white. */
  challengeBg?: string;
  /** Challenge lettering. Default: near-black. */
  challengeText?: string;
  /** Chat block. Default: the theme accent, var(--a). */
  chatBg?: string;
  /** Chat lettering. Default: white. */
  chatText?: string;
  /** The slash that strikes in on hover. Default: near-white. */
  slash?: string;
  /** Glow around the slash; 'transparent' turns it off. Default: the accent at 90%. */
  slashGlow?: string;
};

type LogoProps = LogoColors & {
  /** Font size of the logo (px if a number). The lettering is 60% of it. Default: inherited. */
  size?: number | string;
  /** Strike the slash in on hover. Default: true. */
  animated?: boolean;
  /** Swap to LogoIcon on narrow screens (under 640px), at the same height. Default: true. */
  responsive?: boolean;
  className?: string;
};

/**
 * The Challenge.Chat logo: two blocks cut on a slash. Hover it (or a link/button around it) and
 * the Chat block slides open as a slash strikes into the gap; move away and the slash shrinks
 * into its bottom end as the block closes.
 */
export function Logo({
  size,
  animated = true,
  responsive = true,
  className,
  challengeBg,
  challengeText,
  chatBg,
  chatText,
  slash,
  slashGlow,
}: LogoProps) {
  const style = {
    fontSize: typeof size === 'number' ? `${size}px` : size,
    '--logo-l-bg': challengeBg,
    '--logo-l-text': challengeText,
    '--logo-r-bg': chatBg,
    '--logo-r-text': chatText,
    '--logo-slash': slash,
    '--logo-glow': slashGlow,
  } as CSSProperties;

  return (
    <span
      className={cn('logo', className)}
      data-animated={animated || undefined}
      data-responsive={responsive || undefined}
      style={style}
      role="img"
      aria-label="Challenge Chat"
    >
      <span className="logo-banner" aria-hidden="true">
        <span className="logo-l">
          <i>Challenge</i>
        </span>
        <span className="logo-mid">
          <i className="logo-slash" />
        </span>
        <span className="logo-r">
          <i>Chat</i>
        </span>
      </span>
      {responsive && <LogoIcon animated={animated} challengeBg={challengeBg} chatBg={chatBg} slash={slash} slashGlow={slashGlow} />}
    </span>
  );
}

/* Both halves of the icon: a 64×52 rounded rectangle (a little wider than square, closer to the
   wordmark) split on the logo's slash angle (16.5° off vertical, through the centre), with a
   ~4-unit gap and every corner along the cut rounded. */
const ICON_W = 64;
const ICON_H = 52;
const ICON_CHALLENGE = 'M13 0H33.6Q37.6 0 36.47 3.84L23.33 48.16Q22.2 52 18.2 52H13A13 13 0 0 1 0 39V13A13 13 0 0 1 13 0Z';
const ICON_CHAT = 'M45.8 0H51A13 13 0 0 1 64 13V39A13 13 0 0 1 51 52H30.4Q26.4 52 27.53 48.16L40.67 3.84Q41.8 0 45.8 0Z';

type LogoIconProps = Pick<LogoColors, 'challengeBg' | 'chatBg' | 'slash' | 'slashGlow'> & {
  /** Height in px; the width follows the 64×52 shape. Default: 32. */
  size?: number;
  /** Strike the slash in on hover. Default: true. */
  animated?: boolean;
  className?: string;
};

/**
 * The logo without the lettering: a rounded rectangle split on the slash. Hover it (or a link/button
 * around it) and the Chat half slides out as a slash strikes into the gap, like Logo.
 */
export function LogoIcon({ size = 32, animated = true, className, challengeBg, chatBg, slash, slashGlow }: LogoIconProps) {
  const style = {
    '--logo-l-bg': challengeBg,
    '--logo-r-bg': chatBg,
    '--logo-slash': slash,
    '--logo-glow': slashGlow,
  } as CSSProperties;

  return (
    <svg
      className={cn('logo logo-icon', className)}
      data-animated={animated || undefined}
      style={style}
      width={Math.round((size * ICON_W) / ICON_H)}
      height={size}
      viewBox={`0 0 ${ICON_W} ${ICON_H}`}
      role="img"
      aria-label="Challenge Chat"
    >
      <path className="logo-icon-l" d={ICON_CHALLENGE} />
      <path className="logo-icon-r" d={ICON_CHAT} />
      <g className="logo-icon-mid">
        <g transform="rotate(16.5 32 26)">
          <g className="logo-icon-out">
            <rect className="logo-icon-slash" x="30.8" y="-3" width="2.4" height="58" rx="1.2" />
          </g>
        </g>
      </g>
    </svg>
  );
}

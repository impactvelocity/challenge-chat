export type AccentPreset = { name: string; hex: string };

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Orange', hex: '#EE6039' },
  { name: 'Blue', hex: '#4C8DFF' },
  { name: 'Green', hex: '#5FD35A' },
  { name: 'Teal', hex: '#2BD4C3' },
  { name: 'Pink', hex: '#FF5FA2' },
  { name: 'Purple', hex: '#9B6BFF' },
];

type RGB = [number, number, number];
const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

function toRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Mix `hex` toward `to` by `p` (0–1). */
export function shade(hex: string, to: RGB, p: number): string {
  const c = toRgb(hex);
  return '#' + c.map((v, i) => Math.round(v + (to[i] - v) * p).toString(16).padStart(2, '0')).join('');
}

export const lighten = (hex: string, p: number) => shade(hex, WHITE, p);
export const darken = (hex: string, p: number) => shade(hex, BLACK, p);

/** Every accent shade the design system derives from one base colour. */
export function accentVars(hex: string): Record<string, string> {
  return {
    '--a': hex,
    '--a-hi': lighten(hex, 0.28),
    '--a-lo': darken(hex, 0.14),
    '--a-deep': darken(hex, 0.5),
    '--a-ink': darken(hex, 0.74),
    '--a-pale': lighten(hex, 0.68),
    '--a-text': lighten(hex, 0.5),
    '--ar': toRgb(hex).join(','),
  };
}

/** The opposite hue at a readable lightness — the chat side's colour against the streamer's accent. */
export function complement(hex: string): string {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 180) % 360;
  const c = 0.68; // chroma for s=0.85, l=0.6
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 0.6 - c / 2;
  const sector = Math.floor(h / 60);
  const rgb = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return '#' + rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

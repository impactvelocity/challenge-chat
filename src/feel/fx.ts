/**
 * Imperative one-shot effects. They write to a fixed overlay layer with the Web Animations API,
 * so firing them never re-renders React. Motion effects are skipped under prefers-reduced-motion.
 */
type Point = { x: number; y: number };

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let layer: HTMLDivElement | null = null;
function fxLayer() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function spawn(className: string, p: Point) {
  const el = document.createElement('i');
  el.className = className;
  el.style.left = `${p.x}px`;
  el.style.top = `${p.y}px`;
  fxLayer().appendChild(el);
  return el;
}

/** Where a click happened; falls back to the element's centre for keyboard clicks. */
export function pointOf(e: { clientX: number; clientY: number; currentTarget: EventTarget }): Point {
  if (e.clientX || e.clientY) return { x: e.clientX, y: e.clientY };
  return centerOf(e.currentTarget as Element);
}

export function centerOf(el: Element): Point {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

type BurstOpts = {
  count?: number;
  speed?: [number, number];
  size?: [number, number];
  colors?: string[];
  gravity?: number;
  round?: boolean;
  duration?: number;
};

/** Sparks flying out from a point. */
export function burst(p: Point, { count = 14, speed = [50, 130], size = [4, 8], colors = ['var(--a-hi)', 'var(--a-pale)', '#fff'], gravity = 40, round = false, duration = 620 }: BurstOpts = {}) {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const el = spawn('fx-particle', p);
    const s = rand(...size);
    el.style.width = `${s}px`;
    el.style.height = `${s}px`;
    el.style.background = colors[i % colors.length];
    if (round) el.style.borderRadius = '50%';
    const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
    const dist = rand(...speed);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${dy * 0.8}px)) scale(.9) rotate(90deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + gravity}px)) scale(0) rotate(180deg)`, opacity: 0 },
      ],
      { duration: duration * rand(0.75, 1.15), easing: 'cubic-bezier(.15,.8,.3,1)' },
    ).onfinish = () => el.remove();
  }
}

/** Expanding shockwave ring. */
export function ring(p: Point, { size = 140, duration = 480, color = 'var(--a-hi)' } = {}) {
  if (reducedMotion()) return;
  const el = spawn('fx-ring', p);
  el.style.borderColor = color;
  el.animate(
    [
      { width: '0px', height: '0px', opacity: 1, borderWidth: '6px' },
      { width: `${size}px`, height: `${size}px`, opacity: 0, borderWidth: '1px' },
    ],
    { duration, easing: 'cubic-bezier(.1,.7,.3,1)' },
  ).onfinish = () => el.remove();
}

/** Text that pops up and floats away ("+1", "LEVEL UP"). */
export function floatText(p: Point, text: string, { size = 22, color = 'var(--a-pale)', rise = 60, duration = 800 } = {}) {
  const el = spawn('fx-text', p);
  el.textContent = text;
  el.style.fontSize = `${size}px`;
  el.style.color = color;
  const drift = rand(-14, 14);
  el.animate(
    reducedMotion()
      ? [{ opacity: 1, transform: 'translate(-50%, -50%)' }, { opacity: 0, transform: 'translate(-50%, -50%)' }]
      : [
          { transform: 'translate(-50%, -50%) scale(.4)', opacity: 0 },
          { transform: `translate(-50%, calc(-50% - ${rise * 0.3}px)) scale(1.25)`, opacity: 1, offset: 0.18 },
          { transform: `translate(calc(-50% + ${drift * 0.5}px), calc(-50% - ${rise * 0.6}px)) scale(1)`, opacity: 1, offset: 0.6 },
          { transform: `translate(calc(-50% + ${drift}px), calc(-50% - ${rise}px)) scale(.9)`, opacity: 0 },
        ],
    { duration, easing: 'cubic-bezier(.2,.8,.3,1)' },
  ).onfinish = () => el.remove();
}

/** Coins that burst out, then fly into a target element. `onArrive` fires per coin. */
export function collect(from: Point, target: Element, { count = 6, onArrive }: { count?: number; onArrive?: (i: number) => void } = {}) {
  const to = centerOf(target);
  for (let i = 0; i < count; i++) {
    if (reducedMotion()) {
      setTimeout(() => onArrive?.(i), i * 60);
      continue;
    }
    const el = spawn('fx-coin', { x: 0, y: 0 });
    const angle = rand(0, Math.PI * 2);
    const out = rand(30, 70);
    const mid = { x: from.x + Math.cos(angle) * out, y: from.y + Math.sin(angle) * out - 20 };
    el.animate(
      [
        { transform: `translate(${from.x}px, ${from.y}px) translate(-50%, -50%) scale(.3)` },
        { transform: `translate(${mid.x}px, ${mid.y}px) translate(-50%, -50%) scale(1.15)`, offset: 0.35, easing: 'cubic-bezier(.6,0,.9,.4)' },
        { transform: `translate(${to.x}px, ${to.y}px) translate(-50%, -50%) scale(.55)` },
      ],
      { duration: 640 + i * 40, delay: i * 45, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' },
    ).onfinish = () => {
      el.remove();
      onArrive?.(i);
    };
  }
}

/** Decaying random jitter. */
export function shake(el: Element, { intensity = 7, duration = 360 } = {}) {
  if (reducedMotion()) return;
  const frames = Array.from({ length: 9 }, (_, i) => {
    const k = intensity * (1 - i / 9);
    return { transform: `translate(${rand(-k, k)}px, ${rand(-k * 0.5, k * 0.5)}px) rotate(${rand(-k, k) * 0.15}deg)` };
  });
  el.animate([...frames, { transform: 'none' }], { duration, easing: 'linear' });
}

/** Squash on press, elastic stretch on release. */
export function squash(el: Element, phase: 'down' | 'up') {
  if (reducedMotion()) return;
  if (phase === 'down') {
    el.animate([{ scale: '1 1' }, { scale: '1.08 .88' }], { duration: 90, easing: 'cubic-bezier(.3,0,.5,1)', fill: 'forwards' });
  } else {
    el.animate(
      [{ scale: '1.08 .88' }, { scale: '.92 1.12', offset: 0.3 }, { scale: '1.04 .97', offset: 0.6 }, { scale: '.99 1.01', offset: 0.82 }, { scale: '1 1' }],
      { duration: 480, easing: 'ease-out', fill: 'forwards' },
    );
  }
}

/** Over-bright flash that decays. */
export function flash(el: Element, { strength = 2.2, duration = 260 } = {}) {
  el.animate([{ filter: `brightness(${strength}) saturate(1.3)` }, { filter: 'brightness(1) saturate(1)' }], { duration, easing: 'ease-out' });
}

/** Quick scale pop for counters and badges. */
export function pop(el: Element, { scale = 1.35, duration = 260 } = {}) {
  if (reducedMotion()) return;
  el.animate([{ transform: `scale(${scale})` }, { transform: 'scale(1)' }], { duration, easing: 'cubic-bezier(.3,1.6,.5,1)' });
}

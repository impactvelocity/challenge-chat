import { useEffect, useRef, useState } from 'react';

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** Animates a number toward `target` (count-up / count-down readouts). */
export function useTweened(target: number, duration = 450) {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      current.current = from + (target - from) * easeOutCubic(t);
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

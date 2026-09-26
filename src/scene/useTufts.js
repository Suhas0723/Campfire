import { useMemo } from 'react';
import { rng } from './shape.js';

export const CLEARING = { cx: 980, cy: 800, rx: 560, ry: 175 };

const insideClearing = (x, y, pad = 1) =>
  ((x - CLEARING.cx) / (CLEARING.rx * pad)) ** 2 + ((y - CLEARING.cy) / (CLEARING.ry * pad)) ** 2 < 1;

export function useTufts(seed, count, yMin, yMax, sMin, sMax) {
  return useMemo(() => {
    const r = rng(seed);
    const out = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 20) {
      const x = r() * 1640 - 20;
      const y = yMin + r() * (yMax - yMin);
      if (insideClearing(x, y, 0.95)) continue;
      out.push({ x, y, s: sMin + r() * (sMax - sMin), seed: Math.floor(r() * 9999) });
    }
    return out.sort((a, b) => a.y - b.y);
  }, [seed, count, yMin, yMax, sMin, sMax]);
}

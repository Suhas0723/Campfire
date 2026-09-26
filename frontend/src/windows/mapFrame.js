import { useLayoutEffect, useRef, useState } from 'react';

const FULL_W = 1080;
const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

// Crop the illustrated map to a window around the active stop. Desktop never calls this with enabled.
export function useMapFrame(enabled, focus) {
  const hostRef = useRef(null);
  const current = useRef(null);
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    if (!enabled || !focus) {
      current.current = null;
      setBox(null);
      return undefined;
    }
    const el = hostRef.current;
    if (!el) return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetFor = () => {
      const rect = el.getBoundingClientRect();
      const aspect = rect.width / Math.max(rect.height, 1);
      const w = FULL_W * 0.4;
      const h = w / Math.max(aspect, 0.35);
      return {
        x: focus.x - w / 2,
        y: focus.y - h / 2,
        w,
        h,
        px: Math.max(rect.width, 1) / w,
      };
    };

    const target = targetFor();
    const from = current.current;
    let raf = 0;
    const commit = (next) => {
      current.current = next;
      setBox(next);
    };

    if (!from || reduced) commit(target);
    else {
      const start = performance.now();
      const step = (now) => {
        const u = Math.min(1, (now - start) / 700);
        const e = ease(u);
        commit({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          w: from.w + (target.w - from.w) * e,
          h: from.h + (target.h - from.h) * e,
          px: from.px + (target.px - from.px) * e,
        });
        if (u < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    const onResize = () => commit(targetFor());
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled, focus?.x, focus?.y]);

  return { hostRef, box };
}

// Keep stop marks readable after the viewBox crop. px is screen pixels per map unit.
export function readableScales(px) {
  if (!px) return null;
  return {
    marker: Math.min(Math.max(28 / (22 * px), 0.55), 2.4),
    label: Math.min(Math.max(12 / (15 * px), 0.65), 1.8),
  };
}

export function frameViewBox(box) {
  return `${box.x} ${box.y} ${box.w} ${box.h}`;
}

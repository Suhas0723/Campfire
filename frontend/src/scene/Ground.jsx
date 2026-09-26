import { useMemo } from 'react';
import { blob, rng, roughPoly, c } from './shape.js';
import { CLEARING, useTufts } from './useTufts.js';

export function Tuft({ x, y, s = 1, seed = 1, tone = 'pine' }) {
  const r = rng(seed);
  const blades = 3 + Math.floor(r() * 3);
  const paths = [];
  for (let i = 0; i < blades; i++) {
    const bx = (i - (blades - 1) / 2) * 5;
    const h = 14 + r() * 14;
    const lean = (r() - 0.5) * 16 + bx * 0.8;
    paths.push(`M${bx - 3},0 Q${bx + lean * 0.3},${-h * 0.6} ${bx + lean},${-h} Q${bx + lean * 0.2 + 1},${-h * 0.45} ${bx + 3},0Z`);
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          style={{ fill: c(i % 2 ? 'pine-dark' : tone), stroke: c('bark-dark'), strokeLinejoin: 'round' }}
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

const { cx: CX, cy: CY } = CLEARING;

export default function Ground() {
  const tufts = useTufts(7, 46, 620, 990, 0.6, 1.3);
  const specks = useMemo(() => {
    const r = rng(33);
    return Array.from({ length: 34 }, () => {
      const a = r() * Math.PI * 2;
      const k = 0.25 + r() * 0.7;
      return { x: CX + Math.cos(a) * 520 * k, y: CY + Math.sin(a) * 150 * k, rx: 2 + r() * 5, seed: Math.floor(r() * 999) };
    });
  }, []);

  return (
    <g>
      <defs>
        <linearGradient id="grass-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: c('sky-bottom'), stopOpacity: 0.35 }} />
          <stop offset="0.35" style={{ stopColor: c('sky-bottom'), stopOpacity: 0 }} />
          <stop offset="0.7" style={{ stopColor: c('bark-dark'), stopOpacity: 0 }} />
          <stop offset="1" style={{ stopColor: c('bark-dark'), stopOpacity: 0.35 }} />
        </linearGradient>
        <radialGradient id="clearing-lit">
          <stop offset="0" style={{ stopColor: c('fire-yellow'), stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: c('fire-yellow'), stopOpacity: 0 }} />
        </radialGradient>
        <filter id="soft-edge" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="soft-edge-sm" x="-20%" y="-40%" width="140%" height="180%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <path
        d={roughPoly([[-40, 604], [1640, 604], [1640, 1040], [-40, 1040]], { seed: 5, jitter: 3, step: 50 })}
        style={{ fill: c('pine'), stroke: c('bark-dark') }}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
      <rect x="-40" y="600" width="1680" height="440" fill="url(#grass-shade)" />

      {/* dirt clearing, soft edges fade into grass */}
      <path d={blob(CX, CY + 6, 610, 196, { points: 14, jitter: 0.06, seed: 11 })} style={{ fill: c('wood'), opacity: 0.5 }} filter="url(#soft-edge)" />
      <path d={blob(CX, CY, 500, 148, { points: 14, jitter: 0.07, seed: 12 })} style={{ fill: c('wood-light') }} filter="url(#soft-edge-sm)" />
      <ellipse cx={CX} cy={CY - 6} rx="360" ry="120" fill="url(#clearing-lit)" />

      {specks.map((s, i) => (
        <path
          key={i}
          d={blob(s.x, s.y, s.rx, s.rx * 0.6, { points: 6, jitter: 0.2, seed: s.seed })}
          style={{ fill: c(i % 3 ? 'wood' : 'bark'), stroke: c('bark-dark'), opacity: 0.8 }}
          strokeWidth={i % 3 ? 0 : 1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      {tufts.map((t, i) => (
        <Tuft key={i} {...t} />
      ))}
    </g>
  );
}

import { useId } from 'react';
import { blob, rng, roughPoly, c } from '../../scene/shape.js';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const sw = (w = 1.8) => ({ strokeWidth: w });

const q = (p0, k, p2, u) => (1 - u) ** 2 * p0 + 2 * u * (1 - u) * k + u * u * p2;

export function ToriiGate({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="1" rx="30" ry="4" style={{ fill: c('bark-dark'), opacity: 0.2 }} />
      {[-1, 1].map((side) => (
        <g key={side}>
          <path d={`M${side * 23},0 L${side * 16},0 L${side * 17},-48 L${side * 22},-48Z`} style={{ ...OUT, fill: c('fire-red') }} {...sw()} />
          <path d={`M${side * 19.5 + 0.8},-7 L${side * 19.5 + 2.8},-7 L${side * 19.5 + 2.2},-47 L${side * 19.5 + 0.8},-47Z`} style={{ fill: c('bark-dark'), opacity: 0.25 }} />
          <path d={`M${side * 23.2},0 L${side * 15.8},0 L${side * 16.1},-7 L${side * 22.9},-7Z`} style={{ ...OUT, fill: c('bark-dark') }} {...sw()} />
        </g>
      ))}
      <path d="M-29,-37 L29,-37 L29,-32 L-29,-32Z" style={{ ...OUT, fill: c('fire-red') }} {...sw()} />
      <path d="M-3,-46 L3,-46 L3,-37 L-3,-37Z" style={{ ...OUT, fill: c('fire-red') }} {...sw(1.4)} />
      <path d="M-31,-51 L31,-51 L31,-46 L-31,-46Z" style={{ ...OUT, fill: c('fire-red') }} {...sw()} />
      <path d="M-39,-60 Q0,-52 39,-60 L35,-51 Q0,-47 -35,-51Z" style={{ ...OUT, fill: c('bark-dark') }} {...sw()} />
      <path d="M-31,-56 Q0,-50.5 31,-56" style={{ fill: 'none', stroke: c('bark'), strokeLinecap: 'round' }} strokeWidth="1.4" />
    </g>
  );
}

const PAGODA_TIERS = [0, 1, 2, 3, 4].map((i) => ({ bw: 30 - i * 4, rw: 60 - i * 7 }));

export function Pagoda({ x, y, s = 1 }) {
  const parts = [];
  let yb = -8;
  PAGODA_TIERS.forEach(({ bw, rw }, i) => {
    const top = yb - 12;
    const yr = top + 2;
    parts.push(
      <g key={i}>
        <path d={`M${-bw / 2},${yb} L${bw / 2},${yb} L${bw / 2},${top} L${-bw / 2},${top}Z`} style={{ ...OUT, fill: c('wood') }} {...sw(1.6)} />
        <path d={`M${bw * 0.18},${yb - 1} L${bw / 2 - 1},${yb - 1} L${bw / 2 - 1},${top + 1} L${bw * 0.18},${top + 1}Z`} style={{ fill: c('bark'), opacity: 0.45 }} />
        {i === 0 && <path d="M-4,-8 L4,-8 L4,-17 L-4,-17Z" style={{ ...OUT, fill: c('fire-yellow') }} {...sw(1.2)} />}
        <path
          d={`M${-rw / 2},${yr - 7} Q${-rw / 2 + 6},${yr} ${-rw / 2 + 16},${yr} L${rw / 2 - 16},${yr} Q${rw / 2 - 6},${yr} ${rw / 2},${yr - 7} L${bw / 2 + 2},${yr - 11} L${-bw / 2 - 2},${yr - 11}Z`}
          style={{ ...OUT, fill: c('bark-dark') }}
          {...sw(1.6)}
        />
        <path d={`M${-rw / 2 + 5},${yr - 7.5} L${-bw / 2 - 1},${yr - 10} M${rw / 2 - 5},${yr - 7.5} L${bw / 2 + 1},${yr - 10}`} style={{ fill: 'none', stroke: c('bark'), strokeLinecap: 'round' }} strokeWidth="1.3" />
      </g>,
    );
    yb = yr - 10;
  });
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="1" rx="34" ry="5" style={{ fill: c('bark-dark'), opacity: 0.22 }} />
      <path d="M-25,0 L25,0 L22,-8 L-22,-8Z" style={{ ...OUT, fill: 'var(--kyoto-stone)' }} {...sw(1.6)} />
      {parts}
      <path d={`M0,${yb} L0,${yb - 24}`} style={{ ...OUT, fill: 'none' }} strokeWidth="2.2" />
      {[4, 9, 14, 19].map((d) => (
        <ellipse key={d} cy={yb - d} rx="3.2" ry="1.3" style={{ fill: c('bark-dark') }} />
      ))}
      <circle cy={yb - 26} r="2.6" style={{ ...OUT, fill: c('fire-yellow') }} strokeWidth="1.2" />
    </g>
  );
}

export function StoneLantern({ x, y, s = 1, lit = false }) {
  const stone = { ...OUT, fill: 'var(--kyoto-stone)' };
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {lit && <circle className="lantern-glow" cy="-29" r="26" style={{ fill: c('fire-yellow'), opacity: 0.35 }} />}
      <ellipse cy="1" rx="15" ry="3.5" style={{ fill: c('bark-dark'), opacity: 0.22 }} />
      <path d="M-12,0 L12,0 L10,-5 L-10,-5Z" style={stone} {...sw(1.6)} />
      <path d="M-4,-5 L4,-5 L4,-20 L-4,-20Z" style={stone} {...sw(1.6)} />
      <path d="M1,-6 L3,-6 L3,-19 L1,-19Z" style={{ fill: 'var(--kyoto-stone-shade)', opacity: 0.6 }} />
      <path d="M-10,-20 L10,-20 L9,-24 L-9,-24Z" style={stone} {...sw(1.6)} />
      <path d="M-7,-24 L7,-24 L7,-34 L-7,-34Z" style={stone} {...sw(1.6)} />
      <path d="M-3.5,-26 L3.5,-26 L3.5,-32 L-3.5,-32Z" style={{ fill: lit ? c('fire-yellow') : c('bark-dark'), opacity: lit ? 1 : 0.55 }} />
      <path d="M-17,-35 Q-12,-33 -9,-34.5 L9,-34.5 Q12,-33 17,-35 L7,-42 L-7,-42Z" style={stone} {...sw(1.6)} />
      <path d="M3,-35.5 L10,-35.5 Q13,-34.5 15,-35.5 L7,-41 L3,-41Z" style={{ fill: 'var(--kyoto-stone-shade)', opacity: 0.5 }} />
      <circle cy="-45" r="3" style={stone} strokeWidth="1.4" />
    </g>
  );
}

const LEAF = 'M0,0 Q7,-3.2 17,0 Q7,3.2 0,0Z';

export function BambooCluster({ x, y, s = 1, seed = 1, count = 6 }) {
  const r = rng(seed);
  const stalks = Array.from({ length: count }, (_, i) => {
    const dx = (i - (count - 1) / 2) * 8 + (r() - 0.5) * 4;
    const h = 95 + r() * 40;
    const leaves = [0, 1, 2].map((k) => ({ y: -h + 8 + k * 14 + r() * 6, side: (k + i) % 2 ? 1 : -1, tilt: 10 + r() * 25 }));
    return { dx, h, back: i % 2 === 1, dur: 4.5 + r() * 2, delay: r() * 5, leaves };
  });
  const order = [...stalks.filter((t) => t.back), ...stalks.filter((t) => !t.back)];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="1" rx={count * 5 + 8} ry="4" style={{ fill: c('bark-dark'), opacity: 0.2 }} />
      {order.map((t, i) => {
        const w = 6;
        return (
          <g key={i} className="sway" style={{ animationDuration: `${t.dur}s`, animationDelay: `${-t.delay}s` }}>
            <path d={`M${t.dx - w / 2},0 L${t.dx + w / 2},0 L${t.dx + w / 2 - 0.6},${-t.h} L${t.dx - w / 2 + 0.6},${-t.h}Z`} style={{ ...OUT, fill: c('pine') }} {...sw(1.5)} />
            <path d={`M${t.dx + 0.6},-2 L${t.dx + w / 2 - 0.6},-2 L${t.dx + w / 2 - 1.1},${-t.h + 2} L${t.dx + 0.6},${-t.h + 2}Z`} style={{ fill: c('pine-dark'), opacity: t.back ? 0.7 : 0.4 }} />
            {Array.from({ length: Math.floor(t.h / 26) }, (_, k) => (
              <path key={k} d={`M${t.dx - w / 2},${-20 - k * 26} L${t.dx + w / 2},${-20 - k * 26}`} style={{ ...OUT, fill: 'none', opacity: 0.7 }} strokeWidth="1" />
            ))}
            {t.leaves.map((l, k) => (
              <path
                key={`l${k}`}
                d={LEAF}
                transform={`translate(${t.dx} ${l.y}) rotate(${l.side > 0 ? -l.tilt : 180 + l.tilt})`}
                style={{ ...OUT, fill: k % 2 ? c('pine-dark') : c('pine') }}
                {...sw(1.2)}
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}

export function ArchedBridge({ x, y, s = 1 }) {
  const posts = [0.1, 0.24, 0.38, 0.5, 0.62, 0.76, 0.9].map((u) => ({
    x0: q(-56, 0, 56, u),
    y0: q(0, -44, 0, u),
    x1: q(-54, 0, 54, u),
    y1: q(-10, -56, -10, u),
  }));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="3" rx="44" ry="4" style={{ fill: c('bark-dark'), opacity: 0.22 }} />
      {posts.map((p, i) => (
        <g key={i}>
          <path d={`M${p.x0},${p.y0} L${p.x1},${p.y1}`} style={{ stroke: c('bark-dark'), strokeLinecap: 'round' }} strokeWidth="4.6" />
          <path d={`M${p.x0},${p.y0} L${p.x1},${p.y1}`} style={{ stroke: c('fire-red'), strokeLinecap: 'round' }} strokeWidth="2.4" />
        </g>
      ))}
      <path d="M-56,0 Q0,-44 56,0 L49,0 Q0,-35 -49,0Z" style={{ ...OUT, fill: c('fire-red') }} {...sw(1.8)} />
      <path d="M-44,-3 Q0,-33 44,-3" style={{ fill: 'none', stroke: c('bark-dark'), opacity: 0.3, strokeLinecap: 'round' }} strokeWidth="2" />
      <path d="M-54,-10 Q0,-56 54,-10 L54,-6 Q0,-50 -54,-6Z" style={{ ...OUT, fill: c('fire-red') }} {...sw(1.6)} />
      {[-1, 1].map((side) => (
        <g key={side}>
          <path d={`M${side * 52},1 L${side * 58},1 L${side * 58},-14 L${side * 52},-14Z`} style={{ ...OUT, fill: c('fire-red') }} {...sw(1.6)} />
          <path d={`M${side * 55},-14 C${side * 51},-15 ${side * 52},-20 ${side * 55},-21 C${side * 58},-20 ${side * 59},-15 ${side * 55},-14Z`} style={{ ...OUT, fill: c('bark-dark') }} {...sw(1.2)} />
        </g>
      ))}
    </g>
  );
}

const CANOPY = [
  [0, -50, 26, 18],
  [-21, -42, 17, 13],
  [21, -42, 18, 13],
  [-11, -63, 18, 14],
  [12, -64, 18, 14],
];

export function CherryTree({ x, y, s = 1, seed = 1 }) {
  const clip = `kyoto-canopy-${useId().replace(/:/g, '')}`;
  const blobs = CANOPY.map(([bx, by, rx, ry], i) => blob(bx, by, rx, ry, { seed: seed + i * 5, points: 9, jitter: 0.1 }));
  const r = rng(seed + 40);
  const dots = Array.from({ length: 6 }, () => [(r() - 0.5) * 50, -40 - r() * 32]);
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cy="2" rx="26" ry="5" style={{ fill: c('bark-dark'), opacity: 0.22 }} />
      <path
        d={roughPoly([[-5, 0], [5, 0], [4, -22], [13, -36], [9, -38], [1, -28], [-3, -40], [-7, -39], [-4, -22]], { seed, jitter: 0.6, step: 10 })}
        style={{ ...OUT, fill: c('bark') }}
        {...sw(1.8)}
      />
      {blobs.map((d, i) => (
        <path key={`o${i}`} d={d} style={{ ...OUT, fill: 'var(--kyoto-blossom)' }} strokeWidth="3.6" />
      ))}
      <clipPath id={clip}>
        {blobs.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {blobs.map((d, i) => (
          <path key={`f${i}`} d={d} style={{ fill: 'var(--kyoto-blossom)' }} />
        ))}
        <path d={blob(16, -36, 30, 12, { seed: seed + 9, jitter: 0.15 })} style={{ fill: 'var(--kyoto-blossom-shade)', opacity: 0.85 }} />
        <path d={blob(24, -58, 10, 12, { seed: seed + 11, jitter: 0.15 })} style={{ fill: 'var(--kyoto-blossom-shade)', opacity: 0.6 }} />
      </g>
      {dots.map(([dx, dy], i) => (
        <circle key={i} cx={dx} cy={dy} r="1.6" style={{ fill: c('cream') }} />
      ))}
    </g>
  );
}

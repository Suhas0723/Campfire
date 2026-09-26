import { blob, c } from './shape.js';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const sw = (w = 2.4) => ({ strokeWidth: w, vectorEffect: 'non-scaling-stroke' });

const FLAME_RED =
  'M-58,0 C-74,-34 -60,-64 -46,-96 C-40,-78 -32,-72 -26,-84 C-24,-118 -10,-144 -2,-184 C10,-148 26,-126 26,-96 C30,-82 38,-84 44,-114 C60,-80 76,-40 58,0 C40,14 -40,14 -58,0Z';
const FLAME_ORANGE =
  'M-42,0 C-54,-28 -44,-52 -32,-76 C-26,-62 -20,-58 -16,-70 C-14,-96 -4,-116 2,-142 C12,-112 22,-96 20,-72 C24,-62 30,-64 34,-86 C46,-58 54,-28 42,0 C28,10 -28,10 -42,0Z';
const FLAME_YELLOW =
  'M-24,0 C-32,-20 -24,-40 -12,-60 C-8,-48 -4,-46 -2,-56 C2,-72 6,-82 8,-96 C16,-76 26,-52 24,-30 C30,-20 30,-8 24,0 C14,7 -14,7 -24,0Z';

const EMBERS = [
  { x: -18, dx: -40, dur: 3.2, delay: 0, r: 3, tone: 'ember' },
  { x: 8, dx: 30, dur: 2.6, delay: 0.5, r: 2.5, tone: 'fire-yellow' },
  { x: -4, dx: -18, dur: 3.8, delay: 1.1, r: 3.5, tone: 'ember' },
  { x: 20, dx: 50, dur: 3.0, delay: 1.6, r: 2.2, tone: 'fire-yellow' },
  { x: -26, dx: -60, dur: 4.2, delay: 2.2, r: 2.8, tone: 'ember' },
  { x: 12, dx: 14, dur: 2.8, delay: 2.7, r: 3, tone: 'fire-yellow' },
  { x: -10, dx: 44, dur: 3.5, delay: 0.9, r: 2.4, tone: 'ember' },
  { x: 2, dx: -34, dur: 4.6, delay: 3.1, r: 2, tone: 'fire-yellow' },
  { x: 26, dx: 24, dur: 3.3, delay: 3.6, r: 2.6, tone: 'ember' },
  { x: -30, dx: -10, dur: 2.9, delay: 1.9, r: 2.2, tone: 'fire-yellow' },
  { x: 16, dx: -52, dur: 4.0, delay: 4.1, r: 2.8, tone: 'ember' },
];

const STONES_BACK = [
  [-78, -8, 18, 11], [-50, -18, 17, 10], [-16, -22, 18, 10], [20, -22, 17, 10], [54, -18, 18, 11], [82, -6, 16, 11],
];
const STONES_FRONT = [
  [-86, 10, 19, 13], [-54, 22, 20, 13], [-16, 28, 21, 13], [24, 28, 20, 13], [60, 22, 20, 13], [90, 10, 18, 12],
];

function Stones({ list, seed }) {
  return list.map(([x, y, rx, ry], i) => (
    <g key={i}>
      <path d={blob(x, y, rx, ry, { points: 8, jitter: 0.1, seed: seed + i })} style={{ ...OUT, fill: c('bark') }} {...sw()} />
      <path d={blob(x - rx * 0.25, y - ry * 0.35, rx * 0.5, ry * 0.3, { points: 6, jitter: 0.1, seed: seed + i + 20 })} style={{ fill: c('wood'), opacity: 0.9 }} />
    </g>
  ));
}

function Stick({ x1, y1, x2, y2, w = 12 }) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const nx = (-Math.sin(a) * w) / 2;
  const ny = (Math.cos(a) * w) / 2;
  const d = `M${x1 + nx},${y1 + ny} L${x2 + nx},${y2 + ny} L${x2 - nx},${y2 - ny} L${x1 - nx},${y1 - ny}Z`;
  return (
    <g>
      <path d={d} style={{ ...OUT, fill: c('bark') }} {...sw()} />
      <ellipse cx={x1} cy={y1} rx={w * 0.4} ry={w / 2} transform={`rotate(${(a * 180) / Math.PI} ${x1} ${y1})`} style={{ ...OUT, fill: c('wood-light') }} {...sw(1.8)} />
    </g>
  );
}

export function FireGlow({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id="fire-glow">
          <stop offset="0" style={{ stopColor: c('fire-yellow'), stopOpacity: 0.95 }} />
          <stop offset="0.35" style={{ stopColor: c('ember'), stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: c('ember'), stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <ellipse className="fire-glow" cx="0" cy="0" rx="330" ry="120" fill="url(#fire-glow)" />
    </g>
  );
}

// Warm light cast over the logs and props nearest the fire.
export function FireLight({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ pointerEvents: 'none' }}>
      <defs>
        <radialGradient id="fire-light">
          <stop offset="0" style={{ stopColor: c('fire-yellow'), stopOpacity: 0.4 }} />
          <stop offset="0.6" style={{ stopColor: c('ember'), stopOpacity: 0.12 }} />
          <stop offset="1" style={{ stopColor: c('ember'), stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <ellipse className="fire-glow fire-glow-slow" cx="0" cy="-40" rx="420" ry="220" fill="url(#fire-light)" />
    </g>
  );
}

export default function Campfire({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="4" rx="96" ry="26" style={{ fill: c('bark-dark'), opacity: 0.55 }} />
      <Stones list={STONES_BACK} seed={50} />

      <Stick x1={-70} y1={8} x2={10} y2={-44} w={14} />
      <Stick x1={72} y1={6} x2={-8} y2={-46} w={14} />

      <g className="flame flame-red">
        <path d={FLAME_RED} style={{ ...OUT, fill: c('fire-red') }} {...sw(2.6)} />
      </g>
      <g className="flame flame-orange">
        <path d={FLAME_ORANGE} style={{ fill: c('fire-orange') }} />
      </g>
      <g className="flame flame-yellow">
        <path d={FLAME_YELLOW} style={{ fill: c('fire-yellow') }} />
      </g>

      <Stick x1={-50} y1={20} x2={30} y2={-20} w={15} />
      <Stick x1={52} y1={22} x2={-24} y2={-18} w={15} />

      <Stones list={STONES_FRONT} seed={70} />

      <g>
        {EMBERS.map((e, i) => (
          <circle
            key={i}
            className="ember"
            cx={e.x}
            cy={-60}
            r={e.r}
            style={{ fill: c(e.tone), '--dx': `${e.dx}px`, '--dur': `${e.dur}s`, '--delay': `${e.delay}s` }}
          />
        ))}
      </g>
    </g>
  );
}

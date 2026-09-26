import { blob, roughPoly, c } from './shape.js';

const INK = { stroke: c('bark-dark'), strokeLinejoin: 'round' };

function Cloud({ x, y, w, seed }) {
  const h = w * 0.16;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={blob(0, 0, w / 2, h, { points: 12, jitter: 0.14, seed })} style={{ fill: c('cream'), ...INK, opacity: 0.55 }} strokeWidth={1.5} strokeOpacity={0.4} vectorEffect="non-scaling-stroke" />
      <path d={blob(w * 0.05, h * 0.45, w * 0.4, h * 0.45, { points: 10, jitter: 0.1, seed: seed + 3 })} style={{ fill: c('sky-bottom'), opacity: 0.55 }} />
    </g>
  );
}

function Star({ x, y, s = 1 }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0,-7 C1,-2 2,-1 7,0 C2,1 1,2 0,7 C-1,2 -2,1 -7,0 C-2,-1 -1,-2 0,-7Z"
      style={{ fill: c('cream'), opacity: 0.85 }}
    />
  );
}

export default function Sky() {
  return (
    <g>
      <defs>
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: c('sky-top') }} />
          <stop offset="0.35" style={{ stopColor: c('sky-top') }} />
          <stop offset="0.62" style={{ stopColor: c('sky-bottom') }} />
          <stop offset="1" style={{ stopColor: c('sky-bottom') }} />
        </linearGradient>
        <radialGradient id="sun-halo">
          <stop offset="0" style={{ stopColor: c('fire-yellow'), stopOpacity: 0.9 }} />
          <stop offset="0.5" style={{ stopColor: c('fire-yellow'), stopOpacity: 0.3 }} />
          <stop offset="1" style={{ stopColor: c('sky-bottom'), stopOpacity: 0 }} />
        </radialGradient>
      </defs>

      <rect x="-50" y="-50" width="1700" height="1100" fill="url(#sky-grad)" />

      <Star x={380} y={90} s={0.9} />
      <Star x={620} y={150} s={0.6} />
      <Star x={1320} y={110} s={0.8} />
      <Star x={1480} y={200} s={0.5} />
      <Star x={880} y={70} s={0.55} />

      <Cloud x={420} y={250} w={320} seed={3} />
      <Cloud x={1250} y={300} w={260} seed={9} />
      <Cloud x={880} y={200} w={180} seed={15} />

      <circle cx="1170" cy="585" r="280" fill="url(#sun-halo)" />
      <path d={blob(1170, 585, 78, 78, { points: 14, jitter: 0.02, seed: 4 })} style={{ fill: c('fire-yellow'), ...INK }} strokeWidth={2} strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />

      {/* far desert mesas */}
      <path
        d={roughPoly(
          [[-40, 610], [-40, 540], [90, 530], [140, 505], [300, 500], [340, 540], [520, 548], [580, 520], [700, 518], [760, 560], [980, 566], [1040, 530], [1190, 526], [1240, 556], [1420, 552], [1470, 512], [1600, 508], [1650, 540], [1650, 610]],
          { seed: 21, jitter: 2.2, step: 40 },
        )}
        style={{ fill: c('wood-light'), ...INK, opacity: 0.55 }}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={roughPoly(
          [[-40, 615], [-40, 575], [200, 570], [250, 552], [420, 550], [470, 580], [820, 586], [870, 560], [960, 556], [1000, 584], [1300, 588], [1350, 566], [1500, 562], [1560, 590], [1650, 588], [1650, 615]],
          { seed: 22, jitter: 2, step: 40 },
        )}
        style={{ fill: c('wood'), ...INK, opacity: 0.45 }}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </g>
  );
}

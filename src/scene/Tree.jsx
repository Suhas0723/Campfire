import { useId } from 'react';
import { blob, roughPoly, c } from './shape.js';

function tierPoints(w, h, yb) {
  const pts = [[0, yb - h], [w * 0.2, yb - h * 0.55], [w * 0.5, yb - 6]];
  const n = 6;
  for (let i = 1; i < n; i++) {
    pts.push([w / 2 - (i * w) / n, i % 2 ? yb + 7 : yb - 1]);
  }
  pts.push([-w * 0.5, yb - 6], [-w * 0.2, yb - h * 0.55]);
  return pts;
}

const PINE_TIERS = [
  { w: 150, h: 125, yb: -32 },
  { w: 120, h: 112, yb: -88 },
  { w: 88, h: 100, yb: -146 },
  { w: 54, h: 88, yb: -196 },
];

function Pine({ uid, seed, sw, simple }) {
  const trunk = roughPoly([[-9, 0], [9, 0], [8, -44], [-8, -44]], { seed, jitter: 0.8, step: 14 });
  return (
    <g>
      <path d={trunk} style={{ fill: c('bark'), stroke: c('bark-dark') }} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      {!simple && <path d="M2,-42 L8,-42 L8,-2 L3,-2Z" style={{ fill: c('bark-dark'), opacity: 0.45 }} />}
      {PINE_TIERS.map((t, i) => {
        const d = roughPoly(tierPoints(t.w, t.h, t.yb), { seed: seed + i * 7, jitter: 1.4, step: 26 });
        const clip = `${uid}-t${i}`;
        return (
          <g key={i}>
            <clipPath id={clip}>
              <path d={d} />
            </clipPath>
            <path d={d} style={{ fill: c('pine') }} />
            {!simple && (
              <g clipPath={`url(#${clip})`}>
                <path
                  d={`M${t.w * 0.06},${t.yb - t.h} C${t.w * 0.14},${t.yb - t.h * 0.5} ${t.w * 0.02},${t.yb - 10} ${t.w * 0.1},${t.yb + 12} L${t.w},${t.yb + 12} L${t.w},${t.yb - t.h}Z`}
                  style={{ fill: c('pine-dark') }}
                />
                <path d={blob(0, t.yb + 4, t.w * 0.55, 9, { seed: seed + i, jitter: 0.2 })} style={{ fill: c('pine-dark'), opacity: 0.55 }} />
                <path
                  d={`M${-t.w * 0.1},${t.yb - t.h * 0.78} C${-t.w * 0.22},${t.yb - t.h * 0.45} ${-t.w * 0.3},${t.yb - t.h * 0.2} ${-t.w * 0.36},${t.yb - 8} L${-t.w * 0.26},${t.yb - 10} C${-t.w * 0.18},${t.yb - t.h * 0.3} ${-t.w * 0.1},${t.yb - t.h * 0.55} ${-t.w * 0.1},${t.yb - t.h * 0.78}Z`}
                  style={{ fill: c('sky-bottom'), opacity: 0.35 }}
                />
              </g>
            )}
            <path d={d} style={{ fill: 'none', stroke: c('bark-dark'), strokeLinejoin: 'round' }} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}
    </g>
  );
}

const OAK_BLOBS = [
  [0, -150, 62, 50],
  [-62, -172, 52, 46],
  [64, -170, 54, 46],
  [-34, -228, 54, 48],
  [38, -236, 56, 50],
  [2, -272, 42, 34],
];

function Oak({ uid, seed, sw, simple }) {
  const trunk = roughPoly(
    [[-16, 0], [16, 0], [10, -60], [30, -110], [22, -114], [4, -84], [-2, -120], [-10, -120], [-8, -70], [-26, -104], [-32, -98], [-11, -54]],
    { seed, jitter: 0.8, step: 18 },
  );
  const blobs = OAK_BLOBS.map(([x, y, rx, ry], i) => blob(x, y, rx, ry, { points: 9, jitter: 0.1, seed: seed + i * 5 }));
  const clip = `${uid}-canopy`;
  return (
    <g>
      <path d={trunk} style={{ fill: c('bark'), stroke: c('bark-dark'), strokeLinejoin: 'round' }} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
      {!simple && <path d="M3,-2 L15,-2 L10,-60 L4,-70Z" style={{ fill: c('bark-dark'), opacity: 0.4 }} />}
      <clipPath id={clip}>
        {blobs.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </clipPath>
      {blobs.map((d, i) => (
        <path key={`o${i}`} d={d} style={{ fill: c('bark-dark'), stroke: c('bark-dark'), strokeLinejoin: 'round' }} strokeWidth={sw * 2} vectorEffect="non-scaling-stroke" />
      ))}
      {blobs.map((d, i) => (
        <path key={`f${i}`} d={d} style={{ fill: c('pine') }} />
      ))}
      {!simple && (
        <g clipPath={`url(#${clip})`}>
          <path d={blob(52, -140, 90, 60, { seed: seed + 40, jitter: 0.12 })} style={{ fill: c('pine-dark') }} />
          <path d={blob(-40, -130, 60, 26, { seed: seed + 41, jitter: 0.15 })} style={{ fill: c('pine-dark'), opacity: 0.6 }} />
          <path d={blob(-40, -240, 34, 22, { seed: seed + 42, jitter: 0.15 })} style={{ fill: c('wood-light'), opacity: 0.4 }} />
          <path d={blob(-74, -184, 22, 16, { seed: seed + 43, jitter: 0.15 })} style={{ fill: c('wood-light'), opacity: 0.35 }} />
          {blobs.slice(0, 5).map((_, i) => (
            <path
              key={`s${i}`}
              d={`M${OAK_BLOBS[i][0] - 18},${OAK_BLOBS[i][1] + 16} q10,8 22,2`}
              style={{ fill: 'none', stroke: c('bark-dark'), opacity: 0.5, strokeLinecap: 'round' }}
              strokeWidth={sw * 0.7}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      )}
    </g>
  );
}

export default function Tree({ kind = 'pine', x, y, scale = 1, depth = 'mid', seed = 1, dur = 5, delay = 0 }) {
  const uid = useId().replace(/:/g, '');
  const far = depth === 'far';
  const sw = far ? 1.4 : depth === 'near' ? 3 : 2.4;
  const Shape = kind === 'oak' ? Oak : Pine;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={far ? 0.55 : 1}>
      <g className={far ? 'sway-far' : 'sway'} style={{ animationDuration: `${dur}s`, animationDelay: `${-delay}s` }}>
        <Shape uid={uid} seed={seed} sw={sw} simple={far} />
      </g>
    </g>
  );
}

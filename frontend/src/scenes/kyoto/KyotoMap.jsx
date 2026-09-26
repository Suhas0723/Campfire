import { useMemo } from 'react';
import { blob, rng, roughPoly, c } from '../../scene/shape.js';
import { ArchedBridge, BambooCluster, CherryTree, Pagoda, StoneLantern, ToriiGate } from './Landmarks.jsx';
import './kyoto.css';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const sw = (w = 2.2) => ({ strokeWidth: w });

// Same map box as TripMap, so the story player and the globe intro line up the same way.
const W = 1000;
const H = 480;
const PAD = { l: 120, r: 120, t: 120, b: 150 };

function project(stops) {
  if (!stops.length) return [];
  const lat0 = stops.reduce((a, s) => a + s.latitude, 0) / stops.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = stops.map((s) => s.longitude * k);
  const ys = stops.map((s) => -s.latitude);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(Math.max(...xs) - minX, 1e-6);
  const spanY = Math.max(Math.max(...ys) - minY, 1e-6);
  const bw = W - PAD.l - PAD.r;
  const bh = H - PAD.t - PAD.b;
  const scale = Math.min(bw / spanX, bh / spanY);
  const ox = PAD.l + (bw - spanX * scale) / 2;
  const oy = PAD.t + (bh - spanY * scale) / 2;
  return stops.map((s, i) => ({ ...s, x: ox + (xs[i] - minX) * scale, y: oy + (ys[i] - minY) * scale }));
}

function buildLegs(points) {
  const legs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const bow = (i % 2 ? -1 : 1) * 0.22;
    legs.push({ a, b, ctrl: { x: (a.x + b.x) / 2 - (b.y - a.y) * bow, y: (a.y + b.y) / 2 + (b.x - a.x) * bow } });
  }
  return legs;
}

const lerp = (p, q, u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
const onLeg = ({ a, ctrl, b }, u) => lerp(lerp(a, ctrl, u), lerp(ctrl, b, u), u);

function legsPath(legs) {
  if (!legs.length) return '';
  return legs.reduce((d, l) => `${d} Q${l.ctrl.x},${l.ctrl.y} ${l.b.x},${l.b.y}`, `M${legs[0].a.x},${legs[0].a.y}`);
}

function travelledPath(legs, t) {
  if (!legs.length || t <= 0) return '';
  const full = Math.min(legs.length, Math.floor(t));
  let d = `M${legs[0].a.x},${legs[0].a.y}`;
  for (let i = 0; i < full; i++) d += ` Q${legs[i].ctrl.x},${legs[i].ctrl.y} ${legs[i].b.x},${legs[i].b.y}`;
  const u = t - full;
  if (full < legs.length && u > 0) {
    const leg = legs[full];
    const ctrl = lerp(leg.a, leg.ctrl, u);
    const end = onLeg(leg, u);
    d += ` Q${ctrl.x},${ctrl.y} ${end.x},${end.y}`;
  }
  return d;
}

function markerAt(points, legs, t) {
  if (!points.length) return null;
  if (!legs.length) return points[0];
  const i = Math.min(legs.length - 1, Math.floor(t));
  return onLeg(legs[i], Math.min(1, t - i));
}

function Pine({ x, y, s }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-2,0 L-2,-8 L2,-8 L2,0Z" style={{ ...OUT, fill: c('bark') }} {...sw(1.6)} />
      <path d="M0,-44 L14,-18 L7,-18 L16,-6 L-16,-6 L-7,-18 L-14,-18Z" style={{ ...OUT, fill: c('pine') }} {...sw(1.8)} />
      <path d="M0,-44 L14,-18 L7,-18 L16,-6 L4,-6 L2,-30Z" style={{ fill: c('pine-dark'), opacity: 0.6 }} />
    </g>
  );
}

function Boulders({ x, y, s, seed }) {
  const rocks = [[-16, -4, 14, 10], [6, -7, 16, 13], [22, -1, 10, 8]];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {rocks.map(([rx, ry, w, h], i) => (
        <g key={i}>
          <path d={blob(rx, ry, w, h, { seed: seed + i, points: 8, jitter: 0.1 })} style={{ ...OUT, fill: c('wood-light') }} {...sw(1.8)} />
          <path d={blob(rx + w * 0.3, ry + h * 0.3, w * 0.5, h * 0.45, { seed: seed + i + 9, points: 7, jitter: 0.1 })} style={{ fill: c('wood'), opacity: 0.6 }} />
        </g>
      ))}
    </g>
  );
}

function GreenHill({ x, y, w, h, seed }) {
  const d = roughPoly(
    Array.from({ length: 9 }, (_, i) => {
      const u = i / 8;
      return [-w / 2 + u * w, -(Math.sin(u * Math.PI) ** 0.8) * h];
    }),
    { seed, jitter: 1, step: 30 },
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={d} style={{ ...OUT, fill: c('pine') }} {...sw(2)} />
      <path d={`M${w * 0.12},${-h * 0.92} C${w * 0.3},${-h * 0.7} ${w * 0.42},${-h * 0.35} ${w * 0.48},-2 L${w * 0.1},-2 C${w * 0.2},${-h * 0.35} ${w * 0.2},${-h * 0.7} ${w * 0.12},${-h * 0.92}Z`} style={{ fill: c('pine-dark'), opacity: 0.45 }} />
    </g>
  );
}

function Stop({ stop, index, active, visited }) {
  const labelW = stop.name.length * 9 + 26;
  return (
    <g transform={`translate(${stop.x} ${stop.y})`}>
      {active && <circle r="22" className="map-stop-pulse" style={{ fill: c('fire-yellow'), opacity: 0.5 }} />}
      <circle r="11" style={{ ...OUT, fill: visited ? c('fire-orange') : c('cream') }} {...sw(2.5)} />
      <text y="4.5" textAnchor="middle" className="map-stop-num">
        {index + 1}
      </text>
      <g transform="translate(0 36)">
        <rect x={-labelW / 2} y="-15" width={labelW} height="28" rx="6" style={{ ...OUT, fill: active ? c('fire-yellow') : c('parchment') }} {...sw(2)} />
        <text y="5" textAnchor="middle" className="map-stop-label">
          {stop.name}
        </text>
      </g>
    </g>
  );
}

const STREAM = 'M530,-20 C470,50 565,120 512,192 C462,262 545,322 494,392 C458,442 478,470 452,510';

const DECOR = [
  { Kind: CherryTree, x: 592, y: 70, s: 0.95, seed: 3 },
  { Kind: CherryTree, x: 905, y: 262, s: 0.85, seed: 8 },
  { Kind: CherryTree, x: 108, y: 300, s: 0.95, seed: 13 },
  { Kind: CherryTree, x: 372, y: 300, s: 0.8, seed: 21 },
  { Kind: CherryTree, x: 578, y: 432, s: 0.8, seed: 34 },
  { Kind: Pine, x: 66, y: 196, s: 0.95 },
  { Kind: Pine, x: 150, y: 410, s: 1.05 },
  { Kind: Pine, x: 945, y: 420, s: 1 },
  { Kind: Pine, x: 930, y: 118, s: 0.9 },
  { Kind: Pine, x: 262, y: 262, s: 0.85 },
  { Kind: Boulders, x: 420, y: 408, s: 0.9, seed: 4 },
  { Kind: Boulders, x: 835, y: 436, s: 0.8, seed: 12 },
  { Kind: Boulders, x: 30, y: 350, s: 0.75, seed: 19 },
  { Kind: ArchedBridge, x: 512, y: 200, s: 0.8 },
];

// Landmark clusters sit beside each stop, in story order.
const STOP_ART = [
  [
    { Kind: ToriiGate, dx: 186, dy: -23, s: 0.56 },
    { Kind: ToriiGate, dx: 161, dy: -13, s: 0.64 },
    { Kind: ToriiGate, dx: 133, dy: -1, s: 0.72 },
    { Kind: ToriiGate, dx: 100, dy: 14, s: 0.8 },
    { Kind: StoneLantern, dx: 64, dy: -42, s: 0.7 },
  ],
  [
    { Kind: BambooCluster, dx: -50, dy: -50, s: 0.6, seed: 5, count: 7 },
    { Kind: BambooCluster, dx: -160, dy: 12, s: 0.8, seed: 2, count: 6 },
    { Kind: BambooCluster, dx: 82, dy: -20, s: 0.75, seed: 9, count: 5 },
    { Kind: BambooCluster, dx: 128, dy: 30, s: 0.62, seed: 17, count: 5 },
  ],
  [
    { Kind: Pagoda, dx: 108, dy: -8, s: 0.78 },
    { Kind: StoneLantern, dx: 64, dy: -6, s: 0.72, lit: true },
    { Kind: StoneLantern, dx: 152, dy: -4, s: 0.72, lit: true },
  ],
];

const PETALS = (() => {
  const r = rng(77);
  return Array.from({ length: 13 }, (_, i) => ({
    x: -60 + r() * 900,
    y: -30 + r() * 260,
    s: 0.8 + r() * 0.6,
    dur: 13 + r() * 6,
    delay: (i / 13) * 16 + r() * 2,
  }));
})();

function Petals() {
  return (
    <g aria-hidden="true">
      {PETALS.map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
          <path
            className="kyoto-petal"
            d="M0,-5 C4,-4.5 5.5,1.5 0,5 C-5.5,1.5 -4,-4.5 0,-5Z"
            style={{ fill: 'var(--kyoto-blossom)', stroke: c('bark-dark'), animationDuration: `${p.dur}s`, animationDelay: `${-p.delay}s` }}
            strokeWidth="1"
          />
        </g>
      ))}
    </g>
  );
}

export default function KyotoMap({ stops, position, activeIndex }) {
  const points = useMemo(() => project(stops), [stops]);
  const legs = useMemo(() => buildLegs(points), [points]);
  const scenery = useMemo(() => {
    const placed = points.flatMap((p, i) => (STOP_ART[i] || []).map(({ dx, dy, ...rest }) => ({ ...rest, x: p.x + dx, y: p.y + dy })));
    return [...DECOR, ...placed].sort((a, b) => a.y - b.y);
  }, [points]);
  const route = legsPath(legs);
  const marker = markerAt(points, legs, position);

  return (
    <svg className="trip-map kyoto-map" viewBox={`-40 -10 ${W + 80} ${H + 20}`} preserveAspectRatio="xMidYMid meet" aria-label="Illustrated map of Kyoto">
      <defs>
        <pattern id="kyoto-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0,0 L0,10" style={{ stroke: c('pine'), opacity: 0.3 }} strokeWidth="2" />
        </pattern>
      </defs>

      <rect x="-2000" y="-2000" width="5000" height="5000" style={{ fill: c('parchment') }} />
      <path d={blob(210, 290, 170, 70, { seed: 3, points: 10, jitter: 0.14 })} fill="url(#kyoto-hatch)" />
      <path d={blob(760, 420, 180, 55, { seed: 5, points: 10, jitter: 0.14 })} style={{ fill: c('pine'), opacity: 0.16 }} />
      <path d={blob(160, 110, 130, 60, { seed: 7, points: 10, jitter: 0.14 })} style={{ fill: c('pine'), opacity: 0.16 }} />
      <path d={blob(800, 120, 150, 70, { seed: 9, points: 10, jitter: 0.14 })} fill="url(#kyoto-hatch)" />

      <GreenHill x={250} y={486} w={210} h={40} seed={2} />
      <GreenHill x={880} y={488} w={190} h={44} seed={6} />
      <GreenHill x={700} y={490} w={150} h={30} seed={10} />

      <path d={STREAM} style={{ fill: 'none', stroke: 'var(--kyoto-water)', strokeLinecap: 'round' }} strokeWidth="14" />
      <path d={STREAM} style={{ fill: 'none', stroke: c('cream'), strokeLinecap: 'round', opacity: 0.7 }} strokeWidth="2" strokeDasharray="10 8" />

      {scenery.map(({ Kind, ...rest }, i) => (
        <Kind key={i} {...rest} />
      ))}

      <g transform="translate(70 70)">
        <circle r="30" style={{ ...OUT, fill: c('cream') }} {...sw(2)} />
        <path d="M0,-26 L6,0 L0,26 L-6,0Z" style={{ ...OUT, fill: c('wood-light') }} {...sw(1.6)} />
        <path d="M0,-26 L6,0 L-6,0Z" style={{ ...OUT, fill: c('fire-red') }} {...sw(1.6)} />
        <text y="-34" textAnchor="middle" className="map-compass-n">
          N
        </text>
      </g>

      {route && (
        <>
          <path d={route} style={{ fill: 'none', stroke: c('bark-dark'), strokeLinecap: 'round', opacity: 0.45 }} strokeWidth="4" strokeDasharray="0.1 12" />
          <path d={travelledPath(legs, position)} style={{ fill: 'none', stroke: c('fire-red'), strokeLinecap: 'round' }} strokeWidth="6" strokeDasharray="0.1 12" />
        </>
      )}

      {points.map((s, i) => (
        <Stop key={`${s.name}-${i}`} stop={s} index={i} active={i === activeIndex} visited={i <= activeIndex} />
      ))}

      {marker && (
        <g transform={`translate(${marker.x} ${marker.y})`}>
          <ellipse cy="4" rx="14" ry="5" style={{ fill: c('bark-dark'), opacity: 0.3 }} />
          <g transform="translate(0 -14)">
            <path
              d="M0,-20 C5,-12 12,-8 12,2 C12,9 7,13 0,13 C-7,13 -12,9 -12,2 C-12,-5 -7,-8 -5,-14 C-3,-10 -2,-8 -1,-7 C0,-11 -1,-15 0,-20Z"
              className="map-marker-flame"
              style={{ ...OUT, fill: c('fire-red') }}
              {...sw(2.2)}
            />
            <path d="M0,-4 C3,0 6,2 6,6 C6,9 3,11 0,11 C-3,11 -6,9 -6,6 C-6,3 -2,1 0,-4Z" style={{ fill: c('fire-yellow') }} />
          </g>
        </g>
      )}

      <Petals />
    </svg>
  );
}

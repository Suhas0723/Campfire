import { useMemo } from 'react';
import { blob, rng, roughPoly, c } from '../scene/shape.js';
import { frameViewBox, readableScales, useMapFrame } from './mapFrame.js';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const sw = (w = 2.2) => ({ strokeWidth: w });

const W = 1000;
const H = 480;
const PAD = { l: 120, r: 120, t: 120, b: 150 };

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Equirectangular projection fitted into the padded map box, keeping the real aspect ratio.
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

// Each leg is a quadratic curve that bows to alternating sides, so the route looks walked, not ruled.
function buildLegs(points) {
  const legs = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const bow = (i % 2 ? -1 : 1) * 0.22;
    legs.push({ a, b, ctrl: { x: (a.x + b.x) / 2 - dy * bow, y: (a.y + b.y) / 2 + dx * bow } });
  }
  return legs;
}

const lerp = (p, q, u) => ({ x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u });
const onLeg = ({ a, ctrl, b }, u) => lerp(lerp(a, ctrl, u), lerp(ctrl, b, u), u);

function legsPath(legs) {
  if (!legs.length) return '';
  return legs.reduce((d, l) => `${d} Q${l.ctrl.x},${l.ctrl.y} ${l.b.x},${l.b.y}`, `M${legs[0].a.x},${legs[0].a.y}`);
}

// Route drawn up to position t, where t runs from 0 (first stop) to legs.length (last stop).
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

function Hills({ x, y, s, seed }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={roughPoly([[-50, 0], [-18, -46], [4, -30], [26, -52], [56, 0]], { seed, jitter: 1.2, step: 18 })} style={{ ...OUT, fill: c('wood') }} {...sw(2)} />
      <path d="M26,-52 L56,0 L30,0 C34,-18 30,-36 26,-52Z" style={{ fill: c('bark'), opacity: 0.45 }} />
      <path d="M-18,-46 L-8,-32 L-18,-36 L-26,-32Z" style={{ ...OUT, fill: c('cream') }} {...sw(1.4)} />
    </g>
  );
}

function Shrub({ x, y, s, seed }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={blob(0, -8, 14, 9, { seed, points: 8, jitter: 0.18 })} style={{ ...OUT, fill: c('pine') }} {...sw(1.6)} />
      <path d={blob(4, -5, 8, 5, { seed: seed + 1, points: 7, jitter: 0.15 })} style={{ fill: c('pine-dark'), opacity: 0.5 }} />
    </g>
  );
}

const DECOR = [Pine, Pine, Boulders, Hills, Shrub, Pine];

function useScenery(seedKey, points, legs) {
  return useMemo(() => {
    const r = rng(hash(seedKey));
    const avoid = [...points.map((p) => ({ ...p, rad: 70 }))];
    for (const leg of legs) {
      for (let u = 0; u <= 1; u += 0.1) avoid.push({ ...onLeg(leg, u), rad: 44 });
    }
    for (const p of points) avoid.push({ x: p.x, y: p.y + 40, rad: 60 });
    avoid.push({ x: 70, y: 70, rad: 60 });

    const items = [];
    let guard = 0;
    while (items.length < 22 && guard++ < 600) {
      const x = 30 + r() * (W - 60);
      const y = 60 + r() * (H - 90);
      if (avoid.some((a) => Math.hypot(a.x - x, a.y - y) < a.rad)) continue;
      const Kind = DECOR[Math.floor(r() * DECOR.length)];
      items.push({ Kind, x, y, s: 0.7 + r() * 0.6, seed: Math.floor(r() * 999) });
      avoid.push({ x, y, rad: 48 });
    }
    const patches = Array.from({ length: 4 }, (_, i) => ({
      x: 120 + r() * 760,
      y: 100 + r() * 300,
      rx: 140 + r() * 140,
      ry: 60 + r() * 50,
      seed: i + 3,
      hatch: i % 2 === 1,
    }));
    return { items: items.sort((a, b) => a.y - b.y), patches };
  }, [seedKey, points, legs]);
}

function labelFits(stop, labelW, box, scales) {
  if (!box) return true;
  const half = (labelW * scales.label) / 2 + 8;
  const top = stop.y + 20 * scales.marker;
  const bottom = top + 28 * scales.label;
  return stop.x - half >= box.x && stop.x + half <= box.x + box.w && top >= box.y && bottom <= box.y + box.h;
}

function Stop({ stop, index, active, visited, scales = null, box = null }) {
  const labelW = stop.name.length * 9 + 26;
  const showLabel = !scales || active || labelFits(stop, labelW, box, scales);
  if (!scales) {
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
  return (
    <g transform={`translate(${stop.x} ${stop.y})`}>
      <g transform={`scale(${scales.marker})`}>
        {active && <circle r="22" className="map-stop-pulse" style={{ fill: c('fire-yellow'), opacity: 0.5 }} />}
        <circle r="11" style={{ ...OUT, fill: visited ? c('fire-orange') : c('cream') }} {...sw(2.5)} />
        <text y="4.5" textAnchor="middle" className="map-stop-num">
          {index + 1}
        </text>
      </g>
      <g transform={`translate(0 ${36 * scales.marker}) scale(${scales.label})`}>
        {showLabel && (
          <>
            <rect x={-labelW / 2} y="-15" width={labelW} height="28" rx="6" style={{ ...OUT, fill: active ? c('fire-yellow') : c('parchment') }} {...sw(2)} />
            <text y="5" textAnchor="middle" className="map-stop-label">
              {stop.name}
            </text>
          </>
        )}
      </g>
    </g>
  );
}

export default function TripMap({ stops, seedKey, position, activeIndex, frame = false }) {
  const points = useMemo(() => project(stops), [stops]);
  const legs = useMemo(() => buildLegs(points), [points]);
  const scenery = useScenery(seedKey, points, legs);
  const route = legsPath(legs);
  const marker = markerAt(points, legs, position);
  const focus = frame && points.length ? points[Math.min(points.length - 1, Math.max(0, activeIndex))] : null;
  const { hostRef, box } = useMapFrame(Boolean(focus), focus);
  const scales = frame && box ? readableScales(box.px) : null;

  return (
    <svg
      ref={hostRef}
      className={frame ? 'trip-map is-framed' : 'trip-map'}
      viewBox={box ? frameViewBox(box) : `-40 -10 ${W + 80} ${H + 20}`}
      preserveAspectRatio={frame ? 'xMidYMid slice' : 'xMidYMid meet'}
      aria-label="Illustrated map of the trip route"
    >
      <defs>
        <pattern id="map-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0,0 L0,10" style={{ stroke: c('wood-light'), opacity: 0.35 }} strokeWidth="2" />
        </pattern>
      </defs>

      <rect x="-2000" y="-2000" width="5000" height="5000" style={{ fill: c('parchment') }} />
      {scenery.patches.map((p, i) => (
        <path
          key={i}
          d={blob(p.x, p.y, p.rx, p.ry, { seed: p.seed, points: 10, jitter: 0.14 })}
          fill={p.hatch ? 'url(#map-hatch)' : undefined}
          style={p.hatch ? undefined : { fill: c('wood-light'), opacity: 0.4 }}
        />
      ))}

      <path d="M-40,450 C120,430 200,470 330,450 C460,430 520,480 700,460 C820,446 900,480 1040,462" style={{ fill: 'none', stroke: c('sky-bottom'), strokeLinecap: 'round' }} strokeWidth="12" />
      <path d="M-40,450 C120,430 200,470 330,450 C460,430 520,480 700,460 C820,446 900,480 1040,462" style={{ fill: 'none', stroke: c('wood-light'), strokeLinecap: 'round', opacity: 0.7 }} strokeWidth="2" strokeDasharray="10 8" />

      {scenery.items.map(({ Kind, ...rest }, i) => (
        <Kind key={i} {...rest} />
      ))}

      <g className="map-compass" transform="translate(70 70)">
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
        <Stop key={`${s.name}-${i}`} stop={s} index={i} active={i === activeIndex} visited={i <= activeIndex} scales={scales} box={box} />
      ))}

      {marker && (
        <g transform={scales ? `translate(${marker.x} ${marker.y}) scale(${scales.marker})` : `translate(${marker.x} ${marker.y})`}>
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
    </svg>
  );
}

import { useEffect, useRef, useState } from 'react';
import { blob, roughPoly, c } from '../scene/shape.js';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const sw = (w = 2.2) => ({ strokeWidth: w });

const ROUTE_D = 'M150,330 C230,334 270,178 370,170 C470,162 530,304 640,300 C750,296 770,150 860,140';

function JoshuaTree({ x, y, s = 1, flip = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-3,0 L-2,-26 L-12,-38 L-9,-40 L0,-31 L4,-46 L8,-45 L4,-26 L3,0Z" style={{ ...OUT, fill: c('bark') }} {...sw(1.8)} />
      <path d={blob(-12, -42, 7, 6, { seed: 3, points: 7, jitter: 0.2 })} style={{ ...OUT, fill: c('pine') }} {...sw(1.8)} />
      <path d={blob(6, -50, 8, 7, { seed: 5, points: 7, jitter: 0.2 })} style={{ ...OUT, fill: c('pine') }} {...sw(1.8)} />
    </g>
  );
}

function Boulders({ x, y, s = 1, seed = 1 }) {
  const rocks = [
    [-26, -6, 22, 16],
    [8, -10, 26, 20],
    [34, -2, 16, 12],
    [-6, -30, 18, 15],
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {rocks.map(([rx, ry, w, h], i) => (
        <g key={i}>
          <path d={blob(rx, ry, w, h, { seed: seed + i, points: 8, jitter: 0.1 })} style={{ ...OUT, fill: c('wood-light') }} {...sw()} />
          <path d={blob(rx + w * 0.3, ry + h * 0.3, w * 0.5, h * 0.45, { seed: seed + i + 9, points: 7, jitter: 0.1 })} style={{ fill: c('wood'), opacity: 0.6 }} />
        </g>
      ))}
    </g>
  );
}

function Stop({ stop, index, active, visited }) {
  const labelW = stop.name.length * 9 + 26;
  return (
    <g transform={`translate(${stop.x} ${stop.y})`} className={active ? 'map-stop is-active' : 'map-stop'}>
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

export default function TripMap({ stops, progress, activeIndex }) {
  const routeRef = useRef(null);
  const [marker, setMarker] = useState({ x: stops[0].x, y: stops[0].y });

  useEffect(() => {
    const path = routeRef.current;
    if (!path) return;
    const pt = path.getPointAtLength(path.getTotalLength() * progress);
    setMarker({ x: pt.x, y: pt.y });
  }, [progress]);

  return (
    <svg className="trip-map" viewBox="-40 -10 1080 500" preserveAspectRatio="xMidYMid meet" aria-label="Illustrated map of the Joshua Tree route">
      <defs>
        <mask id="route-travelled">
          <path d={ROUTE_D} pathLength="1" fill="none" stroke="#fff" strokeWidth="20" strokeDasharray={`${progress} 1`} />
        </mask>
        <pattern id="map-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <path d="M0,0 L0,10" style={{ stroke: c('wood-light'), opacity: 0.35 }} strokeWidth="2" />
        </pattern>
      </defs>

      <rect x="-2000" y="-2000" width="5000" height="5000" style={{ fill: c('parchment') }} />
      <path d={blob(250, 380, 260, 110, { seed: 4, points: 11, jitter: 0.12 })} style={{ fill: c('wood-light'), opacity: 0.45 }} />
      <path d={blob(720, 200, 300, 120, { seed: 8, points: 11, jitter: 0.12 })} style={{ fill: c('wood-light'), opacity: 0.35 }} />
      <path d={blob(560, 420, 200, 60, { seed: 12, points: 9, jitter: 0.15 })} fill="url(#map-hatch)" />
      <path d={blob(120, 110, 150, 70, { seed: 14, points: 9, jitter: 0.15 })} fill="url(#map-hatch)" />

      {/* dry wash */}
      <path d="M-10,440 C120,420 200,460 330,440 C460,420 520,470 700,450 C820,436 900,470 1010,452" style={{ fill: 'none', stroke: c('sky-bottom'), strokeLinecap: 'round' }} strokeWidth="12" />
      <path d="M-10,440 C120,420 200,460 330,440 C460,420 520,470 700,450 C820,436 900,470 1010,452" style={{ fill: 'none', stroke: c('wood-light'), strokeLinecap: 'round', opacity: 0.7 }} strokeWidth="2" strokeDasharray="10 8" />

      {/* Ryan Mountain */}
      <g transform="translate(860 150)">
        <path d={roughPoly([[-110, 20], [-30, -86], [0, -104], [30, -80], [120, 20]], { seed: 31, jitter: 1.4, step: 24 })} style={{ ...OUT, fill: c('wood') }} {...sw(2.5)} />
        <path d="M0,-104 L30,-80 L120,20 L20,20 C30,-20 10,-60 0,-104Z" style={{ fill: c('bark'), opacity: 0.55 }} />
        <path d="M-30,-86 L0,-104 L30,-80 L14,-72 L0,-82 L-16,-68Z" style={{ ...OUT, fill: c('cream') }} {...sw(2)} />
      </g>
      <g transform="translate(730 160)">
        <path d={roughPoly([[-70, 12], [-10, -50], [60, 12]], { seed: 32, jitter: 1.2, step: 20 })} style={{ ...OUT, fill: c('wood-light') }} {...sw(2.2)} />
      </g>

      {/* Arch Rock */}
      <g transform="translate(640 272)">
        <path d="M-52,20 C-56,-20 -40,-50 0,-52 C40,-50 56,-20 52,20 L30,20 C30,-4 18,-24 0,-24 C-18,-24 -30,-4 -30,20Z" style={{ ...OUT, fill: c('wood-light') }} {...sw(2.5)} />
        <path d="M20,-44 C40,-36 50,-14 52,20 L38,20 C38,-8 32,-28 20,-44Z" style={{ fill: c('wood'), opacity: 0.7 }} />
      </g>

      {/* Hidden Valley: ring of boulders */}
      <Boulders x={320} y={150} s={0.8} seed={40} />
      <Boulders x={430} y={140} s={0.7} seed={50} />
      <JoshuaTree x={372} y={140} s={0.9} />

      <Boulders x={140} y={300} s={1} seed={60} />

      {[[80, 250, 1.1], [240, 260, 0.9, true], [520, 220, 1], [470, 360, 1.2, true], [780, 330, 1], [920, 300, 0.9, true], [60, 400, 1], [340, 420, 0.8], [960, 420, 1.1, true], [560, 120, 0.8]].map(([x, y, s, flip], i) => (
        <JoshuaTree key={i} x={x} y={y} s={s} flip={flip} />
      ))}

      {/* compass rose */}
      <g transform="translate(70 70)">
        <circle r="30" style={{ ...OUT, fill: c('cream') }} {...sw(2)} />
        <path d="M0,-26 L6,0 L0,26 L-6,0Z" style={{ ...OUT, fill: c('wood-light') }} {...sw(1.6)} />
        <path d="M0,-26 L6,0 L-6,0Z" style={{ ...OUT, fill: c('fire-red') }} {...sw(1.6)} />
        <text y="-34" textAnchor="middle" className="map-compass-n">N</text>
      </g>

      <path ref={routeRef} d={ROUTE_D} style={{ fill: 'none', stroke: c('bark-dark'), strokeLinecap: 'round', opacity: 0.45 }} strokeWidth="4" strokeDasharray="0.1 12" />
      <path d={ROUTE_D} mask="url(#route-travelled)" style={{ fill: 'none', stroke: c('fire-red'), strokeLinecap: 'round' }} strokeWidth="6" strokeDasharray="0.1 12" />

      {stops.map((s, i) => (
        <Stop key={s.id} stop={s} index={i} active={i === activeIndex} visited={i <= activeIndex} />
      ))}

      <g transform={`translate(${marker.x} ${marker.y})`}>
        <ellipse cy="4" rx="14" ry="5" style={{ fill: c('bark-dark'), opacity: 0.3 }} />
        <g transform="translate(0 -14)">
          <path d="M0,-20 C5,-12 12,-8 12,2 C12,9 7,13 0,13 C-7,13 -12,9 -12,2 C-12,-5 -7,-8 -5,-14 C-3,-10 -2,-8 -1,-7 C0,-11 -1,-15 0,-20Z" className="map-marker-flame" style={{ ...OUT, fill: c('fire-red') }} {...sw(2.2)} />
          <path d="M0,-4 C3,0 6,2 6,6 C6,9 3,11 0,11 C-3,11 -6,9 -6,6 C-6,3 -2,1 0,-4Z" style={{ fill: c('fire-yellow') }} />
        </g>
      </g>
    </svg>
  );
}

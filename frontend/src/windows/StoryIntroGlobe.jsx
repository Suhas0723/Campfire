import { useEffect, useRef } from 'react';
import { geoGraticule, geoOrthographic, geoPath } from 'd3-geo';
import { interpolate } from 'd3-interpolate';
import { feature } from 'topojson-client';
import landTopology from 'world-atlas/land-110m.json';
import { c } from '../scene/shape.js';

const LAND = feature(landTopology, landTopology.objects.land);
const GRATICULE = geoGraticule().step([20, 20])();

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const FLAME = 'M0,-20 C5,-12 12,-8 12,2 C12,9 7,13 0,13 C-7,13 -12,9 -12,2 C-12,-5 -7,-8 -5,-14 C-3,-10 -2,-8 -1,-7 C0,-11 -1,-15 0,-20Z';
const FLAME_CORE = 'M0,-4 C3,0 6,2 6,6 C6,9 3,11 0,11 C-3,11 -6,9 -6,6 C-6,3 -2,1 0,-4Z';

// Timeline in milliseconds.
const T = { turn: 2500, pin: 4500, zoom: 5000, reveal: 6300, end: 7200 };
const STILL = { hold: 1200, end: 1800 };
const SPIN = 12;
const TURN = 60;
const TILT = [-24, -12];
const GRID_OPACITY = 0.35;

const clamp01 = (u) => Math.min(1, Math.max(0, u));
const phase = (t, from, to) => clamp01((t - from) / (to - from));
const easeIn = (u) => u * u * u;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

// Ease-in-out that leaves at the spin's speed, so the turn picks up where the spin was.
const SPIN_SLOPE = (SPIN * (T.pin - T.turn)) / 1000 / TURN;
const turnEase = (u) => SPIN_SLOPE * (u ** 3 - 2 * u * u + u) + 3 * u * u - 2 * u ** 3;

function dropOffset(u) {
  if (u < 0.6) return -46 * (1 - (u / 0.6) ** 2);
  return -5 * Math.sin((Math.PI * (u - 0.6)) / 0.4);
}

// TripMap draws each stop as an r=11 circle, first stop first; the pin lands on that spot.
function measureStop(stage, mapEl) {
  const svg = mapEl?.querySelector('svg');
  const stop = svg?.querySelector('circle[r="11"]');
  if (!stop) return null;
  const box = stage.getBoundingClientRect();
  const dot = stop.getBoundingClientRect();
  const view = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  return {
    x: dot.left + dot.width / 2 - box.left,
    y: dot.top + dot.height / 2 - box.top,
    k: Math.min(rect.width / view.width, rect.height / view.height),
  };
}

export default function StoryIntroGlobe({ location, onComplete, mapRef }) {
  const svgRef = useRef(null);
  const el = useRef({});
  const doneRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    completeRef.current();
  };

  useEffect(() => {
    const { lat, lng } = location;
    const end = [-lng, -lat, 0];
    const start = [end[0] - TURN - (SPIN * T.turn) / 1000, ...TILT];
    const turnFrom = [end[0] - TURN, ...TILT];
    const turn = interpolate(turnFrom, end);
    const projection = geoOrthographic().clipAngle(90).precision(0.4);
    const path = geoPath(projection);
    const n = el.current;
    const mapEl = mapRef.current;
    if (reduced && mapEl) {
      mapEl.style.opacity = '0';
      mapEl.style.clipPath = 'none';
    }

    const draw = (t) => {
      const svg = svgRef.current;
      if (!svg) return;
      const w = svg.clientWidth;
      const h = svg.clientHeight;
      const base = Math.min(w, h) * 0.35;
      const stop = measureStop(svg.parentElement, mapRef.current);
      const k = stop?.k ?? 1;
      const target = stop ?? { x: w / 2, y: h / 2 };

      let rotate = end;
      let scale = base;
      let cx = w / 2;
      let cy = h / 2;
      let grid = 1;

      if (!reduced) {
        if (t < T.turn) rotate = [start[0] + (SPIN * t) / 1000, ...TILT];
        else rotate = turn(turnEase(phase(t, T.turn, T.pin)));

        const z = phase(t, T.zoom, T.reveal);
        const far = Math.hypot(w, h) * 2.4;
        scale = base * (far / base) ** easeIn(z);
        const slide = easeInOut(z);
        cx += (target.x - cx) * slide;
        cy += (target.y - cy) * slide;
        grid = 1 - phase(t, T.zoom, T.zoom + 900);
      }

      projection.rotate(rotate).scale(scale).translate([cx, cy]);

      for (const name of ['ocean', 'outline', 'clip', 'rim']) {
        n[name].setAttribute('cx', cx);
        n[name].setAttribute('cy', cy);
        n[name].setAttribute('r', scale);
      }
      n.shadow.setAttribute('cx', cx + 6);
      n.shadow.setAttribute('cy', cy + 6);
      n.shadow.setAttribute('r', scale);

      const land = path(LAND) || '';
      n.land.setAttribute('d', land);
      n.landShade.setAttribute('d', land);
      n.grid.setAttribute('d', grid > 0 ? path(GRATICULE) || '' : '');
      n.grid.style.opacity = GRID_OPACITY * grid;

      const drop = reduced ? 1 : phase(t, T.pin, T.zoom);
      const [px, py] = projection([lng, lat]) ?? [cx, cy];
      n.pin.setAttribute('transform', `translate(${px} ${py}) scale(${k})`);
      n.pin.style.opacity = reduced ? 1 : clamp01(drop / 0.15);
      n.drop.setAttribute('transform', `translate(0 ${reduced ? 0 : dropOffset(drop)})`);
      n.pinShadow.style.opacity = 0.3 * clamp01(drop / 0.6);
      const glow = reduced ? 1 : phase(t, T.pin + 300, T.pin + 900);
      n.glow.setAttribute('r', 12 + 22 * glow);
      n.glow.style.opacity = glow > 0 && glow < 1 ? 0.5 * (1 - glow) : 0;
      n.label.style.opacity = reduced ? 1 : phase(t, T.pin + 250, T.pin + 500);

      const map = mapRef.current;
      if (!map) return;
      if (reduced) {
        map.style.opacity = phase(t, STILL.hold, STILL.end);
      } else {
        const reveal = easeInOut(phase(t, T.reveal, T.end));
        const cover = Math.max(Math.hypot(target.x, target.y), Math.hypot(w - target.x, target.y), Math.hypot(target.x, h - target.y), Math.hypot(w - target.x, h - target.y));
        map.style.clipPath = `circle(${reveal * cover}px at ${target.x}px ${target.y}px)`;
      }
    };

    const total = reduced ? STILL.end : T.end;
    let raf;
    let t0;
    const tick = (now) => {
      t0 ??= now;
      const t = now - t0;
      draw(Math.min(t, total));
      if (t >= total) finish();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (mapEl) {
        mapEl.style.opacity = '';
        mapEl.style.clipPath = '';
      }
    };
  }, [location, mapRef, reduced]);

  const ref = (name) => (node) => {
    el.current[name] = node;
  };
  const labelW = location.name.length * 9 + 26;

  return (
    <div className="intro-globe">
      <svg ref={svgRef} aria-label={`Globe turning to ${location.name}`}>
        <defs>
          <clipPath id="intro-globe-clip">
            <circle ref={ref('clip')} />
          </clipPath>
          <radialGradient id="intro-globe-rim">
            <stop offset="0.78" style={{ stopColor: c('bark-dark'), stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: c('bark-dark'), stopOpacity: 0.3 }} />
          </radialGradient>
        </defs>

        <circle ref={ref('shadow')} style={{ fill: c('bark-dark'), opacity: 0.35 }} />
        <circle ref={ref('ocean')} style={{ fill: c('parchment') }} />
        <g clipPath="url(#intro-globe-clip)">
          <path ref={ref('grid')} style={{ fill: 'none', stroke: c('wood'), opacity: GRID_OPACITY }} strokeWidth="1" />
          <path ref={ref('landShade')} transform="translate(3 3)" style={{ fill: c('pine-dark') }} />
          <path ref={ref('land')} style={{ ...OUT, fill: c('pine') }} strokeWidth="2" />
        </g>
        <circle ref={ref('rim')} fill="url(#intro-globe-rim)" />
        <circle ref={ref('outline')} style={{ ...OUT, fill: 'none' }} strokeWidth="2.5" />

        <g ref={ref('pin')} style={{ opacity: 0 }}>
          <circle ref={ref('glow')} style={{ fill: c('fire-yellow'), opacity: 0 }} />
          <ellipse ref={ref('pinShadow')} cy="4" rx="14" ry="5" style={{ fill: c('bark-dark'), opacity: 0 }} />
          <g ref={ref('drop')}>
            <g transform="translate(0 -14)">
              <path d={FLAME} className="map-marker-flame" style={{ ...OUT, fill: c('fire-red') }} strokeWidth="2.2" />
              <path d={FLAME_CORE} style={{ fill: c('fire-yellow') }} />
            </g>
          </g>
          <g ref={ref('label')} transform="translate(0 36)" style={{ opacity: 0 }}>
            <rect x={-labelW / 2} y="-15" width={labelW} height="28" rx="6" style={{ ...OUT, fill: c('fire-yellow') }} strokeWidth="2" />
            <text y="5" textAnchor="middle" className="map-stop-label">
              {location.name}
            </text>
          </g>
        </g>
      </svg>

      <button className="player-exit intro-skip" onClick={finish}>
        Skip intro
      </button>
    </div>
  );
}

import { blob, roughPoly, c } from './shape.js';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const sw = { strokeWidth: 2.4, vectorEffect: 'non-scaling-stroke' };

export function Lantern({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="30" ry="7" style={{ fill: c('bark-dark'), opacity: 0.3 }} />
      <circle className="lantern-glow" cx="0" cy="-30" r="44" style={{ fill: c('fire-yellow'), opacity: 0.35 }} />
      <path d="M-13,-58 C-14,-80 14,-80 13,-58" style={{ ...OUT, fill: 'none' }} {...sw} />
      <path d={roughPoly([[-16, -58], [16, -58], [12, -50], [-12, -50]], { seed: 2, jitter: 0.5, step: 10 })} style={{ ...OUT, fill: c('bark') }} {...sw} />
      <path d={roughPoly([[-12, -50], [12, -50], [14, -10], [-14, -10]], { seed: 3, jitter: 0.6, step: 12 })} style={{ ...OUT, fill: c('fire-yellow') }} {...sw} />
      <path d="M-6,-44 L-7,-16 L-2,-16 L-2,-44Z" style={{ fill: c('cream'), opacity: 0.85 }} />
      <path d="M0,-30 C-4,-34 -2,-40 0,-44 C2,-40 5,-34 0,-30Z" style={{ fill: c('fire-orange') }} />
      <path d="M-12,-50 L-14,-10 M12,-50 L14,-10 M0,-50 L0,-44" style={{ ...OUT, fill: 'none' }} {...sw} />
      <path d={roughPoly([[-18, -10], [18, -10], [16, 0], [-16, 0]], { seed: 4, jitter: 0.5, step: 10 })} style={{ ...OUT, fill: c('bark') }} {...sw} />
    </g>
  );
}

export function Backpack({ x, y, s = 1, rotate = 0 }) {
  const body = roughPoly([[-30, 0], [30, 0], [34, -60], [22, -86], [-22, -86], [-34, -60]], { seed: 8, jitter: 1, step: 16 });
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <ellipse cx="0" cy="2" rx="42" ry="9" style={{ fill: c('bark-dark'), opacity: 0.3 }} />
      <path d={body} style={{ fill: c('fire-red') }} />
      <path d="M8,-86 L22,-86 L34,-60 L30,0 L12,0Z" style={{ fill: c('bark-dark'), opacity: 0.25 }} />
      <path d={body} style={{ ...OUT, fill: 'none' }} {...sw} />
      <path d={roughPoly([[-26, -86], [26, -86], [30, -58], [-30, -58]], { seed: 9, jitter: 0.8, step: 14 })} style={{ ...OUT, fill: c('bark') }} {...sw} />
      <path d={roughPoly([[-20, -36], [20, -36], [18, -8], [-18, -8]], { seed: 10, jitter: 0.8, step: 12 })} style={{ ...OUT, fill: c('fire-orange') }} {...sw} />
      <path d="M-20,-26 L20,-26" style={{ ...OUT, fill: 'none', opacity: 0.6 }} {...sw} />
      <rect x="-5" y="-64" width="10" height="12" rx="2" style={{ ...OUT, fill: c('fire-yellow') }} {...sw} />
      <path d="M-14,-86 C-14,-100 14,-100 14,-86" style={{ ...OUT, fill: 'none' }} strokeWidth={3} vectorEffect="non-scaling-stroke" />
      <path d="M40,-70 C60,-50 50,-20 44,-4" style={{ ...OUT, fill: 'none', stroke: c('bark') }} strokeWidth={4} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function Guitar({ x, y, s = 1, rotate = -24 }) {
  const bodyD = 'M0,0 C-34,0 -40,-26 -30,-42 C-24,-52 -26,-58 -24,-66 C-20,-86 20,-86 24,-66 C26,-58 24,-52 30,-42 C40,-26 34,0 0,0Z';
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <path d="M-5,-80 L-4,-176 L4,-176 L5,-80Z" style={{ ...OUT, fill: c('bark') }} {...sw} />
      {[-100, -120, -140, -160].map((fy) => (
        <path key={fy} d={`M-4,${fy} L4,${fy}`} style={{ ...OUT, stroke: c('wood-light'), fill: 'none' }} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      ))}
      <path d={roughPoly([[-8, -176], [8, -176], [7, -204], [-7, -204]], { seed: 13, jitter: 0.6, step: 10 })} style={{ ...OUT, fill: c('bark') }} {...sw} />
      <circle cx="-9" cy="-186" r="2.5" style={{ ...OUT, fill: c('fire-yellow') }} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <circle cx="9" cy="-196" r="2.5" style={{ ...OUT, fill: c('fire-yellow') }} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
      <path d={bodyD} style={{ fill: c('wood-light') }} />
      <path d="M10,-4 C30,-6 38,-26 30,-42 C24,-52 26,-58 24,-66 C22,-76 16,-80 12,-82 C18,-60 22,-30 10,-4Z" style={{ fill: c('wood'), opacity: 0.8 }} />
      <path d={bodyD} style={{ ...OUT, fill: 'none' }} {...sw} />
      <circle cx="0" cy="-44" r="9" style={{ ...OUT, fill: c('bark-dark') }} {...sw} />
      <rect x="-10" y="-20" width="20" height="5" rx="2" style={{ ...OUT, fill: c('bark') }} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      <path d="M-2,-18 L-2,-176 M2,-18 L2,-176" style={{ stroke: c('cream'), opacity: 0.7 }} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

export function Pinecone({ x, y, s = 1, rotate = 0, seed = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${s})`}>
      <path d={blob(0, 0, 13, 8, { points: 8, jitter: 0.08, seed })} style={{ ...OUT, fill: c('bark') }} {...sw} />
      <path d="M-7,-3 l3,3 l-3,3 M-1,-4 l3,4 l-3,4 M5,-3 l3,3 l-3,3" style={{ ...OUT, stroke: c('wood-light'), fill: 'none' }} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />
    </g>
  );
}

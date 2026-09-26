import { roughPoly, c } from './shape.js';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };

export default function Log({ x, y, length = 160, thick = 38, rotate = 0, cap = 'right', seed = 1, scale = 1 }) {
  const L = length / 2;
  const H = thick / 2;
  const body = roughPoly([[-L, -H], [L, -H], [L, H], [-L, H]], { seed, jitter: 1.2, step: 24 });
  const capX = cap === 'right' ? L : -L;
  const capRx = H * 0.42;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <ellipse cx="0" cy={H + 4} rx={L + 10} ry="8" style={{ fill: c('bark-dark'), opacity: 0.3 }} />
      <path d={body} style={{ fill: c('wood') }} />
      <path d={`M${-L + 2},${H * 0.25} L${L - 2},${H * 0.25} L${L - 2},${H - 1} L${-L + 2},${H - 1}Z`} style={{ fill: c('bark'), opacity: 0.9 }} />
      <path d={`M${-L + 8},${-H * 0.55} L${L - 12},${-H * 0.62}`} style={{ ...OUT, stroke: c('wood-light'), fill: 'none' }} strokeWidth={4} vectorEffect="non-scaling-stroke" />
      {[-0.6, -0.25, 0.15, 0.5].map((t, i) => (
        <path
          key={i}
          d={`M${L * t},${-H * 0.2} q${6 + i},${H * 0.3} ${2},${H * 0.7}`}
          style={{ ...OUT, fill: 'none', opacity: 0.55 }}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={body} style={{ ...OUT, fill: 'none' }} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
      <ellipse cx={capX} cy="0" rx={capRx} ry={H} style={{ ...OUT, fill: c('wood-light') }} strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
      <ellipse cx={capX} cy="0" rx={capRx * 0.6} ry={H * 0.62} style={{ fill: 'none', stroke: c('wood'), opacity: 0.9 }} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      <ellipse cx={capX} cy="0" rx={capRx * 0.25} ry={H * 0.26} style={{ fill: c('wood') }} />
    </g>
  );
}

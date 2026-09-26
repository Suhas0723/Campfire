import { c } from '../scene/shape.js';

const OUT = { stroke: c('bark-dark'), strokeLinejoin: 'round', strokeLinecap: 'round' };
const sw = (w = 2.5) => ({ strokeWidth: w });

function Icon({ size = 56, children, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {children}
    </svg>
  );
}

const Shadow = () => <ellipse cx="32" cy="58" rx="20" ry="3.5" style={{ fill: c('bark-dark'), opacity: 0.35 }} />;

export function FlameLogo({ size = 30 }) {
  return (
    <Icon size={size}>
      <path
        d="M32,6 C38,16 50,22 50,38 C50,50 42,58 32,58 C22,58 14,50 14,40 C14,30 20,26 22,18 C26,24 26,28 28,30 C30,22 30,14 32,6Z"
        style={{ ...OUT, fill: c('fire-red') }}
        {...sw(3)}
      />
      <path d="M32,24 C36,32 42,36 42,44 C42,51 37,55 32,55 C26,55 22,51 22,45 C22,39 26,37 27,32 C29,35 30,36 31,37 C32,32 31,28 32,24Z" style={{ fill: c('fire-orange') }} />
      <path d="M32,38 C35,42 37,45 37,48 C37,51 35,53 32,53 C29,53 27,51 27,48 C27,45 30,43 32,38Z" style={{ fill: c('fire-yellow') }} />
    </Icon>
  );
}

export function MapIcon(p) {
  return (
    <Icon {...p}>
      <Shadow />
      <path d="M8,14 L22,9 L42,15 L56,10 L56,50 L42,55 L22,49 L8,54Z" style={{ ...OUT, fill: c('parchment') }} {...sw()} />
      <path d="M22,9 L42,15 L42,55 L22,49Z" style={{ fill: c('wood-light'), opacity: 0.55 }} />
      <path d="M22,9 L22,49 M42,15 L42,55" style={{ ...OUT, fill: 'none' }} {...sw(2)} />
      <path d="M8,14 L22,9 L42,15 L56,10 L56,50 L42,55 L22,49 L8,54Z" style={{ ...OUT, fill: 'none' }} {...sw()} />
      <path d="M13,44 C18,36 24,40 28,32 C32,24 40,30 44,24" style={{ fill: 'none', stroke: c('fire-red'), strokeLinecap: 'round' }} strokeWidth={2.4} strokeDasharray="0.5 5" />
      <path d="M46,18 l6,6 M52,18 l-6,6" style={{ ...OUT, stroke: c('fire-red'), fill: 'none' }} {...sw(3)} />
      <path d="M12,24 l4,-6 l4,6Z M30,46 l3,-5 l3,5Z" style={{ ...OUT, fill: c('wood') }} {...sw(1.5)} />
    </Icon>
  );
}

export function MoonIcon(p) {
  return (
    <Icon {...p}>
      <Shadow />
      <path d="M40,8 C26,10 16,20 16,33 C16,46 27,56 40,56 C46,56 50,54 54,51 C38,50 28,42 28,30 C28,20 34,12 40,8Z" style={{ ...OUT, fill: c('fire-yellow') }} {...sw()} />
      <path d="M22,40 C24,48 32,54 42,55 C30,52 24,46 22,40Z" style={{ fill: c('ember'), opacity: 0.7 }} />
      <circle cx="23" cy="30" r="3" style={{ fill: c('sky-top'), opacity: 0.7 }} />
      <circle cx="28" cy="44" r="2" style={{ fill: c('sky-top'), opacity: 0.7 }} />
      <path d="M48,18 l1.5,4 l4,1.5 l-4,1.5 l-1.5,4 l-1.5,-4 l-4,-1.5 l4,-1.5Z" style={{ ...OUT, fill: c('cream') }} {...sw(1.5)} />
      <circle cx="54" cy="36" r="2" style={{ ...OUT, fill: c('cream') }} {...sw(1.2)} />
    </Icon>
  );
}

function Print({ x, y, r }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0,-16 C7,-16 9,-8 8,-2 C7,4 4,6 0,6 C-4,6 -7,4 -8,-2 C-9,-8 -7,-16 0,-16Z" style={{ ...OUT, fill: c('wood') }} {...sw(2.2)} />
      <path d="M0,9 C5,9 6,12 5,15 C4,18 -4,18 -5,15 C-6,12 -5,9 0,9Z" style={{ ...OUT, fill: c('wood') }} {...sw(2.2)} />
      <path d="M-4,-9 L4,-9 M-4,-3 L4,-3" style={{ ...OUT, stroke: c('bark'), fill: 'none' }} {...sw(1.6)} />
    </g>
  );
}

export function FootprintsIcon(p) {
  return (
    <Icon {...p}>
      <Shadow />
      <Print x={22} y={38} r={-12} />
      <Print x={42} y={24} r={10} />
    </Icon>
  );
}

export function CompassIcon(p) {
  return (
    <Icon {...p}>
      <Shadow />
      <rect x="28" y="4" width="8" height="7" rx="2" style={{ ...OUT, fill: c('wood') }} {...sw(2)} />
      <circle cx="32" cy="33" r="23" style={{ ...OUT, fill: c('wood') }} {...sw()} />
      <circle cx="32" cy="33" r="17" style={{ ...OUT, fill: c('cream') }} {...sw(2)} />
      <path d="M32,18 L32,21 M32,45 L32,48 M17,33 L20,33 M44,33 L47,33" style={{ ...OUT, fill: 'none' }} {...sw(2)} />
      <path d="M32,33 L38,21 L35,35Z" style={{ ...OUT, fill: c('fire-red') }} {...sw(1.8)} />
      <path d="M32,33 L26,45 L29,31Z" style={{ ...OUT, fill: c('wood-light') }} {...sw(1.8)} />
      <circle cx="32" cy="33" r="2.5" style={{ ...OUT, fill: c('fire-yellow') }} {...sw(1.5)} />
      <path d="M16,24 C18,19 22,15 27,13" style={{ fill: 'none', stroke: c('wood-light'), strokeLinecap: 'round' }} strokeWidth={2.5} />
    </Icon>
  );
}

export function LanternIcon(p) {
  return (
    <Icon {...p}>
      <Shadow />
      <circle cx="32" cy="36" r="20" style={{ fill: c('fire-yellow'), opacity: 0.35 }} />
      <path d="M24,16 C24,4 40,4 40,16" style={{ ...OUT, fill: 'none' }} {...sw()} />
      <path d="M21,16 L43,16 L40,21 L24,21Z" style={{ ...OUT, fill: c('bark') }} {...sw()} />
      <path d="M24,21 L40,21 L42,49 L22,49Z" style={{ ...OUT, fill: c('fire-yellow') }} {...sw()} />
      <path d="M27,24 L26,46 L29,46 L30,24Z" style={{ fill: c('cream') }} />
      <path d="M32,40 C28,37 29,32 32,28 C35,32 36,37 32,40Z" style={{ ...OUT, fill: c('fire-orange') }} {...sw(1.5)} />
      <path d="M24,21 L22,49 M40,21 L42,49" style={{ ...OUT, fill: 'none' }} {...sw()} />
      <path d="M19,49 L45,49 L43,56 L21,56Z" style={{ ...OUT, fill: c('bark') }} {...sw()} />
    </Icon>
  );
}

export function BookIcon(p) {
  return (
    <Icon {...p}>
      <Shadow />
      <path d="M14,12 L48,10 L50,50 L16,54Z" style={{ ...OUT, fill: c('cream') }} {...sw()} />
      <path d="M12,10 L46,8 L48,48 L14,52Z" style={{ ...OUT, fill: c('fire-red') }} {...sw()} />
      <path d="M12,10 L20,9.5 L22,51 L14,52Z" style={{ ...OUT, fill: c('bark') }} {...sw()} />
      <path d="M36,26 L52,25 L52,35 L36,36Z" style={{ ...OUT, fill: c('bark') }} {...sw(2.2)} />
      <circle cx="44" cy="30.5" r="3" style={{ ...OUT, fill: c('fire-yellow') }} {...sw(1.6)} />
      <path d="M26,16 L40,15.3 M26,21 L36,20.5" style={{ fill: 'none', stroke: c('fire-yellow'), strokeLinecap: 'round' }} strokeWidth={2} />
      <path d="M28,44 C32,40 36,44 40,40" style={{ fill: 'none', stroke: c('ember'), strokeLinecap: 'round', opacity: 0.8 }} strokeWidth={2} />
    </Icon>
  );
}

export function CloseIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2,2.4 C4.5,4.8 7,7.4 10,9.8 M9.8,2 C7.4,4.6 4.8,7.2 2.2,10" style={{ ...OUT, fill: 'none' }} strokeWidth={2.2} />
    </svg>
  );
}

export function PlayIcon({ size = 14, color = 'bark-dark' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3,1.8 C3,1 3.8,0.6 4.5,1 L12,6.2 C12.6,6.6 12.6,7.4 12,7.8 L4.5,13 C3.8,13.4 3,13 3,12.2Z" style={{ fill: c(color), stroke: c('bark-dark'), strokeLinejoin: 'round' }} strokeWidth={1.4} />
    </svg>
  );
}

export function PauseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true">
      <rect x="2.5" y="1.5" width="3.4" height="11" rx="1.2" style={{ fill: c('bark-dark') }} />
      <rect x="8.1" y="1.5" width="3.4" height="11" rx="1.2" style={{ fill: c('bark-dark') }} />
    </svg>
  );
}

export function CameraIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3,8 C3,7 4,6 5,6 L8,6 L9.5,4 L14.5,4 L16,6 L19,6 C20,6 21,7 21,8 L21,18 C21,19 20,20 19,20 L5,20 C4,20 3,19 3,18Z" style={{ ...OUT, fill: c('wood-light') }} strokeWidth={1.8} />
      <circle cx="12" cy="13" r="4" style={{ ...OUT, fill: c('cream') }} strokeWidth={1.8} />
      <circle cx="12" cy="13" r="1.6" style={{ fill: c('bark-dark') }} />
      <circle cx="17.5" cy="9" r="1" style={{ fill: c('fire-red') }} />
    </svg>
  );
}

export function PinIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8,15 C5,11 3,8.6 3,6.2 C3,3.4 5.2,1.4 8,1.4 C10.8,1.4 13,3.4 13,6.2 C13,8.6 11,11 8,15Z" style={{ ...OUT, fill: c('fire-red') }} strokeWidth={1.5} />
      <circle cx="8" cy="6.2" r="2" style={{ fill: c('cream') }} />
    </svg>
  );
}

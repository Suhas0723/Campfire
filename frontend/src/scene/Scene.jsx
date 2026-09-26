import { memo, useMemo } from 'react';
import Sky from './Sky.jsx';
import Tree from './Tree.jsx';
import Ground, { Tuft } from './Ground.jsx';
import { useTufts } from './useTufts.js';
import Log from './Log.jsx';
import Campfire, { FireGlow, FireLight } from './Campfire.jsx';
import { Backpack, Guitar, Lantern, Pinecone } from './Props.jsx';
import { rng, c } from './shape.js';

const FIRE = { x: 980, y: 790 };

const MID_TREES = [
  { kind: 'pine', x: 150, y: 648, scale: 1.0 },
  { kind: 'oak', x: 320, y: 664, scale: 0.85 },
  { kind: 'pine', x: 470, y: 640, scale: 0.78 },
  { kind: 'pine', x: 610, y: 650, scale: 0.66 },
  { kind: 'oak', x: 1340, y: 656, scale: 0.9 },
  { kind: 'pine', x: 1480, y: 646, scale: 1.0 },
  { kind: 'pine', x: 1250, y: 640, scale: 0.62 },
];

function useFarTrees() {
  return useMemo(() => {
    const r = rng(101);
    const trees = [];
    for (let row = 0; row < 2; row++) {
      let x = -30 + r() * 30;
      while (x < 1640) {
        trees.push({
          kind: r() < 0.72 ? 'pine' : 'oak',
          x,
          y: row === 0 ? 600 + r() * 6 : 614 + r() * 8,
          scale: row === 0 ? 0.26 + r() * 0.1 : 0.38 + r() * 0.14,
          seed: Math.floor(r() * 9999),
          dur: 4 + r() * 3,
          delay: r() * 7,
        });
        x += (row === 0 ? 30 : 48) + r() * 30;
      }
    }
    return trees.sort((a, b) => a.y - b.y);
  }, []);
}

function Scene() {
  const far = useFarTrees();
  const mid = useMemo(() => {
    const r = rng(202);
    return MID_TREES.map((t) => ({ ...t, seed: Math.floor(r() * 9999), dur: 4 + r() * 3, delay: r() * 7 })).sort((a, b) => a.y - b.y);
  }, []);
  const foreTufts = useTufts(77, 14, 930, 1000, 1.1, 1.6);

  return (
    <div className="scene" aria-hidden="true">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" width="100%" height="100%">
        <Sky />
        {far.map((t, i) => (
          <Tree key={`f${i}`} depth="far" {...t} />
        ))}
        <Ground />
        {mid.map((t, i) => (
          <Tree key={`m${i}`} depth="mid" {...t} />
        ))}

        <FireGlow x={FIRE.x} y={FIRE.y + 6} />

        <Log x={820} y={712} length={180} rotate={-7} cap="left" seed={3} scale={0.86} />
        <Log x={1150} y={714} length={180} rotate={8} cap="right" seed={4} scale={0.86} />
        <Log x={700} y={806} length={150} rotate={-58} cap="left" seed={5} />
        <Log x={1262} y={808} length={150} rotate={56} cap="right" seed={6} />

        <Pinecone x={900} y={728} rotate={20} seed={3} s={0.9} />
        <Lantern x={1236} y={742} s={0.9} />

        <Campfire x={FIRE.x} y={FIRE.y} />

        <Backpack x={610} y={890} rotate={-6} />
        <Log x={850} y={900} length={200} rotate={5} cap="left" seed={7} />
        <Log x={1120} y={906} length={190} rotate={-5} cap="right" seed={8} />
        <Guitar x={790} y={920} rotate={-26} s={0.95} />
        <Pinecone x={1310} y={880} rotate={-14} seed={5} />
        <Pinecone x={1336} y={892} rotate={30} seed={6} s={0.8} />
        <Pinecone x={560} y={936} rotate={10} seed={7} s={0.9} />

        <FireLight x={FIRE.x} y={FIRE.y} />

        {foreTufts.map((t, i) => (
          <Tuft key={`ft${i}`} {...t} />
        ))}

        <Tree kind="pine" depth="near" x={40} y={1070} scale={2.3} seed={901} dur={6.4} delay={1.3} />
        <Tree kind="oak" depth="near" x={1600} y={1070} scale={2.2} seed={902} dur={5.6} delay={3.1} />

        <defs>
          <radialGradient id="vignette" cx="0.5" cy="0.55" r="0.75">
            <stop offset="0.55" style={{ stopColor: c('bark-dark'), stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: c('bark-dark'), stopOpacity: 0.4 }} />
          </radialGradient>
        </defs>
        <rect x="-50" y="-50" width="1700" height="1100" fill="url(#vignette)" style={{ pointerEvents: 'none' }} />
      </svg>
    </div>
  );
}

export default memo(Scene);

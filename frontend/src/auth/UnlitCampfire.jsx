import Campfire from '../scene/Campfire.jsx';

export default function UnlitCampfire({ width = 180 }) {
  return (
    <svg className="campfire-unlit" width={width} viewBox="-115 -60 230 110" aria-hidden="true">
      <Campfire x={0} y={0} />
    </svg>
  );
}

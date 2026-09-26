import { BookIcon, BubbleIcon, CompassIcon, FootprintsIcon, LanternIcon, MapIcon, MoonIcon } from './icons.jsx';

const LEFT_ICONS = [
  { id: 'trip', label: 'Desert trip', Icon: MapIcon },
  { id: 'nightly', label: 'Nightly recaps', Icon: MoonIcon },
  { id: 'quests', label: 'Side quests', Icon: FootprintsIcon },
  { id: 'next', label: 'Next fire', Icon: CompassIcon },
  { id: 'talk', label: 'Talk to Campfire', Icon: BubbleIcon },
];

const RIGHT_ICONS = [
  { id: 'settings', label: 'Settings', Icon: LanternIcon },
  { id: 'offrecord', label: 'Off the record', Icon: BookIcon },
];

function DesktopIcon({ id, label, Icon, active, onOpen }) {
  return (
    <button className={`desk-icon${active ? ' is-active' : ''}`} onClick={() => onOpen(id)}>
      <Icon size={52} className="desk-icon-art" />
      <span className="desk-icon-label">{label}</span>
    </button>
  );
}

export default function Desktop({ openIds, onOpen }) {
  return (
    <>
      <div className="desk-column desk-left">
        {LEFT_ICONS.map((i) => (
          <DesktopIcon key={i.id} {...i} active={openIds.includes(i.id)} onOpen={onOpen} />
        ))}
      </div>
      <div className="desk-column desk-right">
        {RIGHT_ICONS.map((i) => (
          <DesktopIcon key={i.id} {...i} active={openIds.includes(i.id)} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

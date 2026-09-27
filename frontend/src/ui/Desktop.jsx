import { BookIcon, FootprintsIcon, MapIcon, MoonIcon, TicketIcon } from './icons.jsx';

const LEFT_ICONS = [
  { id: 'trip', label: 'Desert trip', Icon: MapIcon },
  { id: 'kyoto', label: 'Kyoto spring break', Icon: MapIcon },
  { id: 'plans', label: 'Plans', Icon: TicketIcon },
  { id: 'nightly', label: 'Nightly recaps', Icon: MoonIcon },
  { id: 'quests', label: 'Side quests', Icon: FootprintsIcon },
];

const RIGHT_ICONS = [{ id: 'offrecord', label: 'Off the record', Icon: BookIcon }];

function DesktopIcon({ id, label, Icon, active, onOpen }) {
  return (
    <button className={`desk-icon${active ? ' is-active' : ''}`} onClick={() => onOpen(id)}>
      <Icon size={52} className="desk-icon-art" />
      <span className="desk-icon-label">{label}</span>
    </button>
  );
}

export default function Desktop({ openIds, onOpen, labels = {}, canOpen = () => true }) {
  return (
    <>
      <div className="desk-column desk-left">
        {LEFT_ICONS.filter((i) => canOpen(i.id)).map((i) => (
          <DesktopIcon key={i.id} {...i} label={labels[i.id] || i.label} active={openIds.includes(i.id)} onOpen={onOpen} />
        ))}
      </div>
      <div className="desk-column desk-right">
        {RIGHT_ICONS.filter((i) => canOpen(i.id)).map((i) => (
          <DesktopIcon key={i.id} {...i} active={openIds.includes(i.id)} onOpen={onOpen} />
        ))}
      </div>
    </>
  );
}

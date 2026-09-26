import { FlameLogo } from './icons.jsx';

const NAV = [
  { id: 'trip', label: 'Trips' },
  { id: 'nightly', label: 'Nightly' },
  { id: 'quests', label: 'Side quests' },
  { id: 'next', label: 'Next fire' },
];

export default function TopBar({ onOpen }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => onOpen('trip')}>
        <FlameLogo size={28} />
        <span>Campfire</span>
      </button>
      <nav className="topnav" aria-label="Main">
        {NAV.map((n) => (
          <button key={n.id} className="topnav-link" onClick={() => onOpen(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
      <button className="btn-primary" onClick={() => onOpen('start')}>
        Start a trip
      </button>
    </header>
  );
}

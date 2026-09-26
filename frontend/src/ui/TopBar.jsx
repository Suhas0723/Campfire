import { FlameLogo } from './icons.jsx';
import UserMenu from '../auth/UserMenu.jsx';

const NAV = [
  { id: 'fires', label: 'Trips' },
  { id: 'nightly', label: 'Nightly' },
  { id: 'quests', label: 'Side quests' },
  { id: 'next', label: 'Next fire' },
];

export default function TopBar({ onOpen, canOpen = () => true, onEndNight, endingNight, nightNote }) {
  return (
    <header className="topbar">
      <button className="brand" onClick={() => onOpen('fires')}>
        <FlameLogo size={28} />
        <span>Campfire</span>
      </button>
      <nav className="topnav" aria-label="Main">
        {NAV.filter((n) => canOpen(n.id)).map((n) => (
          <button key={n.id} className="topnav-link" onClick={() => onOpen(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        {onEndNight && (
          <button className="btn-night" type="button" onClick={onEndNight} disabled={endingNight}>
            {endingNight ? 'Sending tonight’s recap…' : 'Tonight’s recap'}
          </button>
        )}
        {nightNote && <span className="night-note">{nightNote}</span>}
        <button className="btn-primary" onClick={() => onOpen('start')}>
          Start a trip
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

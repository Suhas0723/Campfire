import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompassIcon, FlameLogo, LanternIcon } from './icons.jsx';
import UserMenu from '../auth/UserMenu.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import useIsMobile from './useIsMobile.js';

const HEADER_NAV = [
  { id: 'fires', label: 'Your fires', Icon: FlameLogo },
  { id: 'next', label: 'Next fire', Icon: CompassIcon },
  { id: 'settings', label: 'Settings', Icon: LanternIcon },
];

function MenuIcon() {
  return (
    <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
      <path d="M1 1.5 H17 M1 7 H17 M1 12.5 H17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function MobileTopBar({ onOpen, canOpen, onEndNight, endingNight, nightNote }) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const go = (id) => {
    setOpen(false);
    onOpen(id);
  };

  const leave = async () => {
    setOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <header className="topbar topbar-mobile" ref={wrapRef}>
      <button className="brand" onClick={() => go('fires')}>
        <FlameLogo size={24} />
        <span>Campfire</span>
      </button>
      <button type="button" className="m-menu" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <MenuIcon />
      </button>
      {open && (
        <div className="m-sheet" role="menu" aria-label="Menu">
          <button type="button" role="menuitem" onClick={() => go('fires')}>
            Trips
          </button>
          {canOpen('next') && (
            <button type="button" role="menuitem" onClick={() => go('next')}>
              Next fire
            </button>
          )}
          {canOpen('start') && (
            <button type="button" role="menuitem" onClick={() => go('start')}>
              Start a trip
            </button>
          )}
          {onEndNight && (
            <button type="button" role="menuitem" onClick={onEndNight} disabled={endingNight}>
              {endingNight ? 'Ending the night…' : 'End the night'}
            </button>
          )}
          <button type="button" role="menuitem" onClick={leave}>
            Sign out
          </button>
          {nightNote && <p className="m-sheet-note">{nightNote}</p>}
        </div>
      )}
    </header>
  );
}

export default function TopBar({ onOpen, canOpen = () => true, onEndNight, endingNight, nightNote }) {
  const { mobile } = useIsMobile();
  if (mobile) {
    return <MobileTopBar onOpen={onOpen} canOpen={canOpen} onEndNight={onEndNight} endingNight={endingNight} nightNote={nightNote} />;
  }
  return (
    <header className="topbar">
      <nav className="topnav" aria-label="Main">
        {HEADER_NAV.filter((item) => canOpen(item.id)).map(({ id, label, Icon }) => (
          <button key={id} className="topnav-link topnav-item" onClick={() => onOpen(id)}>
            <Icon size={26} />
            {label}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        {onEndNight && (
          <button className="btn-night" type="button" onClick={onEndNight} disabled={endingNight}>
            {endingNight ? 'Ending the night…' : 'End the night'}
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

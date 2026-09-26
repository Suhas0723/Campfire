import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthProvider.jsx';
import { firstName } from './authUtils.js';

export default function UserMenu() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRef = useRef(null);
  const name = firstName(user);

  useEffect(() => {
    if (!open) return undefined;
    itemRef.current?.focus();
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const leave = async () => {
    setOpen(false);
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        className="user-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu-list"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="user-menu-name">{name}</span>
        <span className="voice-avatar user-avatar" aria-hidden="true">
          {name[0]}
        </span>
      </button>
      {open && (
        <div className="user-menu-list" id="user-menu-list" role="menu" aria-label={`Signed in as ${user?.name}`}>
          <button ref={itemRef} className="user-menu-item" role="menuitem" onClick={leave}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

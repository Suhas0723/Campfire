import { useRef } from 'react';
import { CloseIcon } from './icons.jsx';

export default function Window({ id, title, pos, z, width, full = false, closable = true, onMove, onFocus, onClose, children, className = '' }) {
  const drag = useRef(null);

  const onPointerDown = (e) => {
    if (full || e.button !== 0 || e.target.closest('button')) return;
    onFocus(id);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!drag.current) return;
    const x = Math.min(Math.max(e.clientX - drag.current.dx, 60 - width), window.innerWidth - 60);
    const y = Math.min(Math.max(e.clientY - drag.current.dy, 66), window.innerHeight - 40);
    onMove(id, { x, y });
  };

  const endDrag = () => {
    drag.current = null;
  };

  return (
    <section
      className={`window${full ? ' is-full' : ''} ${className}`}
      style={full ? { zIndex: z } : { left: pos.x, top: pos.y, zIndex: z, width }}
      onPointerDown={() => onFocus(id)}
      role="dialog"
      aria-label={title}
    >
      <header
        className="window-titlebar"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="window-title">{title}</span>
        {closable && (
          <button className="window-close" onClick={() => onClose(id)} aria-label={`Close ${title}`}>
            <CloseIcon />
          </button>
        )}
      </header>
      <div className="window-body">{children}</div>
    </section>
  );
}

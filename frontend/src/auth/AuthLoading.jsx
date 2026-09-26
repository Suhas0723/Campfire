import { FlameLogo } from '../ui/icons.jsx';

export default function AuthLoading() {
  return (
    <div className="auth-loading" role="status">
      <span className="auth-loading-flame">
        <FlameLogo size={64} />
      </span>
      <span className="visually-hidden">Checking who's by the fire…</span>
    </div>
  );
}

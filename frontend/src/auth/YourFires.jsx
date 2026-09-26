import { FlameLogo } from '../ui/icons.jsx';
import Polaroid from '../ui/Polaroid.jsx';
import { formatDateRange } from '../data/trip.js';
import UnlitCampfire from './UnlitCampfire.jsx';

const TILTS = [-4, 3, -2, 5];

function TripRow({ trip, tilt, onPlay }) {
  const titleId = `fire-${trip.id}`;
  return (
    <li className="fire-row" aria-labelledby={titleId}>
      <div className="fire-row-cover">
        <Polaroid label={trip.cover?.label || 'Not taken yet'} by={trip.cover?.by || 'nobody yet'} tilt={tilt} />
      </div>
      <div className="fire-row-main">
        <h2 className="fire-row-title" id={titleId}>
          {trip.title}
        </h2>
        <p className="fire-row-meta">
          {trip.status === 'active' ? 'Still going' : trip.status === 'paused' ? 'Paused' : 'Closed'}
          {(trip.location_name || trip.started_at) && <span className="dot" />}
          {trip.location_name}
          {trip.location_name && trip.started_at && <span className="dot" />}
          {formatDateRange(trip.started_at, trip.status === 'active' || trip.status === 'paused' ? null : trip.ended_at)}
        </p>
        <ul className="crew-dots" aria-label={`With ${trip.participants.join(', ')}`}>
          {trip.participants.map((name) => (
            <li key={name} className="voice-avatar crew-dot" title={name} aria-hidden="true">
              {name[0]}
            </li>
          ))}
        </ul>
      </div>
      <div className="fire-row-action">
        {trip.story_ready ? (
          <button className="btn-primary" onClick={() => onPlay(trip)} aria-describedby={titleId}>
            Sit around the campfire
          </button>
        ) : (
          <button className="btn-primary" disabled aria-describedby={titleId}>
            Story coming soon
          </button>
        )}
      </div>
    </li>
  );
}

export default function YourFires({ trips, tripsStatus, onPlayTrip }) {
  if (tripsStatus === 'loading') {
    return (
      <div className="state-msg">
        <FlameLogo size={40} />
        <strong>Gathering your fires…</strong>
      </div>
    );
  }
  if (tripsStatus === 'error') {
    return (
      <div className="state-msg">
        <FlameLogo size={40} />
        <strong>We couldn't reach Campfire.</strong>
        <p>Check your connection and refresh the page.</p>
      </div>
    );
  }
  if (!trips.length) {
    return (
      <div className="state-msg fires-empty">
        <UnlitCampfire />
        <strong>No fires yet.</strong>
        <p>
          Add Campfire to a group chat and type <strong className="fires-command">/campfire start</strong> on your next trip.
        </p>
      </div>
    );
  }
  return (
    <div className="fires">
      <h1 className="display-title">Your fires</h1>
      <p className="fires-subtitle">
        {trips.length} {trips.length === 1 ? 'trip' : 'trips'} with the people you care about.
      </p>
      <ul className="fire-list">
        {trips.map((trip, i) => (
          <TripRow key={trip.id} trip={trip} tilt={TILTS[i % TILTS.length]} onPlay={onPlayTrip} />
        ))}
      </ul>
    </div>
  );
}

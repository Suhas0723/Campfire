import sample from '../mock/trip.json';
import { CameraIcon, FlameLogo, FootprintsIcon, PlayIcon } from '../ui/icons.jsx';
import Polaroid from '../ui/Polaroid.jsx';
import { countNights, estimateMs, formatDateRange, formatMinutes } from '../data/trip.js';

const { nightly, sideQuests, behindTheCamera, photos } = sample;

function SampleBadge({ show }) {
  return show ? <span className="badge-sample">Sample</span> : null;
}

function StateMessage({ title, children }) {
  return (
    <div className="state-msg">
      <FlameLogo size={40} />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}

export default function DesertTrip({ data, onPlay }) {
  if (data.status === 'loading') return <StateMessage title="Gathering the story…" />;
  if (data.status === 'missing') return <StateMessage title="We couldn't find that trip.">The link may be old, or the trip was removed.</StateMessage>;
  if (data.status === 'empty') {
    return <StateMessage title="No trips yet.">Add Campfire to your WhatsApp trip group and send /campfire start. Your trip shows up here.</StateMessage>;
  }

  const { trip, segments, source } = data;
  const live = source === 'api';
  const nights = countNights(trip.started_at, trip.ended_at);
  const storyMs = segments.reduce((a, s) => a + estimateMs(s), 0);
  const quest = sideQuests[0];

  return (
    <div className="journal">
      {source === 'sample' && <p className="sample-chip">Sample trip · the backend isn't connected</p>}

      <div className="journal-head">
        <p className="eyebrow">
          {trip.place || trip.group_name}
          {trip.status === 'active' && <span className="live-chip">Listening now</span>}
        </p>
        <h1 className="display-title">{trip.name}</h1>
        <p className="journal-meta">
          {formatDateRange(trip.started_at, trip.ended_at)}
          {nights != null && (
            <>
              <span className="dot" /> {nights} {nights === 1 ? 'night' : 'nights'}
            </>
          )}
          {trip.crew?.length > 0 && (
            <>
              <span className="dot" /> {trip.crew.join(', ')}
            </>
          )}
        </p>
      </div>

      <button className="campfire-play" onClick={onPlay} disabled={!segments.length}>
        <span className="campfire-play-disc">
          <PlayIcon size={22} color="fire-yellow" />
        </span>
        <span className="campfire-play-text">
          <strong>Sit around the campfire</strong>
          <span>{segments.length ? `The whole trip, told in one sitting · ${formatMinutes(storyMs)}` : "The story isn't ready yet"}</span>
        </span>
        <FlameLogo size={40} />
      </button>

      <h2 className="section-title">
        Nightly recaps <SampleBadge show={live} />
      </h2>
      <ul className="recap-list">
        {nightly.map((n) => (
          <li key={n.id} className="recap-row">
            <span className="recap-night">{n.night}</span>
            <span className="recap-title">{n.title}</span>
            <button className="play-link" onClick={onPlay}>
              <PlayIcon size={11} color="fire-orange" /> Play
            </button>
            <span className="recap-dur">{n.duration}</span>
          </li>
        ))}
      </ul>

      <h2 className="section-title">
        Side quest <SampleBadge show={live} />
      </h2>
      <div className="quest-card">
        <FootprintsIcon size={44} />
        <div className="quest-text">
          <span className="quest-who">{quest.who}</span>
          <strong>{quest.title}</strong>
        </div>
        <button className="play-link" onClick={onPlay}>
          <PlayIcon size={11} color="fire-orange" /> {quest.duration}
        </button>
      </div>

      <div className="behind-camera">
        <CameraIcon size={26} />
        <p>
          <span className="behind-label">
            Behind the camera <SampleBadge show={live} />
          </span>
          {behindTheCamera.line}
        </p>
      </div>

      <div className="polaroid-strip">
        {photos.map((p) => (
          <Polaroid key={p.id} {...p} />
        ))}
      </div>
    </div>
  );
}

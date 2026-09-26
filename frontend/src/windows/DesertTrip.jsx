import data from '../mock/trip.json';
import { CameraIcon, FlameLogo, FootprintsIcon, PlayIcon } from '../ui/icons.jsx';
import Polaroid from '../ui/Polaroid.jsx';

const { trip, nightly, sideQuests, behindTheCamera, photos } = data;

export default function DesertTrip({ onPlay }) {
  const quest = sideQuests[0];
  return (
    <div className="journal">
      <div className="journal-head">
        <p className="eyebrow">{trip.place}</p>
        <h1 className="display-title">{trip.title}</h1>
        <p className="journal-meta">
          {trip.dateRange} <span className="dot" /> {trip.nights} nights <span className="dot" /> {trip.crew.join(', ')}
        </p>
      </div>

      <button className="campfire-play" onClick={onPlay}>
        <span className="campfire-play-disc">
          <PlayIcon size={22} color="fire-yellow" />
        </span>
        <span className="campfire-play-text">
          <strong>Sit around the campfire</strong>
          <span>The whole trip, told in one sitting · {trip.storyLength}</span>
        </span>
        <FlameLogo size={40} />
      </button>

      <h2 className="section-title">Nightly recaps</h2>
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

      <h2 className="section-title">Side quest</h2>
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
          <span className="behind-label">Behind the camera</span>
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

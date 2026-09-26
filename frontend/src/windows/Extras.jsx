import { useState } from 'react';
import data from '../mock/trip.json';
import { BookIcon, FootprintsIcon, MapIcon, MoonIcon, PlayIcon } from '../ui/icons.jsx';

const { nightly, sideQuests, offTheRecord } = data;

export function NightlyRecaps({ onPlay }) {
  return (
    <div>
      <div className="window-intro">
        <MoonIcon size={48} />
        <p>One short story per night, stitched from that day's messages, photos and voice notes.</p>
      </div>
      <ol className="night-cards">
        {nightly.map((n) => (
          <li key={n.id} className="night-card">
            <div>
              <span className="recap-night">
                {n.night} · {n.date}
              </span>
              <strong>{n.title}</strong>
            </div>
            <button className="play-link" onClick={onPlay}>
              <PlayIcon size={11} color="fire-orange" /> {n.duration}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SideQuests({ onPlay }) {
  return (
    <div>
      <div className="window-intro">
        <FootprintsIcon size={48} />
        <p>When part of the group splits off, Campfire tells their bit separately.</p>
      </div>
      {sideQuests.map((q) => (
        <article key={q.id} className="quest-big">
          <span className="quest-who">{q.who}</span>
          <h2 className="suggestion-title">{q.title}</h2>
          <p>{q.blurb}</p>
          <button className="play-link" onClick={onPlay}>
            <PlayIcon size={11} color="fire-orange" /> Listen · {q.duration}
          </button>
        </article>
      ))}
    </div>
  );
}

const SETTINGS = [
  { id: 'voice', label: 'Use real voice notes in stories', hint: 'Clips play under the narration', on: true },
  { id: 'nightly', label: 'Make a recap every night', hint: 'Ready by the time the fire is lit', on: true },
  { id: 'faces', label: 'Blur faces of people outside the group', on: true },
  { id: 'swears', label: 'Keep the swearing in', hint: 'Marcus voted yes', on: false },
];

export function Settings() {
  const [state, setState] = useState(Object.fromEntries(SETTINGS.map((s) => [s.id, s.on])));
  const [narrator, setNarrator] = useState('Warm');
  return (
    <div className="settings">
      <h3 className="reasons-title">Narrator</h3>
      <div className="segmented" role="radiogroup" aria-label="Narrator voice">
        {['Warm', 'Dry', 'Dramatic'].map((v) => (
          <button key={v} role="radio" aria-checked={narrator === v} className={narrator === v ? 'is-on' : ''} onClick={() => setNarrator(v)}>
            {v}
          </button>
        ))}
      </div>
      <ul className="toggles">
        {SETTINGS.map((s) => (
          <li key={s.id}>
            <span>
              <strong>{s.label}</strong>
              {s.hint && <small>{s.hint}</small>}
            </span>
            <button
              role="switch"
              aria-checked={state[s.id]}
              aria-label={s.label}
              className={`switch${state[s.id] ? ' is-on' : ''}`}
              onClick={() => setState((st) => ({ ...st, [s.id]: !st[s.id] }))}
            >
              <span />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OffTheRecord() {
  return (
    <div>
      <div className="window-intro">
        <BookIcon size={48} />
        <p>These stay in the group chat. Campfire never puts them in a story.</p>
      </div>
      <ul className="record-list">
        {offTheRecord.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function StartTrip() {
  return (
    <div>
      <div className="dropzone">
        <MapIcon size={56} />
        <strong>Drop your WhatsApp chat export here</strong>
        <span>The .zip with messages, photos and voice notes</span>
      </div>
      <ol className="steps">
        <li>In WhatsApp, open the trip group and tap its name.</li>
        <li>Choose Export chat, then Include media.</li>
        <li>Drop the file here. Your first story is ready in a few minutes.</li>
      </ol>
    </div>
  );
}

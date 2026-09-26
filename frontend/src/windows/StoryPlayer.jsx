import { useEffect, useRef, useState } from 'react';
import data from '../mock/trip.json';
import TripMap from './TripMap.jsx';
import { PauseIcon, PlayIcon } from '../ui/icons.jsx';

const { route, narration, trip } = data;

// The mock plays the whole story in DEMO_SECONDS; the clock shows the real story length.
const DEMO_SECONDS = 40;
const [mm, ss] = trip.storyLength.split(':').map(Number);
const STORY_SECONDS = mm * 60 + ss;

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const BARS = [0.4, 0.8, 0.55, 1, 0.7, 0.35, 0.9, 0.6, 0.45, 0.85, 0.5, 0.75, 0.3, 0.65];

export default function StoryPlayer({ onExit }) {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = useRef(null);

  useEffect(() => {
    if (!playing) return undefined;
    let raf;
    const tick = (now) => {
      if (last.current != null) {
        const dt = (now - last.current) / 1000;
        setProgress((p) => {
          const next = p + dt / DEMO_SECONDS;
          if (next >= 1) {
            setPlaying(false);
            return 1;
          }
          return next;
        });
      }
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      last.current = null;
    };
  }, [playing]);

  const index = Math.min(narration.length - 1, Math.floor(progress * narration.length));
  const beat = narration[index];
  const activeStop = route.findIndex((s) => s.id === beat.stop);

  const togglePlay = () => {
    if (progress >= 1) setProgress(0);
    setPlaying((p) => !p);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setProgress(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)));
  };

  return (
    <div className="player">
      <div className="player-stage">
        <TripMap stops={route} progress={progress} activeIndex={activeStop} />

        <div className="player-heading">
          <span className="eyebrow">Now telling</span>
          <strong>{trip.title}</strong>
          <span className="player-chapter">
            Stop {activeStop + 1} of {route.length} · {route[activeStop].name}
          </span>
        </div>

        <button className="player-exit" onClick={onExit}>
          Back to the journal
        </button>

        <div className="voice-chip" key={beat.speaker}>
          <span className="voice-avatar">{beat.speaker[0]}</span>
          <span className="voice-meta">
            <strong>{beat.speaker}</strong>
            <span>voice note</span>
          </span>
          <span className={`waveform${playing ? ' is-playing' : ''}`} aria-hidden="true">
            {BARS.map((h, i) => (
              <span key={i} style={{ '--h': h, animationDelay: `${(i % 5) * -0.13}s` }} />
            ))}
          </span>
          <em className="voice-quote">“{beat.voice}”</em>
        </div>

        <p className="subtitle" key={index}>
          {beat.line}
        </p>
      </div>

      <div className="player-controls">
        <button className="player-toggle" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} color="fire-yellow" />}
        </button>
        <span className="player-time">{fmt(progress * STORY_SECONDS)}</span>
        <div className="progress" onClick={seek} role="slider" aria-label="Story progress" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
          {route.map((s, i) => (
            <span key={s.id} className="progress-tick" style={{ left: `${(i / route.length) * 100}%` }} />
          ))}
        </div>
        <span className="player-time">{trip.storyLength}</span>
      </div>
    </div>
  );
}

import { FlameLogo, PauseIcon, PlayIcon } from '../ui/icons.jsx';
import StoryIntroGlobe from './StoryIntroGlobe.jsx';

const BARS = [0.4, 0.8, 0.55, 1, 0.7, 0.35, 0.9, 0.6, 0.45, 0.85, 0.5, 0.75, 0.3, 0.65];
const NARRATORS = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
];

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M11.5 3.5 L6 9 L11.5 14.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CompassMark() {
  return (
    <svg className="m-compass" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12" fill="var(--cream)" stroke="var(--bark-dark)" strokeWidth="1.6" />
      <path d="M14 4 L16.2 14 L14 24 L11.8 14 Z" fill="var(--wood-light)" stroke="var(--bark-dark)" strokeWidth="1" />
      <path d="M14 4 L16.2 14 L11.8 14 Z" fill="var(--fire-red)" stroke="var(--bark-dark)" strokeWidth="1" />
    </svg>
  );
}

function VoiceChip({ speaker, isVoice, segment, playing }) {
  return (
    <div className="voice-chip" key={`chip-${speaker}`}>
      <span className={`voice-avatar${isVoice ? '' : ' is-narrator'}`}>{isVoice ? speaker[0] : <FlameLogo size={20} />}</span>
      <span className="voice-meta">
        <strong>{speaker}</strong>
        <span>{isVoice ? 'voice note' : segment.kind === 'photo' ? 'photo' : 'narrator'}</span>
      </span>
      <span className={`waveform${playing ? ' is-playing' : ''}`} aria-hidden="true">
        {BARS.map((h, i) => (
          <span key={i} style={{ '--h': h, animationDelay: `${(i % 5) * -0.13}s` }} />
        ))}
      </span>
    </div>
  );
}

export default function MobilePlayer({
  trip,
  stops,
  intro,
  place,
  onExit,
  endIntro,
  mapRef,
  MapView,
  position,
  activeStop,
  segment,
  index,
  playing,
  speaker,
  isVoice,
  short,
  usesAudio,
  src,
  narrator,
  audioRef,
  setDurations,
  pendingSeek,
  setProgress,
  advance,
  setAudioFailed,
  failKey,
  togglePlay,
  seek,
  elapsed,
  total,
  lengths,
  segments,
  canChooseVoice,
  chooseNarrator,
  formatClock,
  stopIndexAt,
}) {
  const stopName = activeStop >= 0 ? stops[activeStop].name : '';
  const map = (
    <div className="m-map">
      <div className="map-layer" ref={mapRef}>
        <MapView stops={stops} seedKey={trip.id} position={position} activeIndex={activeStop} frame />
      </div>
      {!intro && <CompassMark />}
    </div>
  );

  return (
    <div className={`m-player${intro ? ' is-intro' : ''}${short ? ' is-short' : ''}`}>
      <header className="m-head">
        <div className="m-brand">
          <FlameLogo size={24} />
          <h1>{trip.name}</h1>
        </div>
        <button type="button" className="m-back" onClick={onExit} aria-label="Back to the journal">
          <BackIcon />
        </button>
      </header>

      {intro ? (
        <div className="m-intro">
          <div className="player-heading">
            <span className="eyebrow">Now telling</span>
            <strong>{trip.name}</strong>
          </div>
          <div className="m-intro-stage">
            {place && <StoryIntroGlobe location={place} mapRef={mapRef} onComplete={endIntro} />}
            {map}
          </div>
        </div>
      ) : (
        <>
          <div className="m-stop">
            <span className="eyebrow">
              {activeStop >= 0 ? `Stop ${activeStop + 1} of ${stops.length} · ${stopName}` : trip.name}
            </span>
            {stops.length > 0 && (
              <span className="m-dots" aria-hidden="true">
                {stops.map((stop, i) => (
                  <span key={`${stop.name}-${i}`} className={i === activeStop ? 'is-on' : ''} />
                ))}
              </span>
            )}
          </div>
          <div className="m-body">
            {map}
            <div className="m-side">
              <VoiceChip speaker={speaker} isVoice={isVoice} segment={segment} playing={playing} />
              {segment.kind === 'photo' && (
                <figure className="m-photo">
                  {segment.photo_url ? (
                    <img src={segment.photo_url} alt={segment.location?.name || 'Trip photo'} />
                  ) : (
                    <div className="polaroid-photo">
                      <span className="polaroid-placeholder">Photo</span>
                      <span className="polaroid-label">{segment.location?.name}</span>
                    </div>
                  )}
                </figure>
              )}
              <p className="m-narration" key={index}>
                {isVoice ? `“${segment.text}”` : segment.text}
              </p>
            </div>
          </div>
          <div className="m-controls">
            <div className="m-controls-row">
              <button type="button" className="player-toggle" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} color="fire-yellow" />}
              </button>
              <span className="player-time">{formatClock(elapsed)}</span>
              <div
                className="progress"
                onClick={seek}
                role="slider"
                aria-label="Story progress"
                aria-valuenow={Math.round((elapsed / total) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="progress-fill" style={{ width: `${(elapsed / total) * 100}%` }} />
                {segments.map((s, i) => {
                  const start = lengths.slice(0, i).reduce((a, b) => a + b, 0);
                  const newStop = i === 0 || stopIndexAt(segments, stops, i) !== stopIndexAt(segments, stops, i - 1);
                  return newStop ? <span key={i} className="progress-tick" style={{ left: `${(start / total) * 100}%` }} /> : null;
                })}
              </div>
              <span className="player-time">{formatClock(total)}</span>
            </div>
            {canChooseVoice && (
              <div className="narrator-toggle" role="group" aria-label="Narrator voice">
                {NARRATORS.map((voice) => (
                  <button
                    key={voice.id}
                    type="button"
                    className={narrator === voice.id ? 'is-on' : ''}
                    aria-pressed={narrator === voice.id}
                    onClick={() => chooseNarrator(voice.id)}
                  >
                    {voice.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {usesAudio && (
        <audio
          ref={audioRef}
          key={`audio-${index}-${narrator}`}
          src={src}
          onLoadedMetadata={(e) => {
            const audio = e.currentTarget;
            setDurations((d) => ({ ...d, [index]: audio.duration * 1000 }));
            if (pendingSeek.current != null) {
              audio.currentTime = pendingSeek.current * audio.duration;
              pendingSeek.current = null;
            }
          }}
          onTimeUpdate={(e) => {
            const audio = e.currentTarget;
            if (audio.duration) setProgress(audio.currentTime / audio.duration);
          }}
          onEnded={advance}
          onError={() => setAudioFailed((f) => ({ ...f, [failKey]: true }))}
        />
      )}
    </div>
  );
}

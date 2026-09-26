import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TripMap from './TripMap.jsx';
import StoryIntroGlobe from './StoryIntroGlobe.jsx';
import MobilePlayer from './MobilePlayer.jsx';
import { FlameLogo, PauseIcon, PlayIcon } from '../ui/icons.jsx';
import useIsMobile from '../ui/useIsMobile.js';
import { estimateMs, formatClock, stopIndexAt, storyStops } from '../data/trip.js';

const BARS = [0.4, 0.8, 0.55, 1, 0.7, 0.35, 0.9, 0.6, 0.45, 0.85, 0.5, 0.75, 0.3, 0.65];
const NARRATORS = [
  { id: 'woman', label: 'Woman' },
  { id: 'man', label: 'Man' },
];

function savedNarrator() {
  try {
    return localStorage.getItem('campfire-narrator') === 'man' ? 'man' : 'woman';
  } catch {
    return 'woman';
  }
}

function narrationSrc(segment, narrator) {
  if (segment.kind !== 'narration') return segment.audio_url;
  return segment.voices?.[narrator] || segment.audio_url;
}

const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);

function PlayerMessage({ title, children, onExit }) {
  return (
    <div className="player-message">
      <FlameLogo size={48} />
      <h2 className="suggestion-title">{title}</h2>
      {children && <p>{children}</p>}
      <button className="player-exit static" onClick={onExit}>
        Back to camp
      </button>
    </div>
  );
}

export default function StoryPlayerWindow({ data, onExit, MapView = TripMap }) {
  if (data.status === 'loading') return <PlayerMessage title="Gathering everyone around the fire…" onExit={onExit} />;
  if (data.status === 'missing') return <PlayerMessage title="We couldn't find that trip." onExit={onExit}>The link may be old, or the trip was removed.</PlayerMessage>;
  if (data.status === 'empty') return <PlayerMessage title="No trips yet." onExit={onExit}>Add Campfire to a WhatsApp group and send /campfire start.</PlayerMessage>;
  if (!data.segments?.length) return <PlayerMessage title="This story isn't ready yet." onExit={onExit}>Campfire tells it once the trip's recaps are written.</PlayerMessage>;
  return <StoryPlayer key={data.trip.id} data={data} onExit={onExit} MapView={MapView} />;
}

function StoryPlayer({ data, onExit, MapView }) {
  const { trip, segments, locations } = data;
  const stops = useMemo(() => storyStops(locations, segments), [locations, segments]);
  const place = useMemo(() => {
    if (trip.location) return trip.location;
    return stops[0] ? { name: stops[0].name, lat: stops[0].latitude, lng: stops[0].longitude } : null;
  }, [trip.location, stops]);

  const [intro, setIntro] = useState(Boolean(place));
  const [index, setIndex] = useState(0);
  const [segProgress, setSegProgress] = useState(0);
  const [playing, setPlaying] = useState(!place);
  const [durations, setDurations] = useState({});
  const [audioFailed, setAudioFailed] = useState({});
  const [narrator, setNarrator] = useState(savedNarrator);
  const progressRef = useRef(0);
  const audioRef = useRef(null);
  const pendingSeek = useRef(null);
  const mapRef = useRef(null);

  const endIntro = useCallback(() => {
    setIntro(false);
    setPlaying(true);
  }, []);

  const segment = segments[index];
  const src = narrationSrc(segment, narrator);
  const failKey = `${index}:${narrator}`;
  const usesAudio = Boolean(src) && !audioFailed[failKey];
  const canChooseVoice = segments.some((item) => item.kind === 'narration' && item.voices?.woman && item.voices?.man);
  const lengths = segments.map((s, i) => durations[i] ?? estimateMs(s));
  const total = lengths.reduce((a, b) => a + b, 0);
  const elapsed = lengths.slice(0, index).reduce((a, b) => a + b, 0) + segProgress * lengths[index];
  const atEnd = index === segments.length - 1 && segProgress >= 1;

  const setProgress = (p) => {
    progressRef.current = p;
    setSegProgress(p);
  };

  const advance = () => {
    if (index >= segments.length - 1) {
      setProgress(1);
      setPlaying(false);
    } else {
      setIndex(index + 1);
      setProgress(0);
    }
  };

  useEffect(() => {
    if (!playing || usesAudio) return undefined;
    let raf;
    let last = performance.now();
    const ms = lengths[index];
    const tick = (now) => {
      const p = progressRef.current + (now - last) / ms;
      last = now;
      if (p >= 1) {
        advance();
        return;
      }
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Deliberately restarts only on segment or play-state changes, not on every progress render.
  }, [playing, index, usesAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.play().catch((err) => {
        if (err.name === 'NotAllowedError') setPlaying(false);
        else setAudioFailed((f) => ({ ...f, [failKey]: true }));
      });
    } else {
      audio.pause();
    }
  }, [playing, index, usesAudio, narrator, failKey]);

  const chooseNarrator = (voice) => {
    if (voice === narrator) return;
    pendingSeek.current = progressRef.current;
    setNarrator(voice);
    try {
      localStorage.setItem('campfire-narrator', voice);
    } catch {
      // Playback still switches for this session if storage is blocked.
    }
  };

  const togglePlay = () => {
    if (atEnd) {
      setIndex(0);
      setProgress(0);
    }
    setPlaying((p) => !p);
  };

  const seek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const target = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)) * total;
    let acc = 0;
    for (let i = 0; i < segments.length; i++) {
      if (target < acc + lengths[i] || i === segments.length - 1) {
        const frac = Math.min(0.999, Math.max(0, (target - acc) / lengths[i]));
        setIndex(i);
        setProgress(frac);
        if (i === index && audioRef.current?.duration) audioRef.current.currentTime = frac * audioRef.current.duration;
        else pendingSeek.current = frac;
        return;
      }
      acc += lengths[i];
    }
  };

  const activeStop = stopIndexAt(segments, stops, index);
  const prevStop = index > 0 ? stopIndexAt(segments, stops, index - 1) : activeStop;
  const position = prevStop + (activeStop - prevStop) * ease(Math.min(1, segProgress * 1.6));

  const meanLng = stops.reduce((a, s) => a + s.longitude, 0) / (stops.length || 1);
  const photoOnLeft = activeStop >= 0 && stops[activeStop].longitude > meanLng;

  const isVoice = segment.kind === 'voice_note';
  const speaker = isVoice ? segment.speaker || 'Voice note' : 'Campfire';
  const { mobile, short } = useIsMobile();

  if (mobile) {
    return (
      <MobilePlayer
        trip={trip}
        stops={stops}
        intro={intro}
        place={place}
        onExit={onExit}
        endIntro={endIntro}
        mapRef={mapRef}
        MapView={MapView}
        position={Math.max(0, position)}
        activeStop={activeStop}
        segment={segment}
        index={index}
        playing={playing}
        speaker={speaker}
        isVoice={isVoice}
        short={short}
        usesAudio={usesAudio}
        src={src}
        narrator={narrator}
        audioRef={audioRef}
        setDurations={setDurations}
        pendingSeek={pendingSeek}
        setProgress={setProgress}
        advance={advance}
        setAudioFailed={setAudioFailed}
        failKey={failKey}
        togglePlay={togglePlay}
        seek={seek}
        elapsed={elapsed}
        total={total}
        lengths={lengths}
        segments={segments}
        canChooseVoice={canChooseVoice}
        chooseNarrator={chooseNarrator}
        formatClock={formatClock}
        stopIndexAt={stopIndexAt}
      />
    );
  }

  return (
    <div className="player">
      <div className="player-stage">
        {intro && <StoryIntroGlobe location={place} mapRef={mapRef} onComplete={endIntro} />}

        <div className="map-layer" ref={mapRef}>
          <MapView stops={stops} seedKey={trip.id} position={Math.max(0, position)} activeIndex={activeStop} />
        </div>

        <div className="player-heading">
          <span className="eyebrow">Now telling</span>
          <strong>{trip.name}</strong>
          {!intro && activeStop >= 0 && (
            <span className="player-chapter">
              Stop {activeStop + 1} of {stops.length} · {stops[activeStop].name}
            </span>
          )}
        </div>

        <button className="player-exit" onClick={onExit}>
          Back to the journal
        </button>

        {!intro && segment.kind === 'photo' && (
          <figure className={`photo-pop${photoOnLeft ? ' on-left' : ''}`} key={`photo-${index}`}>
            {segment.photo_url ? (
              <img src={segment.photo_url} alt={segment.location?.name || 'Trip photo'} />
            ) : (
              <div className="polaroid-photo">
                <span className="polaroid-placeholder">Photo</span>
                <span className="polaroid-label">{segment.location?.name}</span>
              </div>
            )}
            {segment.speaker && <figcaption>by {segment.speaker}</figcaption>}
          </figure>
        )}

        {!intro && (
          <>
            <div className="voice-chip" key={`chip-${speaker}`}>
              <span className={`voice-avatar${isVoice ? '' : ' is-narrator'}`}>{isVoice ? speaker[0] : <FlameLogo size={22} />}</span>
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

            <p className="subtitle" key={index}>
              {isVoice ? `“${segment.text}”` : segment.text}
            </p>
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

      <div className={`player-controls${intro ? ' is-waiting' : ''}`} inert={intro || undefined}>
        <button className="player-toggle" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} color="fire-yellow" />}
        </button>
        <span className="player-time">{formatClock(elapsed)}</span>
        <div className="progress" onClick={seek} role="slider" aria-label="Story progress" aria-valuenow={Math.round((elapsed / total) * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${(elapsed / total) * 100}%` }} />
          {segments.map((s, i) => {
            const start = lengths.slice(0, i).reduce((a, b) => a + b, 0);
            const newStop = i === 0 || stopIndexAt(segments, stops, i) !== stopIndexAt(segments, stops, i - 1);
            return newStop ? <span key={i} className="progress-tick" style={{ left: `${(start / total) * 100}%` }} /> : null;
          })}
        </div>
        <span className="player-time">{formatClock(total)}</span>
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
    </div>
  );
}

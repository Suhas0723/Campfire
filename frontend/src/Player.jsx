import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPlayback } from "./api.js";
import MapStage from "./MapStage.jsx";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

function locationAt(segments, index) {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (segments[cursor]?.location) return segments[cursor].location;
  }
  return null;
}

export default function Player() {
  const { tripId } = useParams();
  const [playback, setPlayback] = useState(null);
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlayback(null);
    setError("");
    setIndex(0);
    setPlaying(false);
    getPlayback(tripId)
      .then(setPlayback)
      .catch((err) => setError(err.message || "Could not load this story"));
  }, [tripId]);

  const segments = playback?.segments || [];
  const segment = segments[index];
  const location = useMemo(() => locationAt(segments, index), [segments, index]);

  useEffect(() => {
    if (!playing || !segment || segment.audio_url) return undefined;
    const timer = setTimeout(() => {
      setIndex((current) => {
        if (current >= segments.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 6500);
    return () => clearTimeout(timer);
  }, [playing, segment, segments.length]);

  function toggle() {
    if (!segments.length) return;
    if (index >= segments.length - 1 && !playing) setIndex(0);
    setPlaying((value) => !value);
  }

  function onAudioEnded() {
    setIndex((current) => {
      if (current >= segments.length - 1) {
        setPlaying(false);
        return current;
      }
      return current + 1;
    });
  }

  return (
    <main className="player-page">
      <header className="player-bar">
        <Link to="/" className="back">
          Campfire
        </Link>
        <div>
          <h1>{playback?.trip?.name || "Around the Campfire"}</h1>
          {playback?.trip?.group_name && <p>{playback.trip.group_name}</p>}
        </div>
      </header>

      {error && <p className="banner">{error}</p>}

      <div className="stage">
        <div className="map-pane">
          {apiKey ? (
            <MapStage apiKey={apiKey} location={location} />
          ) : (
            <div className="map-fallback">
              <p>{location?.name || "The map follows the story"}</p>
              <p className="hint">Set GOOGLE_MAPS_API_KEY to move between these stops.</p>
            </div>
          )}
          {location && <p className="place">{location.name}</p>}
        </div>

        <section className="story-pane">
          {!playback && !error && <p className="hint">Loading the story…</p>}
          {playback && segments.length === 0 && (
            <p className="hint">This trip doesn't have a narration yet.</p>
          )}
          {segment && (
            <article className={`beat beat-${segment.kind}`} key={`${segment.order}-${index}`}>
              <p className="kind">
                {segment.kind === "voice_note" ? segment.speaker || "Voice note" : segment.kind}
              </p>
              <p className="line">{segment.text}</p>
              {segment.photo_url && (
                <img src={segment.photo_url} alt={segment.location?.name || "Trip photo"} />
              )}
              {playing && segment.audio_url && (
                <audio src={segment.audio_url} autoPlay onEnded={onAudioEnded} />
              )}
            </article>
          )}

          <div className="controls">
            <button type="button" onClick={toggle} disabled={!segments.length}>
              {playing ? "Pause" : "Play"}
            </button>
            <ol>
              {segments.map((item, itemIndex) => (
                <li key={item.order ?? itemIndex}>
                  <button
                    type="button"
                    className={itemIndex === index ? "current" : ""}
                    onClick={() => {
                      setIndex(itemIndex);
                      setPlaying(false);
                    }}
                  >
                    {item.location?.name || item.kind}
                  </button>
                </li>
              ))}
            </ol>
          </div>

          {playback?.suggestions?.length > 0 && index >= segments.length - 1 && segments.length > 0 && (
            <aside className="next">
              <h2>Next time</h2>
              {playback.suggestions.map((suggestion) => (
                <p key={suggestion.body}>
                  <strong>{suggestion.body}</strong>
                  {suggestion.rationale}
                </p>
              ))}
            </aside>
          )}
        </section>
      </div>
    </main>
  );
}

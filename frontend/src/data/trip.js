import sample from '../mock/trip.json';

export const SAMPLE = { source: 'sample', trip: sample.trip, locations: sample.locations, segments: sample.segments, suggestions: sample.suggestions };

const DAY = 24 * 60 * 60 * 1000;

export function formatDateRange(startIso, endIso) {
  if (!startIso) return '';
  const start = new Date(startIso);
  const month = (d) => d.toLocaleDateString(undefined, { month: 'short' });
  if (!endIso) return `Since ${month(start)} ${start.getDate()}, ${start.getFullYear()}`;
  const end = new Date(endIso);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${month(start)} ${start.getDate()}, ${start.getFullYear()} – ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
  }
  const endPart = start.getMonth() === end.getMonth() ? `${end.getDate()}` : `${month(end)} ${end.getDate()}`;
  return `${month(start)} ${start.getDate()} – ${endPart}, ${end.getFullYear()}`;
}

export function countNights(startIso, endIso) {
  if (!startIso || !endIso) return null;
  return Math.max(0, Math.round((new Date(endIso) - new Date(startIso)) / DAY));
}

// Segments without audio are shown for roughly the time it takes to read them.
export function estimateMs(segment) {
  const words = (segment.text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.min(9000, Math.max(4000, words * 380));
}

export function formatClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatMinutes(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  return `${minutes} min`;
}

// Map stops in story order: the trip's locations, or the places the segments mention.
export function storyStops(locations, segments) {
  const stops = (locations || []).map((l) => ({ name: l.name, latitude: l.latitude, longitude: l.longitude }));
  if (stops.length) return stops;
  const seen = new Set();
  for (const s of segments || []) {
    if (s.location && !seen.has(s.location.name)) {
      seen.add(s.location.name);
      stops.push({ name: s.location.name, latitude: s.location.lat, longitude: s.location.lng });
    }
  }
  return stops;
}

// Index of the stop a segment happens at, carrying the last known place forward.
export function stopIndexAt(segments, stops, index) {
  for (let i = index; i >= 0; i--) {
    const loc = segments[i]?.location;
    if (loc) {
      const found = stops.findIndex((s) => s.name === loc.name);
      if (found !== -1) return found;
    }
  }
  return stops.length ? 0 : -1;
}

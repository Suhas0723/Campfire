import { useEffect, useRef, useState } from 'react';
import { getPlayback, getTrips } from '../api.js';
import { SAMPLE } from './trip.js';

// Loads one trip's playback. Without a tripId it picks the most recent trip.
// If the backend can't be reached, it falls back to the bundled sample trip
// (marked source: 'sample') so the UI still works without Docker running.
export function useTrip(tripId) {
  const [state, setState] = useState({ status: 'loading' });
  const loaded = useRef(null);

  useEffect(() => {
    const current = loaded.current;
    if (current && (!tripId || current.trip.id === tripId)) {
      setState(current);
      return undefined;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    (async () => {
      let next;
      try {
        let id = tripId;
        if (!id) {
          const trips = await getTrips();
          if (!trips.length) {
            next = { status: 'empty' };
          } else {
            id = trips[0].id;
          }
        }
        if (id) next = { status: 'ready', source: 'api', ...(await getPlayback(id)) };
      } catch (err) {
        next = err.status === 404 ? { status: 'missing' } : { status: 'ready', ...SAMPLE };
      }
      if (cancelled) return;
      if (next.status === 'ready') loaded.current = next;
      setState(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return state;
}

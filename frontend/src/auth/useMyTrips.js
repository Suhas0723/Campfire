import { useEffect, useState } from 'react';
import { getTripPlayback, listMyTrips } from './authApi.js';
import { useAuth } from './AuthProvider.jsx';

export function useMyTrips() {
  const { expire } = useAuth();
  const [state, setState] = useState({ status: 'loading', trips: [] });

  useEffect(() => {
    let cancelled = false;
    listMyTrips()
      .then((trips) => !cancelled && setState({ status: 'ready', trips }))
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) expire();
        setState({ status: 'error', trips: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [expire]);

  return state;
}

// Map scenery is seeded from trip.id, so the demo trips keep the seeds they were drawn with.
const withSceneKey = (data) =>
  data.trip?.scene_key ? { ...data, trip: { ...data.trip, record_id: data.trip.id, id: data.trip.scene_key } } : data;

// tripId: undefined while still resolving, null when the user has no such trip.
export function usePlayback(tripId) {
  const { expire } = useAuth();
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    if (tripId === undefined) {
      setState({ status: 'loading' });
      return undefined;
    }
    if (tripId === null) {
      setState({ status: 'missing' });
      return undefined;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    getTripPlayback(tripId)
      .then((data) => !cancelled && setState({ status: 'ready', source: 'api', ...withSceneKey(data) }))
      .catch((err) => {
        if (cancelled) return;
        if (err.status === 401) expire();
        setState({ status: err.status === 404 ? 'missing' : 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, expire]);

  return state;
}

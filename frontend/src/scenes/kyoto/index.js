import kyoto from './trip.json';
import KyotoMap from './KyotoMap.jsx';
import KyotoJournal from './KyotoJournal.jsx';

export const KYOTO_TRIP = {
  id: kyoto.trip.id,
  title: kyoto.trip.name,
  Body: KyotoJournal,
  MapView: KyotoMap,
  data: {
    status: 'ready',
    source: 'mock',
    trip: kyoto.trip,
    locations: kyoto.locations,
    segments: kyoto.segments,
    suggestions: kyoto.suggestions,
  },
};

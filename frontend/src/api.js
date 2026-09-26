export async function getTrips() {
  const response = await fetch("/api/trips");
  if (!response.ok) throw new Error("Could not load trips");
  return response.json();
}

export async function getPlayback(tripId) {
  const response = await fetch(`/api/trips/${tripId}/playback`);
  if (response.status === 404) {
    const error = new Error("This trip doesn't exist");
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new Error("Could not load this story");
  return response.json();
}

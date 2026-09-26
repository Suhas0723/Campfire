async function send(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    const error = new Error('network');
    error.code = 'network';
    throw error;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = response.status;
    error.code = data.code || (response.status >= 500 ? 'server' : 'unknown');
    error.retryAfter = data.retry_after;
    throw error;
  }
  return data;
}

export const requestCode = (phone) => send('/auth/request-code', { method: 'POST', body: { phone } });
export const verifyCode = (phone, code) => send('/auth/verify', { method: 'POST', body: { phone, code } });
export const signOut = () => send('/auth/logout', { method: 'POST', body: {} });
export const getMe = () => send('/me');
export const listMyTrips = () => send('/trips');
export const getTripPlayback = (tripId) => send(`/trips/${tripId}/playback`);

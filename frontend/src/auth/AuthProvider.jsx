import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getMe, signOut as apiSignOut } from './authApi.js';

const AuthContext = createContext(null);

const FLARE_MS = 1400;

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });
  const [flaring, setFlaring] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then(({ user }) => !cancelled && setState({ status: 'signed-in', user }))
      .catch(() => !cancelled && setState({ status: 'signed-out', user: null }));
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((user) => setState({ status: 'signed-in', user }), []);

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } finally {
      setState({ status: 'signed-out', user: null });
    }
  }, []);

  const expire = useCallback(() => setState({ status: 'signed-out', user: null }), []);

  const flare = useCallback(() => {
    setFlaring(true);
    window.setTimeout(() => setFlaring(false), FLARE_MS);
  }, []);

  const value = useMemo(
    () => ({ ...state, flaring, signIn, signOut, expire, flare }),
    [state, flaring, signIn, signOut, expire, flare],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Store tokens in React state (no localStorage in this environment)
  const [auth, setAuth] = useState(null); // { accessToken, refreshToken, user }

  const login = useCallback((data) => setAuth(data), []);

  const logout = useCallback(async () => {
    if (auth?.accessToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth.accessToken}`,
          },
          body: JSON.stringify({ refreshToken: auth.refreshToken }),
        });
      } catch (_) { /* best-effort */ }
    }
    setAuth(null);
  }, [auth]);

  // Wrapped fetch that auto-refreshes the access token when expired
  const apiFetch = useCallback(async (url, options = {}) => {
    const doFetch = (token) =>
      fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers ?? {}),
          Authorization: `Bearer ${token}`,
        },
      });

    let res = await doFetch(auth?.accessToken);

    if (res.status === 401 && auth?.refreshToken) {
      // Try to refresh
      const rRes = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: auth.refreshToken }),
      });
      if (rRes.ok) {
        const data = await rRes.json();
        setAuth(prev => ({ ...prev, accessToken: data.accessToken, refreshToken: data.refreshToken }));
        res = await doFetch(data.accessToken);
      } else {
        setAuth(null); // force re-login
        throw new Error('Session expired. Please log in again.');
      }
    }

    return res;
  }, [auth]);

  return (
    <AuthContext.Provider value={{ auth, login, logout, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

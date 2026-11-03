import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi } from '../api';
import { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export const DASHBOARD_PATH = {
  worker: '/worker/dashboard',
  employer: '/employer/dashboard',
  admin: '/admin',
};

// Holds the logged-in user for the whole app. On first load it checks a
// saved token with GET /api/auth/me so a page refresh keeps you logged in.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    authApi
      .me()
      .then((res) => setUser(res.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  // The axios interceptor fires this when the server rejects our token.
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener('simsar:logout', onLogout);
    return () => window.removeEventListener('simsar:logout', onLogout);
  }, []);

  const saveSession = ({ token, user: u }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
    return u;
  };

  const login = useCallback(async (role, email, password) => saveSession(await authApi.login({ role, email, password })), []);
  const register = useCallback(async (body) => saveSession(await authApi.register(body)), []);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

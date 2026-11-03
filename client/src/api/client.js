import axios from 'axios';

export const TOKEN_KEY = 'simsar_token';

// One axios instance for the whole app. The Vite dev server proxies /api to
// the Express server (see vite.config.js).
const api = axios.create({ baseURL: '/api' });

// Attach the JWT to every request if we have one.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server says our token is no longer valid, drop it and tell the app.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem(TOKEN_KEY)) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event('simsar:logout'));
    }
    return Promise.reject(err);
  }
);

// Turns any axios error into a readable message (and per-field messages).
export function errorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

export function fieldErrors(err) {
  return err?.response?.data?.fields || {};
}

export default api;

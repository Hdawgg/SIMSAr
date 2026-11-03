import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, requests to /api are forwarded to the Express server,
// so the browser sees one origin and no CORS setup is needed for dev.
//
// `npm run dev:demo` starts three copies with --mode demo-employer /
// demo-worker / demo-admin (ports 5173-5175, see package.json). Each gets its
// own dependency cache folder so the three dev servers don't overwrite each other.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  cacheDir: mode.startsWith('demo-') ? `node_modules/.vite-${mode}` : 'node_modules/.vite',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
}));

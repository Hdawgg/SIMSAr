// Presentation mode for `npm run dev:demo`, which runs three copies of the app
// on ports 5173 (employer), 5174 (worker) and 5175 (admin). Each copy is
// started with `vite --mode demo-<role>`, which loads client/.env.demo-<role>.
//
// Logins never leak between the tabs: the JWT is kept in localStorage, and
// localStorage belongs to one origin (scheme + host + PORT). No cookies are used.
//
// With plain `npm run dev` none of these variables are set and DEMO_ROLE is
// null, so the app behaves normally.
const ROLES = ['employer', 'worker', 'admin'];
const env = import.meta.env;

export const DEMO_ROLE = ROLES.includes(env.VITE_DEMO_ROLE) ? env.VITE_DEMO_ROLE : null;

// Seeded demo account to pre-fill on this tab's login page (see README).
export const DEMO_LOGIN = DEMO_ROLE
  ? { email: env.VITE_DEMO_EMAIL || '', password: env.VITE_DEMO_PASSWORD || '' }
  : null;

export const DEMO_LABEL = DEMO_ROLE ? `${DEMO_ROLE[0].toUpperCase()}${DEMO_ROLE.slice(1)} view` : '';

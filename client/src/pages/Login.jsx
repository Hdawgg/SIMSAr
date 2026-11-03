import { useState } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth, DASHBOARD_PATH } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../api/client';
import { DEMO_LOGIN, DEMO_ROLE } from '../demo';
import { ROLE_INFO } from './authRoles';
import NotFound from './NotFound';

// One component, three login pages: /login/worker, /login/employer, /login/admin.
// The role is sent to the API, which refuses e.g. a worker account on the employer login.
export default function Login() {
  const { role } = useParams();
  const { user, login } = useAuth();
  const toast = useToast();
  const location = useLocation();

  // In `npm run dev:demo` this tab's seeded account is pre-filled (demo only).
  const demo = role === DEMO_ROLE ? DEMO_LOGIN : null;
  const [email, setEmail] = useState(demo?.email || '');
  const [password, setPassword] = useState(demo?.password || '');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const info = ROLE_INFO[role];
  if (!info) return <NotFound />;
  // Once logged in (including right after this form succeeds) go back to the
  // page that asked for login, or to the user's own dashboard.
  if (user) return <Navigate to={location.state?.from || DASHBOARD_PATH[user.role]} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email.';
    if (!password) errs.password = 'Enter your password.';
    setErrors(errs);
    setServerError('');
    if (Object.keys(errs).length) return;

    setSubmitting(true);
    try {
      const u = await login(role, email.trim(), password);
      toast.success(`Welcome back, ${u.name.split(' ')[0]}!`);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container py-5">
      <div className="mx-auto card-panel p-4 p-md-5" style={{ maxWidth: 440 }}>
        <i className={`bi ${info.icon} fs-2`} style={{ color: role === 'admin' ? 'var(--brick)' : 'var(--indigo)' }} />
        <h1 className="h2 fw-bold font-display mt-1">{info.title}</h1>
        <p className="text-slate small">{info.blurb}</p>
        {location.state?.from && <div className="alert alert-warning small py-2">Please log in to continue.</div>}
        {demo?.email && <div className="alert alert-info small py-2">Demo mode: the seeded {role} account is filled in.</div>}
        {serverError && <div className="alert alert-danger small py-2" role="alert">{serverError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-3">
            <label htmlFor="loginEmail" className="form-label fw-semibold">Email</label>
            <input
              id="loginEmail"
              type="email"
              autoComplete="email"
              className={`form-control ${errors.email ? 'is-invalid' : ''}`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {errors.email && <div className="small text-brick mt-1">{errors.email}</div>}
          </div>
          <div className="mb-3">
            <label htmlFor="loginPassword" className="form-label fw-semibold">Password</label>
            <div className="input-group">
              <input
                id="loginPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="btn btn-outline-dark" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} />
              </button>
            </div>
            {errors.password && <div className="small text-brick mt-1">{errors.password}</div>}
          </div>
          <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
            {submitting && <span className="spinner-border spinner-border-sm me-1" />}Log in
          </button>
        </form>

        {info.canRegister ? (
          <p className="small text-center mt-4 mb-0">New to SIMSAR? <Link to={`/register/${role}`}>Create a {role} account</Link></p>
        ) : (
          <p className="small text-center text-slate mt-4 mb-0">Admin accounts are created by the SIMSAR team, not by sign-up.</p>
        )}
        <p className="small text-center mt-2 mb-0"><Link to="/login">Log in with a different account type</Link></p>
      </div>
    </div>
  );
}

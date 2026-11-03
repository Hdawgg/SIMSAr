import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DEMO_LABEL, DEMO_ROLE } from '../demo';

// Links change with the role of whoever is logged in.
const LINKS = {
  guest: [
    { to: '/', label: 'Home', end: true },
    { to: '/jobs', label: 'Find jobs' },
    { to: '/workers', label: 'Find workers' },
    { to: '/#how-it-works', label: 'How it works', hash: true },
  ],
  worker: [
    { to: '/worker/dashboard', label: 'Dashboard' },
    { to: '/jobs', label: 'Find jobs' },
    { to: '/worker/verification', label: 'Verification' },
    { to: '/worker/profile', label: 'My profile' },
  ],
  employer: [
    { to: '/employer/dashboard', label: 'Dashboard' },
    { to: '/employer/jobs/new', label: 'Post a job' },
    { to: '/workers', label: 'Find workers' },
    { to: '/employer/profile', label: 'My profile' },
  ],
  admin: [{ to: '/admin', label: 'Admin dashboard' }],
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu whenever the page changes.
  useEffect(() => setOpen(false), [location.pathname]);

  const links = LINKS[user?.role || 'guest'];

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <nav className="navbar navbar-expand-lg bg-white sticky-top border-bottom border-line">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2 fw-bold font-display" to="/">
          <span className="navbar-brand-mark">S</span> simsar
        </Link>
        {/* Only in `npm run dev:demo`: says which role this browser tab is for. */}
        {DEMO_ROLE && (
          <span className={`demo-label demo-${DEMO_ROLE} me-auto me-lg-3`} title={`Presentation mode: this tab (port ${window.location.port}) is for the ${DEMO_ROLE}`}>
            Demo: {DEMO_LABEL}
          </span>
        )}
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="navMain"
          aria-expanded={open}
          aria-label="Toggle navigation"
          onClick={() => setOpen(!open)}
        >
          <span className="navbar-toggler-icon" />
        </button>
        <div className={`collapse navbar-collapse ${open ? 'show' : ''}`} id="navMain">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-lg-1">
            {links.map((l) => (
              <li className="nav-item" key={l.to}>
                {l.hash ? (
                  <Link className="nav-link" to={l.to}>{l.label}</Link>
                ) : (
                  <NavLink className="nav-link" to={l.to} end={l.end}>{l.label}</NavLink>
                )}
              </li>
            ))}
          </ul>
          <div className="d-flex flex-column flex-lg-row gap-2 align-items-stretch align-items-lg-center">
            {user ? (
              <>
                <span className="small text-slate">
                  <i className="bi bi-person-circle" /> {user.name}{' '}
                  <span className="badge rounded-pill bg-ink text-capitalize">{user.role}</span>
                </span>
                <button type="button" className="btn btn-outline-dark btn-sm" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right" /> Log out
                </button>
              </>
            ) : (
              <>
                <Link to={DEMO_ROLE ? `/login/${DEMO_ROLE}` : '/login'} className="btn btn-outline-dark">Log in</Link>
                <Link to="/register" className="btn btn-primary">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

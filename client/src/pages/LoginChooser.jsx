import { Link } from 'react-router-dom';
import { DEMO_ROLE } from '../demo';
import { ROLE_INFO } from './authRoles';

export default function LoginChooser() {
  return (
    <div className="container py-5">
      <h1 className="display-6 fw-bold font-display text-center">Log in to SIMSAR</h1>
      <p className="text-slate text-center">Each account type has its own login.</p>
      <div className="row g-4 mt-2 justify-content-center">
        {Object.entries(ROLE_INFO).map(([role, info]) => (
          <div className="col-md-4" key={role}>
            <Link
              to={`/login/${role}`}
              className={`card-panel p-4 d-block h-100 text-reset text-decoration-none job-card ${role === DEMO_ROLE ? 'demo-highlight' : ''}`}
            >
              <i className={`bi ${info.icon} fs-2`} style={{ color: role === 'admin' ? 'var(--brick)' : 'var(--indigo)' }} />
              <h2 className="h4 fw-bold font-display mt-2">{info.title}</h2>
              <p className="text-slate small mb-0">{info.blurb}</p>
              {role === DEMO_ROLE && <p className="small fw-semibold mt-2 mb-0" style={{ color: 'var(--indigo)' }}><i className="bi bi-star-fill" /> This demo tab</p>}
            </Link>
          </div>
        ))}
      </div>
      <p className="text-center small mt-4">New here? <Link to="/register">Create an account</Link></p>
    </div>
  );
}

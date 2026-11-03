import { Link } from 'react-router-dom';

export default function RegisterChooser() {
  return (
    <div className="container py-5">
      <h1 className="display-6 fw-bold font-display text-center">Create an account</h1>
      <p className="text-slate text-center">What brings you to SIMSAR?</p>
      <div className="row g-4 mt-2 justify-content-center">
        <div className="col-md-5 col-lg-4">
          <Link to="/register/employer" className="card-panel p-4 d-block h-100 text-reset text-decoration-none job-card">
            <i className="bi bi-house-door fs-2" style={{ color: 'var(--indigo)' }} />
            <h2 className="h4 fw-bold font-display mt-2">I want to hire</h2>
            <p className="text-slate small mb-0">Post jobs and book background-checked tradespeople. Households and businesses welcome.</p>
          </Link>
        </div>
        <div className="col-md-5 col-lg-4">
          <Link to="/register/worker" className="card-panel p-4 d-block h-100 text-reset text-decoration-none job-card">
            <i className="bi bi-tools fs-2" style={{ color: 'var(--indigo)' }} />
            <h2 className="h4 fw-bold font-display mt-2">I want to work</h2>
            <p className="text-slate small mb-0">Set your own rate (never below the fair minimum), get verified and apply for jobs nearby.</p>
          </Link>
        </div>
      </div>
      <p className="text-center small mt-4">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}

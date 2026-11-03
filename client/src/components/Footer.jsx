import { Link } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';

export default function Footer() {
  const { platformFeePercent } = useConfig();
  return (
    <footer className="bg-white border-top border-line">
      <div className="container py-5">
        <div className="row g-4">
          <div className="col-md-4">
            <Link to="/" className="d-flex align-items-center gap-2 fw-bold font-display text-reset text-decoration-none mb-2">
              <span className="navbar-brand-mark">S</span> simsar
            </Link>
            <p className="text-slate small mb-0">
              The fair broker. One fixed {platformFeePercent}% platform fee shown on every job, and a fair minimum rate for
              every trade. No hidden cuts, no undercutting.
            </p>
          </div>
          <div className="col-6 col-md-2">
            <h2 className="h6">Employers</h2>
            <ul className="list-unstyled small">
              <li className="mb-2"><Link to="/workers">Find workers</Link></li>
              <li className="mb-2"><Link to="/register/employer">Hire on SIMSAR</Link></li>
              <li className="mb-2"><Link to="/login/employer">Employer login</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-2">
            <h2 className="h6">Workers</h2>
            <ul className="list-unstyled small">
              <li className="mb-2"><Link to="/jobs">Find jobs</Link></li>
              <li className="mb-2"><Link to="/register/worker">Become a worker</Link></li>
              <li className="mb-2"><Link to="/login/worker">Worker login</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-2">
            <h2 className="h6">SIMSAR</h2>
            <ul className="list-unstyled small">
              <li className="mb-2"><Link to="/#how-it-works">How it works</Link></li>
              <li className="mb-2"><Link to="/login/admin">Admin login</Link></li>
            </ul>
          </div>
        </div>
        <hr className="border-line" />
        <p className="small text-slate mb-0">© 2026 SIMSAR. A Full Stack Development mini project, Batch A1. Mapped to SDG 8 and SDG 9.</p>
      </div>
    </footer>
  );
}

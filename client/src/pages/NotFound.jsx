import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center">
      <p className="display-1 fw-bold font-display" style={{ color: 'var(--turmeric)' }}>404</p>
      <h1 className="h3 fw-bold font-display">Page not found</h1>
      <p className="text-slate">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </div>
  );
}

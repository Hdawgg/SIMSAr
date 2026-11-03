import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, DASHBOARD_PATH } from '../context/AuthContext';
import Loading from './Loading';

// Wraps routes that need a logged-in user with one of `roles`.
// - Not logged in  -> that role's login page, then back here afterwards.
// - Wrong role     -> your own dashboard.
// The API checks roles again on every request; this is only for the UI.
export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!user) {
    return <Navigate to={`/login/${roles[0]}`} replace state={{ from: location.pathname }} />;
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={DASHBOARD_PATH[user.role]} replace />;
  }
  return <Outlet />;
}

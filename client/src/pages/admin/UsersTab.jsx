import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { errorMessage } from '../../api/client';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatDate } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import Stars from '../../components/Stars';
import ItiBadge from '../../components/ItiBadge';

export default function UsersTab({ onChange }) {
  const { getTrade } = useConfig();
  const toast = useToast();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminApi.users({ role: role || undefined, q: search || undefined }), [role, search]);
  const [busy, setBusy] = useState(null);

  async function toggle(u) {
    const action = u.isActive ? 'Suspend' : 'Restore';
    if (!window.confirm(`${action} ${u.name}'s account?`)) return;
    setBusy(u._id);
    try {
      await adminApi.setUserActive(u._id, !u.isActive);
      toast.success(`${u.name} ${u.isActive ? 'suspended' : 'restored'}.`);
      reload();
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const users = data?.users || [];

  return (
    <>
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <div className="col-sm-6 col-lg-4">
          <label htmlFor="userSearch" className="visually-hidden">Search users</label>
          <input id="userSearch" className="form-control" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="col-8 col-sm-4 col-lg-2">
          <label htmlFor="userRole" className="visually-hidden">Role</label>
          <select id="userRole" className="form-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            <option value="worker">Workers</option>
            <option value="employer">Employers</option>
            <option value="admin">Admins</option>
          </select>
        </div>
        <div className="col-4 col-sm-2"><button type="submit" className="btn btn-primary w-100">Search</button></div>
      </form>

      <ErrorAlert message={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <div className="card-panel table-responsive">
          <table className="table table-hover mb-0 small">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Rating</th><th>Joined</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan="7" className="text-center text-slate py-4">No users found.</td></tr>}
              {users.map((u) => (
                <tr key={u._id} className={u.isActive ? '' : 'table-light text-slate'}>
                  <td className="fw-semibold">
                    {u.role === 'admin' ? u.name : <Link to={`/profile/${u._id}`}>{u.name}</Link>}
                    {u.role === 'worker' && (
                      <div className="fw-normal">
                        {getTrade(u.trade)?.label} · {u.verified ? <span className="badge-verified"><i className="bi bi-patch-check-fill" /> Verified</span> : <span className="text-slate">Not verified</span>}
                        {u.itiTrades?.length > 0 && <> <ItiBadge trades={u.itiTrades} /></>}
                      </div>
                    )}
                  </td>
                  <td>{u.email}</td>
                  <td className="text-capitalize">{u.role}</td>
                  <td>{u.role === 'admin' ? '—' : <Stars value={u.ratingAvg} count={u.ratingCount} />}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>{u.isActive ? <span className="status-pill status-approved">active</span> : <span className="status-pill status-rejected">suspended</span>}</td>
                  <td className="text-end">
                    {u.role !== 'admin' && (
                      <button type="button" className="btn btn-sm btn-outline-dark" disabled={busy === u._id} onClick={() => toggle(u)}>
                        {u.isActive ? 'Suspend' : 'Restore'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

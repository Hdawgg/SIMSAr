import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { errorMessage } from '../../api/client';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatDate, formatINR } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import StatusPill from '../../components/StatusPill';
import Modal from '../../components/Modal';

const STATUSES = ['open', 'assigned', 'in-progress', 'completed', 'closed'];

// Job moderation: admins can take any job off the board (with a reason) or
// delete it outright. Completed jobs stay, because reviews depend on them.
export default function JobsTab({ onChange }) {
  const { getTrade } = useConfig();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const { data, loading, error, reload } = useAsync(() => adminApi.jobs({ status: status || undefined, q: search || undefined }), [status, search]);
  const [closing, setClosing] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(null);

  async function closeJob(e) {
    e.preventDefault();
    if (reason.trim().length < 3) return setReasonError('Give a reason (at least 3 characters). The employer will see it.');
    setBusy('close');
    try {
      await adminApi.closeJob(closing._id, reason.trim());
      toast.success('Job removed from the board.');
      setClosing(null);
      reload();
      onChange();
    } catch (err) {
      setReasonError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function deleteJob(job) {
    if (!window.confirm(`Permanently delete “${job.title}” and its applications? This cannot be undone.`)) return;
    setBusy(job._id);
    try {
      await adminApi.deleteJob(job._id);
      toast.success('Job deleted.');
      reload();
      onChange();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const jobs = data?.jobs || [];

  return (
    <>
      <form className="row g-2 mb-3" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
        <div className="col-sm-6 col-lg-4">
          <label htmlFor="jobSearch" className="visually-hidden">Search jobs</label>
          <input id="jobSearch" className="form-control" placeholder="Search job title" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="col-8 col-sm-4 col-lg-2">
          <label htmlFor="jobStatus" className="visually-hidden">Status</label>
          <select id="jobStatus" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-4 col-sm-2"><button type="submit" className="btn btn-primary w-100">Search</button></div>
      </form>

      <ErrorAlert message={error} onRetry={reload} />
      {loading ? <Loading /> : (
        <div className="card-panel table-responsive">
          <table className="table table-hover mb-0 small">
            <thead>
              <tr><th>Job</th><th>Employer</th><th>Budget / fee</th><th>Worker</th><th>Posted</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {jobs.length === 0 && <tr><td colSpan="7" className="text-center text-slate py-4">No jobs found.</td></tr>}
              {jobs.map((j) => (
                <tr key={j._id}>
                  <td>
                    <Link to={`/jobs/${j._id}`} className="fw-semibold">{j.title}</Link>
                    <div className="text-slate">{getTrade(j.category)?.label} · {j.location}</div>
                    {j.closedReason && <div className="text-brick">{j.closedReason}</div>}
                  </td>
                  <td>{j.employer?.name}<div className="text-slate">{j.employer?.email}</div></td>
                  <td>{formatINR(j.budget)}<div className="text-slate">{formatINR(j.platformFee)} ({j.feePercent}%)</div></td>
                  <td>{j.assignedWorker?.name || '—'}</td>
                  <td>{formatDate(j.createdAt)}</td>
                  <td><StatusPill status={j.status} /></td>
                  <td className="text-end text-nowrap">
                    {!['completed', 'closed'].includes(j.status) && (
                      <button type="button" className="btn btn-sm btn-outline-dark me-1" onClick={() => { setClosing(j); setReason(''); setReasonError(''); }}>Remove</button>
                    )}
                    {j.status !== 'completed' && (
                      <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy === j._id} aria-label={`Delete ${j.title}`} onClick={() => deleteJob(j)}>
                        <i className="bi bi-trash" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {closing && (
        <Modal title="Remove job from the board" onClose={() => setClosing(null)}>
          <form onSubmit={closeJob} noValidate>
            <p className="small text-slate">“{closing.title}” will be closed. Applicants are declined and any booking is cancelled.</p>
            <label htmlFor="modReason" className="form-label fw-semibold">Reason</label>
            <input id="modReason" className={`form-control ${reasonError ? 'is-invalid' : ''}`} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Asks for work outside the platform" />
            {reasonError && <div className="small text-brick mt-1">{reasonError}</div>}
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-outline-dark" onClick={() => setClosing(null)}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={busy === 'close'}>Remove job</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

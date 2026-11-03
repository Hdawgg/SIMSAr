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
import EmptyState from '../../components/EmptyState';
import StatusPill from '../../components/StatusPill';
import Modal from '../../components/Modal';

const ID_LABELS = { aadhaar: 'Aadhaar', pan: 'PAN', 'voter-id': 'Voter ID', 'driving-licence': 'Driving licence', passport: 'Passport' };

function age(dob) {
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000));
}

// Background-check review queue. Approving sets the worker's Verified badge.
export default function ChecksTab({ onChange }) {
  const { getTrade } = useConfig();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useAsync(() => adminApi.checks(status ? { status } : {}), [status]);
  const [reviewing, setReviewing] = useState(null); // { check, decision }
  const [notes, setNotes] = useState('');
  const [notesError, setNotesError] = useState('');
  const [saving, setSaving] = useState(false);

  function open(check, decision) {
    setReviewing({ check, decision });
    setNotes('');
    setNotesError('');
  }

  async function submit(e) {
    e.preventDefault();
    if (reviewing.decision === 'rejected' && !notes.trim()) {
      return setNotesError('Tell the worker why, so they can fix it and resubmit.');
    }
    setSaving(true);
    try {
      await adminApi.reviewCheck(reviewing.check._id, { status: reviewing.decision, reviewerNotes: notes.trim() });
      toast.success(`${reviewing.check.worker.name} ${reviewing.decision === 'approved' ? 'is now verified' : 'was not approved'}.`);
      setReviewing(null);
      reload();
      onChange();
    } catch (err) {
      setNotesError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const checks = data?.backgroundChecks || [];

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button key={s || 'all'} type="button" className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>
      <ErrorAlert message={error} onRetry={reload} />
      {loading ? <Loading /> : !error && checks.length === 0 ? (
        <EmptyState icon="bi-shield-check" title={status === 'pending' ? 'No checks waiting for review' : 'Nothing here'}>
          {status === 'pending' && 'New worker submissions will appear here.'}
        </EmptyState>
      ) : (
        <div className="d-flex flex-column gap-3">
          {checks.map((c) => (
            <article key={c._id} className="card-panel p-4">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <div>
                  <h3 className="h5 fw-bold mb-0">
                    {c.worker ? <Link to={`/profile/${c.worker._id}`} className="text-reset">{c.worker.name}</Link> : 'Deleted user'}
                  </h3>
                  <p className="small text-slate mb-0">
                    {getTrade(c.workerProfile?.trade)?.label} · {c.workerProfile?.location} · {c.worker?.email} · {c.worker?.phone}
                  </p>
                </div>
                <StatusPill status={c.status} />
              </div>
              <div className="row g-3 small mt-1">
                <div className="col-sm-6 col-lg-3"><div className="text-slate">ID document</div><div className="fw-semibold">{ID_LABELS[c.idType]}: {c.idNumber}</div></div>
                <div className="col-sm-6 col-lg-3">
                  <div className="text-slate">Name on ID</div>
                  <div className="fw-semibold">
                    {c.fullNameOnId}
                    {c.worker && c.fullNameOnId.toLowerCase() !== c.worker.name.toLowerCase() && <span className="text-brick" title="Differs from account name"> <i className="bi bi-exclamation-circle" /></span>}
                  </div>
                </div>
                <div className="col-sm-6 col-lg-2"><div className="text-slate">Date of birth</div><div className="fw-semibold">{formatDate(c.dateOfBirth)} ({age(c.dateOfBirth)})</div></div>
                <div className="col-sm-6 col-lg-4"><div className="text-slate">Address</div><div className="fw-semibold">{c.address.line1}, {c.address.city}, {c.address.state} {c.address.pincode}</div></div>
              </div>
              <p className="small text-slate mt-2 mb-0">
                Submitted {formatDate(c.createdAt)}
                {c.reviewedAt && ` · reviewed ${formatDate(c.reviewedAt)} by ${c.reviewedBy?.name || 'admin'}`}
                {c.reviewerNotes && ` — “${c.reviewerNotes}”`}
              </p>
              {c.status === 'pending' && (
                <div className="d-flex gap-2 mt-3">
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => open(c, 'approved')}><i className="bi bi-check-lg" /> Approve</button>
                  <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => open(c, 'rejected')}><i className="bi bi-x-lg" /> Reject</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {reviewing && (
        <Modal title={`${reviewing.decision === 'approved' ? 'Approve' : 'Reject'} ${reviewing.check.worker?.name}`} onClose={() => setReviewing(null)}>
          <form onSubmit={submit} noValidate>
            <p className="small text-slate">
              {reviewing.decision === 'approved'
                ? 'The worker gets the Verified badge and can start applying for jobs.'
                : 'The worker will see your note and can submit corrected details.'}
            </p>
            <label htmlFor="reviewNotes" className="form-label fw-semibold">
              Reviewer notes {reviewing.decision === 'approved' && <span className="text-slate fw-normal">(optional)</span>}
            </label>
            <textarea id="reviewNotes" className={`form-control ${notesError ? 'is-invalid' : ''}`} rows="3" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder={reviewing.decision === 'approved' ? 'e.g. ID and address match' : 'e.g. Name on ID does not match the account name'} />
            {notesError && <div className="small text-brick mt-1">{notesError}</div>}
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-outline-dark" onClick={() => setReviewing(null)}>Cancel</button>
              <button type="submit" className={`btn ${reviewing.decision === 'approved' ? 'btn-primary' : 'btn-danger'}`} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1" />}{reviewing.decision === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { errorMessage } from '../../api/client';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatBytes, formatDate } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import EmptyState from '../../components/EmptyState';
import StatusPill from '../../components/StatusPill';
import Modal from '../../components/Modal';
import CertificateViewer from '../../components/CertificateViewer';

// ITI certificate review queue. Simulated verification: the admin compares
// the details the worker typed with the uploaded scan. Approving gives the
// worker the "ITI Certified" badge for that trade (separate from Verified).
export default function ItiTab({ onChange }) {
  const { getTrade } = useConfig();
  const toast = useToast();
  const [status, setStatus] = useState('pending');
  const { data, loading, error, reload } = useAsync(() => adminApi.itiCertificates(status ? { status } : {}), [status]);
  const [viewing, setViewing] = useState(null);
  const [reviewing, setReviewing] = useState(null); // { cert, decision }
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [saving, setSaving] = useState(false);

  function open(cert, decision) {
    setReviewing({ cert, decision });
    setNote('');
    setNoteError('');
  }

  async function submit(e) {
    e.preventDefault();
    if (reviewing.decision === 'rejected' && !note.trim()) {
      return setNoteError('Tell the worker what is wrong, so they can fix it and re-submit.');
    }
    setSaving(true);
    try {
      await adminApi.reviewIti(reviewing.cert._id, { status: reviewing.decision, reviewerNote: note.trim() });
      toast.success(`${reviewing.cert.worker?.name}'s ITI certificate ${reviewing.decision === 'approved' ? 'is approved' : 'was not approved'}.`);
      setReviewing(null);
      reload();
      onChange();
    } catch (err) {
      setNoteError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const certs = data?.itiCertificates || [];

  return (
    <>
      <p className="small text-slate">
        Compare each certificate with its scan. This is a manual check by SIMSAR staff; SIMSAR is not connected to the
        NCVT MIS portal or any state council database.
      </p>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button key={s || 'all'} type="button" className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>
            {s ? s[0].toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>
      <ErrorAlert message={error} onRetry={reload} />
      {loading ? <Loading /> : !error && certs.length === 0 ? (
        <EmptyState icon="bi-mortarboard" title={status === 'pending' ? 'No ITI certificates waiting for review' : 'Nothing here'}>
          {status === 'pending' && 'New submissions from workers will appear here.'}
        </EmptyState>
      ) : (
        <div className="d-flex flex-column gap-3">
          {certs.map((c) => {
            const tradeMatches = c.workerProfile?.trade === c.trade;
            return (
              <article key={c._id} className="card-panel p-4">
                <div className="d-flex flex-wrap justify-content-between gap-2">
                  <div>
                    <h3 className="h5 fw-bold mb-0">
                      {c.worker ? <Link to={`/profile/${c.worker._id}`} className="text-reset">{c.worker.name}</Link> : 'Deleted user'}
                    </h3>
                    <p className="small text-slate mb-0">
                      {getTrade(c.workerProfile?.trade)?.label} · {c.workerProfile?.location} · {c.worker?.email}
                      {c.workerProfile && !c.workerProfile.verified && <span className="text-brick"> · background check not approved yet</span>}
                    </p>
                  </div>
                  <StatusPill status={c.status} />
                </div>
                <div className="row g-3 small mt-1">
                  <div className="col-sm-6 col-lg-3">
                    <div className="text-slate">Trade on certificate</div>
                    <div className="fw-semibold">
                      {getTrade(c.trade)?.label || c.trade}
                      {!tradeMatches && <span className="text-brick" title="No longer matches the worker's trade"> <i className="bi bi-exclamation-circle" /></span>}
                    </div>
                  </div>
                  <div className="col-sm-6 col-lg-3"><div className="text-slate">Council · certificate no.</div><div className="fw-semibold">{c.councilType} · {c.certificateNumber}</div></div>
                  <div className="col-sm-6 col-lg-3"><div className="text-slate">Registration no.</div><div className="fw-semibold">{c.registrationNumber || '—'}</div></div>
                  <div className="col-sm-6 col-lg-3">
                    <div className="text-slate">Passed</div>
                    <div className="fw-semibold">{c.passingYear}{c.percentage != null && ` · ${c.percentage}%`}{c.grade && ` · ${c.grade}`}</div>
                  </div>
                  <div className="col-12"><div className="text-slate">Institute</div><div className="fw-semibold">{c.instituteName}, {c.instituteDistrict}, {c.instituteState}</div></div>
                </div>
                <p className="small text-slate mt-2 mb-0">
                  Submitted {formatDate(c.createdAt)}
                  {c.reviewedAt && ` · reviewed ${formatDate(c.reviewedAt)} by ${c.reviewedBy?.name || 'admin'}`}
                  {c.reviewerNote && ` — “${c.reviewerNote}”`}
                </p>
                <div className="d-flex flex-wrap gap-2 mt-3">
                  <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setViewing(c)}>
                    <i className="bi bi-file-earmark-image" /> View scan <span className="text-slate">({formatBytes(c.file?.size || 0)})</span>
                  </button>
                  {c.status === 'pending' && (
                    <>
                      <button type="button" className="btn btn-sm btn-primary" onClick={() => open(c, 'approved')}><i className="bi bi-check-lg" /> Approve</button>
                      <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => open(c, 'rejected')}><i className="bi bi-x-lg" /> Reject</button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {viewing && <CertificateViewer certificate={viewing} onClose={() => setViewing(null)} />}

      {reviewing && (
        <Modal title={`${reviewing.decision === 'approved' ? 'Approve' : 'Reject'} ITI certificate`} onClose={() => setReviewing(null)}>
          <form onSubmit={submit} noValidate>
            <p className="small text-slate">
              {reviewing.decision === 'approved'
                ? `${reviewing.cert.worker?.name} gets the “ITI Certified · ${getTrade(reviewing.cert.trade)?.label}” badge and can apply for ITI-only jobs in this trade.`
                : 'The worker will see your note and can submit the certificate again.'}
            </p>
            <label htmlFor="itiNote" className="form-label fw-semibold">
              Note to the worker {reviewing.decision === 'approved' ? <span className="text-slate fw-normal">(optional)</span> : <span className="text-brick fw-normal">(required)</span>}
            </label>
            <textarea id="itiNote" className={`form-control ${noteError ? 'is-invalid' : ''}`} rows="3" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={reviewing.decision === 'approved' ? 'e.g. Name, trade and number match the scan' : 'e.g. The certificate number on the scan is different'} />
            {noteError && <div className="small text-brick mt-1">{noteError}</div>}
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

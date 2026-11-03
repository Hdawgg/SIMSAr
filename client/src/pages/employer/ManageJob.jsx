import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationsApi, jobsApi } from '../../api';
import { errorMessage } from '../../api/client';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatDate, formatINR } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import EmptyState from '../../components/EmptyState';
import StatusPill from '../../components/StatusPill';
import PriceBreakdown from '../../components/PriceBreakdown';
import Avatar from '../../components/Avatar';
import Stars from '../../components/Stars';
import VerifiedBadge from '../../components/VerifiedBadge';
import ItiBadge from '../../components/ItiBadge';
import ReviewModal from '../../components/ReviewModal';
import Modal from '../../components/Modal';

// Employer's view of one job: applicants, hiring, completion and rating.
export default function ManageJob() {
  const { id } = useParams();
  const { getTrade } = useConfig();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([jobsApi.get(id), jobsApi.applications(id), jobsApi.mine()]).then(([j, a, mine]) => ({
      job: j.job,
      applications: a.applications,
      myRating: mine.jobs.find((x) => x._id === id)?.myRating || null,
    })),
    [id]
  );
  const [busy, setBusy] = useState(null);
  const [rating, setRating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeReason, setCloseReason] = useState('');

  if (loading) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /><Link to="/employer/dashboard">Back to dashboard</Link></div>;

  const { job, applications, myRating } = data;
  const trade = getTrade(job.category);
  const booking = applications.find((a) => ['accepted', 'in-progress', 'completed'].includes(a.status));
  const applicants = applications.filter((a) => a !== booking);
  // Mirrors the server rule for "ITI-certified workers only" jobs.
  const meetsIti = (a) => !job.itiRequired || a.itiCertificates?.some((c) => c.trade === job.category);

  async function run(key, fn, message) {
    setBusy(key);
    try {
      await fn();
      toast.success(message);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function closeJob(e) {
    e.preventDefault();
    await run('close', () => jobsApi.close(job._id, closeReason.trim() || undefined), 'Job closed.');
    setClosing(false);
  }

  const spinner = (key) => busy === key && <span className="spinner-border spinner-border-sm me-1" />;

  return (
    <div className="container py-4">
      <Link to="/employer/dashboard" className="small text-slate text-decoration-none"><i className="bi bi-arrow-left" /> Back to dashboard</Link>

      <div className="row g-4 mt-1 align-items-start">
        <div className="col-lg-8">
          <p className="small text-slate mb-1"><i className={`bi ${trade?.icon}`} /> {trade?.label}</p>
          <div className="d-flex flex-wrap align-items-center gap-3">
            <h1 className="display-6 fw-bold font-display mb-0">{job.title}</h1>
            <StatusPill status={job.status} />
          </div>
          <p className="small text-slate mt-2">
            <i className="bi bi-geo-alt" /> {job.location}{job.scheduledFor && ` · ${formatDate(job.scheduledFor)}`} · about {job.estimatedHours} hr · posted {formatDate(job.createdAt)}
          </p>
          {job.itiRequired && <p><span className="badge-iti small"><i className="bi bi-mortarboard-fill" /> ITI-certified workers only</span></p>}
          <p style={{ whiteSpace: 'pre-line' }}>{job.description}</p>
          {job.closedReason && <p className="small text-brick">{job.closedReason}</p>}

          <div className="d-flex flex-wrap gap-2">
            {job.status === 'open' && <Link to={`/employer/jobs/${job._id}/edit`} className="btn btn-sm btn-outline-dark"><i className="bi bi-pencil" /> Edit job</Link>}
            {['open', 'assigned'].includes(job.status) && (
              <button type="button" className="btn btn-sm btn-outline-dark" onClick={() => setClosing(true)}><i className="bi bi-x-circle" /> Close job</button>
            )}
            <Link to={`/jobs/${job._id}`} className="btn btn-sm btn-link">See public listing</Link>
          </div>

          {/* ---- The hired worker ---- */}
          {booking && (
            <section className="card-panel p-4 mt-4">
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <h2 className="h5 fw-semibold mb-0">Hired worker</h2>
                <StatusPill status={booking.status} />
              </div>
              <div className="d-flex align-items-center gap-3 mt-3">
                <Avatar name={booking.worker.name} size={52} />
                <div>
                  <Link to={`/profile/${booking.worker._id}`} className="fw-semibold">{booking.worker.name}</Link>{' '}
                  <VerifiedBadge verified={booking.workerProfile?.verified} /> <ItiBadge certificates={booking.itiCertificates} />
                  <div><Stars value={booking.worker.ratingAvg} count={booking.worker.ratingCount} /></div>
                  {booking.worker.phone && <p className="small mb-0"><i className="bi bi-telephone" /> {booking.worker.phone}</p>}
                </div>
              </div>

              <ol className="small text-slate mt-3 mb-3 ps-3">
                <li>Accepted {formatDate(booking.acceptedAt)}</li>
                <li>{booking.startedAt ? `Work started ${formatDate(booking.startedAt)}` : 'Waiting for the worker to start'}</li>
                <li>{booking.workerDoneAt ? <strong className="text-ink">Worker marked the work done {formatDate(booking.workerDoneAt)}</strong> : 'Worker marks the work done'}</li>
                <li>{booking.completedAt ? `You confirmed completion ${formatDate(booking.completedAt)}` : 'You confirm the job is complete'}</li>
              </ol>

              <div className="d-flex flex-wrap gap-2 align-items-center">
                {booking.status === 'in-progress' && (
                  <button type="button" className="btn btn-primary" disabled={busy === 'complete'} onClick={() => run('complete', () => applicationsApi.complete(booking._id), 'Job marked complete. Please rate the worker.')}>
                    {spinner('complete')}<i className="bi bi-check2-circle" /> Mark job complete
                  </button>
                )}
                {['accepted', 'in-progress'].includes(booking.status) && (
                  <button type="button" className="btn btn-outline-dark" disabled={busy === 'cancel'} onClick={() => window.confirm('Cancel this booking? The job will re-open for other workers.') && run('cancel', () => applicationsApi.cancel(booking._id), 'Booking cancelled. The job is open again.')}>
                    {spinner('cancel')}Cancel booking
                  </button>
                )}
                {booking.status === 'accepted' && <span className="small text-slate">You can mark it complete once the worker starts.</span>}
                {booking.status === 'completed' && (myRating ? (
                  <span className="small">You rated {booking.worker.name}: <Stars value={myRating} /></span>
                ) : (
                  <button type="button" className="btn btn-warning" onClick={() => setRating(true)}><i className="bi bi-star" /> Rate {booking.worker.name}</button>
                ))}
              </div>
            </section>
          )}

          {/* ---- Applicants ---- */}
          <section className="mt-4">
            <h2 className="h5 fw-semibold">{booking ? 'Other applicants' : 'Applicants'} ({applicants.length})</h2>
            {applicants.length === 0 ? (
              !booking && <EmptyState icon="bi-people" title="No applications yet">Verified {trade?.plural.toLowerCase()} will apply here. Check back soon.</EmptyState>
            ) : (
              <ul className="list-group mt-2">
                {applicants.map((a) => (
                  <li key={a._id} className="list-group-item p-3">
                    <div className="d-flex flex-wrap justify-content-between gap-3">
                      <div className="d-flex gap-3">
                        <Avatar name={a.worker.name} size={44} />
                        <div>
                          <Link to={`/profile/${a.worker._id}`} className="fw-semibold">{a.worker.name}</Link>{' '}
                          <VerifiedBadge verified={a.workerProfile?.verified} showUnverified /> <ItiBadge certificates={a.itiCertificates} />
                          <div><Stars value={a.worker.ratingAvg} count={a.worker.ratingCount} /></div>
                          {a.status === 'applied' && !meetsIti(a) && (
                            <p className="small text-brick mb-0"><i className="bi bi-mortarboard" /> No approved ITI certificate for {trade?.label.toLowerCase()} — can't be hired for this job.</p>
                          )}
                          <p className="small text-slate mb-0">
                            {a.workerProfile?.experienceYears} yrs · usual rate {formatINR(a.workerProfile?.hourlyRate)}/hr · {a.workerProfile?.location}
                          </p>
                          {a.coverNote && <p className="small mb-0 mt-1">“{a.coverNote}”</p>}
                        </div>
                      </div>
                      <div className="d-flex flex-column align-items-end gap-2">
                        <StatusPill status={a.status} />
                        {a.status === 'applied' && job.status === 'open' && (
                          <div className="d-flex gap-2">
                            <button type="button" className="btn btn-sm btn-primary" disabled={busy === a._id || !a.workerProfile?.verified || !meetsIti(a)} onClick={() => run(a._id, () => applicationsApi.accept(a._id), `${a.worker.name} is hired. Other applicants have been told.`)}>
                              {spinner(a._id)}Accept
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-dark" disabled={busy === `r${a._id}`} onClick={() => run(`r${a._id}`, () => applicationsApi.reject(a._id), 'Application declined.')}>
                              Decline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="col-lg-4">
          <aside className="ticket">
            <div className="ticket-top" />
            <div className="p-4">
              <h2 className="h5 fw-bold font-display">Price breakdown</h2>
              <PriceBreakdown budget={job.budget} feePercent={job.feePercent} hours={job.estimatedHours} />
              <p className="small text-slate mt-3 mb-0">No real payment is taken in this project. In production the budget would be held and released to the worker on completion.</p>
            </div>
          </aside>
        </div>
      </div>

      {rating && booking && (
        <ReviewModal jobId={job._id} revieweeName={booking.worker.name} onClose={() => setRating(false)} onSaved={() => { setRating(false); reload(); }} />
      )}

      {closing && (
        <Modal title="Close this job?" onClose={() => setClosing(false)}>
          <form onSubmit={closeJob}>
            <p className="small text-slate">Workers will no longer see it. Pending applicants are declined{job.status === 'assigned' ? ' and the hired worker’s booking is cancelled' : ''}.</p>
            <label htmlFor="closeReason" className="form-label fw-semibold">Reason <span className="text-slate fw-normal">(optional)</span></label>
            <input id="closeReason" className="form-control" maxLength={200} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} placeholder="e.g. Fixed it myself" />
            <div className="d-flex justify-content-end gap-2 mt-3">
              <button type="button" className="btn btn-outline-dark" onClick={() => setClosing(false)}>Keep it open</button>
              <button type="submit" className="btn btn-primary" disabled={busy === 'close'}>{spinner('close')}Close job</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

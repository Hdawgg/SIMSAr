import { useState } from 'react';
import { Link } from 'react-router-dom';
import { applicationsApi, profileApi } from '../../api';
import { errorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatDate, formatINR } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import EmptyState from '../../components/EmptyState';
import StatusPill from '../../components/StatusPill';
import Stars from '../../components/Stars';
import VerifiedBadge from '../../components/VerifiedBadge';
import ItiBadge from '../../components/ItiBadge';
import ReviewModal from '../../components/ReviewModal';

function VerificationBanner({ verified, check }) {
  if (verified) return null;
  const status = check?.status;
  const text = {
    pending: 'Your background check is being reviewed by a SIMSAR admin. You can apply for jobs once it is approved.',
    rejected: `Your background check was not approved${check?.reviewerNotes ? `: “${check.reviewerNotes}”` : '.'} Please submit it again.`,
  }[status] || 'Complete a background check to start applying for jobs. It takes about two minutes.';
  return (
    <div className={`alert ${status === 'rejected' ? 'alert-danger' : 'alert-warning'} d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3`}>
      <span><i className="bi bi-shield-exclamation" /> {text}</span>
      <Link to="/worker/verification" className="btn btn-sm btn-primary">{status === 'pending' ? 'View status' : 'Go to verification'}</Link>
    </div>
  );
}

export default function WorkerDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, setData } = useAsync(
    () => Promise.all([profileApi.mine(), applicationsApi.mine()]).then(([me, apps]) => ({ ...me, applications: apps.applications })),
    []
  );
  const [busyId, setBusyId] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  if (loading) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /></div>;

  const { user: me, profile, backgroundCheck, itiCertificates, applications } = data;
  const approvedIti = itiCertificates.filter((c) => c.status === 'approved');
  const pendingIti = itiCertificates.find((c) => c.status === 'pending');
  const active = applications.filter((a) => ['accepted', 'in-progress'].includes(a.status));
  const pending = applications.filter((a) => a.status === 'applied');
  const completed = applications.filter((a) => a.status === 'completed');
  const closed = applications.filter((a) => ['rejected', 'cancelled'].includes(a.status));
  const earned = completed.reduce((sum, a) => sum + a.job.workerPayout, 0);

  async function act(application, action, successMessage) {
    setBusyId(application._id);
    try {
      await applicationsApi[action](application._id);
      toast.success(successMessage);
      await reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAvailability() {
    try {
      const res = await profileApi.update({ isAvailable: !profile.isAvailable });
      setData({ ...data, profile: res.profile });
      toast.info(res.profile.isAvailable ? 'You are taking new jobs.' : 'You are not taking new jobs.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const btn = (a, action, label, message, style = 'btn-primary') => (
    <button type="button" className={`btn btn-sm ${style}`} disabled={busyId === a._id} onClick={() => act(a, action, message)}>
      {busyId === a._id && <span className="spinner-border spinner-border-sm me-1" />}{label}
    </button>
  );

  const jobLine = (a) => (
    <>
      <Link to={`/jobs/${a.job._id}`} className="fw-semibold text-reset">{a.job.title}</Link>
      <p className="small text-slate mb-0">
        {a.job.employer?.name} · {a.job.location}
        {a.job.scheduledFor && ` · ${formatDate(a.job.scheduledFor)}`} · you get <strong className="text-leaf">{formatINR(a.job.workerPayout)}</strong>
      </p>
    </>
  );

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <p className="text-slate mb-0">Worker dashboard</p>
          <h1 className="display-6 fw-bold font-display mb-0">Namaste, {user.name.split(' ')[0]}</h1>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <VerifiedBadge verified={profile.verified} showUnverified />
            <ItiBadge certificates={approvedIti} />
          </div>
        </div>
        <div className="card-panel px-3 py-2 d-flex align-items-center gap-3">
          <label className="small fw-medium" htmlFor="availSwitch">{profile.isAvailable ? 'Taking new jobs' : 'Not taking new jobs'}</label>
          <div className="form-check form-switch mb-0">
            <input className="form-check-input" type="checkbox" role="switch" id="availSwitch" style={{ width: '2.5em', height: '1.4em' }} checked={profile.isAvailable} onChange={toggleAvailability} />
          </div>
        </div>
      </div>

      <VerificationBanner verified={profile.verified} check={backgroundCheck} />

      <div className="row g-3 mt-1">
        {[
          [completed.length, 'jobs completed'],
          [formatINR(earned), 'earned on SIMSAR'],
          [me.ratingCount ? me.ratingAvg.toFixed(1) : '–', `rating (${me.ratingCount} reviews)`],
          [active.length, 'active bookings'],
        ].map(([value, label]) => (
          <div className="col-6 col-lg-3" key={label}>
            <div className="card-panel p-3"><p className="stat-value mb-0">{value}</p><p className="small text-slate mb-0">{label}</p></div>
          </div>
        ))}
      </div>

      <div className="row g-4 mt-1 align-items-start">
        <div className="col-lg-8">
          <section>
            <h2 className="h5 fw-semibold">Active bookings</h2>
            {active.length === 0 ? (
              <p className="text-slate small">No active bookings. <Link to="/jobs">Find a job</Link>.</p>
            ) : (
              <ul className="list-group mt-2">
                {active.map((a) => (
                  <li key={a._id} className="list-group-item p-3">
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <div>{jobLine(a)}</div>
                      <StatusPill status={a.status} />
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-2 align-items-center">
                      {a.status === 'accepted' && btn(a, 'start', 'Start work', 'Marked as started. Good luck!')}
                      {a.status === 'accepted' && btn(a, 'cancel', 'Cancel booking', 'Booking cancelled.', 'btn-outline-dark')}
                      {a.status === 'in-progress' && !a.workerDoneAt && btn(a, 'done', 'Mark work done', 'Marked as done. The employer will confirm completion.', 'btn-warning')}
                      {a.workerDoneAt && <span className="small text-slate"><i className="bi bi-hourglass-split" /> You marked this done on {formatDate(a.workerDoneAt)}. Waiting for the employer to confirm.</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4">
            <h2 className="h5 fw-semibold">Applications waiting for a reply</h2>
            {pending.length === 0 ? <p className="text-slate small">None right now.</p> : (
              <ul className="list-group mt-2">
                {pending.map((a) => (
                  <li key={a._id} className="list-group-item p-3 d-flex flex-wrap justify-content-between gap-2 align-items-center">
                    <div>{jobLine(a)}</div>
                    <div className="d-flex gap-2 align-items-center">
                      <StatusPill status={a.status} />
                      {btn(a, 'cancel', 'Withdraw', 'Application withdrawn.', 'btn-outline-dark')}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-4">
            <h2 className="h5 fw-semibold">Completed jobs</h2>
            {completed.length === 0 ? (
              <EmptyState icon="bi-clipboard-check" title="No completed jobs yet">Finished jobs and your ratings of employers appear here.</EmptyState>
            ) : (
              <ul className="list-group mt-2">
                {completed.map((a) => (
                  <li key={a._id} className="list-group-item p-3 d-flex flex-wrap justify-content-between gap-2 align-items-center">
                    <div>
                      {jobLine(a)}
                      <p className="small text-slate mb-0">Completed {formatDate(a.completedAt)}</p>
                    </div>
                    {a.myRating ? (
                      <span className="small text-slate text-end">You rated the employer<br /><Stars value={a.myRating} /></span>
                    ) : (
                      <button type="button" className="btn btn-sm btn-warning" onClick={() => setReviewing(a)}>
                        <i className="bi bi-star" /> Rate employer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {closed.length > 0 && (
            <section className="mt-4">
              <h2 className="h6 fw-semibold text-slate">Past applications</h2>
              <ul className="list-group mt-2">
                {closed.map((a) => (
                  <li key={a._id} className="list-group-item p-3 d-flex justify-content-between gap-2 align-items-center">
                    <span className="small"><Link to={`/jobs/${a.job._id}`} className="text-reset">{a.job.title}</Link></span>
                    <StatusPill status={a.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="col-lg-4">
          <aside className="card-panel p-4">
            <div className="d-flex justify-content-between align-items-center">
              <span className="fw-bold font-display">Work Passport</span>
              <span className="small text-slate">SIM-WP-{String(user._id).slice(-4).toUpperCase()}</span>
            </div>
            <div className="row text-center g-2 mt-2 pt-3" style={{ borderTop: '1px dashed var(--line)' }}>
              <div className="col-6"><p className="stat-value mb-0">{completed.length}</p><p className="small text-slate mb-0">completed jobs</p></div>
              <div className="col-6"><p className="stat-value mb-0">{me.ratingCount ? me.ratingAvg.toFixed(1) : '–'}</p><p className="small text-slate mb-0">avg. rating</p></div>
            </div>
            <p className="small mt-3 mb-0">
              <i className="bi bi-mortarboard" />{' '}
              {approvedIti.length > 0
                ? 'ITI certificate verified by SIMSAR admin against the certificate.'
                : pendingIti
                  ? 'Your ITI certificate is waiting for admin review.'
                  : <>Trained at an ITI? <Link to="/worker/verification">Add your certificate</Link> to unlock ITI-only jobs.</>}
            </p>
            <Link to={`/profile/${user._id}`} className="btn btn-outline-dark w-100 mt-3">View public profile</Link>
            <Link to="/worker/profile" className="btn btn-primary w-100 mt-2">Edit profile</Link>
          </aside>
        </div>
      </div>

      {reviewing && (
        <ReviewModal
          jobId={reviewing.job._id}
          revieweeName={reviewing.job.employer?.name || 'the employer'}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); reload(); }}
        />
      )}
    </div>
  );
}

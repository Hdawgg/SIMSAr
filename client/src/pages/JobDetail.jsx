import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { applicationsApi, jobsApi, profileApi } from '../api';
import { errorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';
import useAsync from '../utils/useAsync';
import { formatDate, formatINR } from '../utils/format';
import Loading from '../components/Loading';
import ErrorAlert from '../components/ErrorAlert';
import PriceBreakdown from '../components/PriceBreakdown';
import StatusPill from '../components/StatusPill';
import Stars from '../components/Stars';

// The apply box on the right. What it shows depends on who is looking.
function ApplyBox({ job, onApplied }) {
  const { user } = useAuth();
  const toast = useToast();
  const [coverNote, setCoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // For a logged-in worker we need their verification and any existing application.
  const worker = useAsync(
    () => (user?.role === 'worker'
      ? Promise.all([profileApi.mine(), applicationsApi.mine()]).then(([me, apps]) => ({
        verified: me.profile?.verified,
        checkStatus: me.backgroundCheck?.status,
        approvedItiTrades: me.itiCertificates.filter((c) => c.status === 'approved').map((c) => c.trade),
        itiPending: me.itiCertificates.some((c) => c.status === 'pending' && c.trade === job.category),
        application: apps.applications.find((a) => a.job._id === job._id),
      }))
      : Promise.resolve(null)),
    [user?._id, job._id]
  );

  if (!user) {
    return (
      <>
        <p className="small text-slate">Log in as a verified worker to apply.</p>
        <Link to="/login/worker" state={{ from: `/jobs/${job._id}` }} className="btn btn-primary w-100">Log in to apply</Link>
      </>
    );
  }
  if (user.role === 'employer') {
    return job.employer._id === user._id
      ? <Link to={`/employer/jobs/${job._id}`} className="btn btn-primary w-100">Manage this job</Link>
      : <p className="small text-slate mb-0">You are logged in as an employer. Only workers can apply.</p>;
  }
  if (user.role !== 'worker') return null;
  if (worker.loading) return <Loading />;
  if (worker.error) return <ErrorAlert message={worker.error} onRetry={worker.reload} />;

  const { verified, checkStatus, approvedItiTrades, itiPending, application } = worker.data;
  if (application && application.status !== 'cancelled') {
    return (
      <div>
        <p className="small mb-1">Your application: <StatusPill status={application.status} /></p>
        <Link to="/worker/dashboard" className="btn btn-outline-dark w-100 mt-2">Track it on your dashboard</Link>
      </div>
    );
  }
  if (job.status !== 'open') return <p className="small text-slate mb-0">This job is no longer taking applications.</p>;
  if (!verified) {
    return (
      <div className="rounded-3 p-3 bg-turmeric-soft small">
        <p className="fw-semibold mb-1"><i className="bi bi-shield-exclamation" /> Background check required</p>
        <p className="mb-2">
          {checkStatus === 'pending'
            ? 'Your background check is being reviewed. You can apply once an admin approves it.'
            : 'You need an approved background check before you can apply for jobs.'}
        </p>
        <Link to="/worker/verification" className="btn btn-sm btn-primary">
          {checkStatus === 'pending' ? 'View status' : 'Start background check'}
        </Link>
      </div>
    );
  }
  // The server enforces this too; this box just explains it before the worker tries.
  if (job.itiRequired && !approvedItiTrades.includes(job.category)) {
    return (
      <div className="rounded-3 p-3 bg-turmeric-soft small">
        <p className="fw-semibold mb-1"><i className="bi bi-mortarboard" /> ITI certificate required</p>
        <p className="mb-2">
          {itiPending
            ? 'Your ITI certificate is being reviewed. You can apply once an admin approves it.'
            : 'The employer is looking for ITI-certified workers. Add your ITI certificate for this trade to apply.'}
        </p>
        <Link to="/worker/verification" className="btn btn-sm btn-primary">{itiPending ? 'View status' : 'Add ITI certificate'}</Link>
      </div>
    );
  }

  async function apply(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await jobsApi.apply(job._id, coverNote.trim());
      toast.success('Application sent. The employer will be notified.');
      worker.reload();
      onApplied();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={apply} noValidate>
      <label htmlFor="coverNote" className="form-label small fw-semibold">Note to the employer <span className="text-slate fw-normal">(optional)</span></label>
      <textarea id="coverNote" className="form-control" rows="3" maxLength={500} value={coverNote} onChange={(e) => setCoverNote(e.target.value)} placeholder="When can you come? Anything you will bring?" />
      {error && <div className="small text-brick mt-1">{error}</div>}
      <button type="submit" className="btn btn-primary w-100 mt-3" disabled={submitting}>
        {submitting && <span className="spinner-border spinner-border-sm me-1" />}Apply for this job
      </button>
    </form>
  );
}

export default function JobDetail() {
  const { id } = useParams();
  const { getTrade } = useConfig();
  const { data, loading, error, reload } = useAsync(() => jobsApi.get(id), [id]);

  if (loading) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /></div>;

  const { job, employerProfile, applicationCount } = data;
  const trade = getTrade(job.category);

  return (
    <div className="container py-4">
      <Link to="/jobs" className="small text-slate text-decoration-none"><i className="bi bi-arrow-left" /> Back to jobs</Link>
      <div className="row g-4 mt-1 align-items-start">
        <div className="col-lg-8">
          <p className="small text-slate mb-1"><i className={`bi ${trade?.icon}`} /> {trade?.label} needed</p>
          <h1 className="display-6 fw-bold font-display">{job.title}</h1>
          <div className="d-flex flex-wrap gap-3 small text-slate mb-3">
            <StatusPill status={job.status} />
            <span><i className="bi bi-geo-alt" /> {job.location}{job.pincode ? ` · ${job.pincode}` : ''}</span>
            {job.scheduledFor && <span><i className="bi bi-calendar-event" /> {formatDate(job.scheduledFor)}</span>}
            <span><i className="bi bi-clock" /> about {job.estimatedHours} hr</span>
            <span><i className="bi bi-people" /> {applicationCount} applied</span>
            {job.itiRequired && <span className="badge-iti"><i className="bi bi-mortarboard-fill" /> ITI-certified workers only</span>}
          </div>
          <section className="card-panel p-4">
            <h2 className="h5 fw-semibold">About the job</h2>
            <p className="mb-0" style={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>{job.description}</p>
          </section>

          <section className="card-panel p-4 mt-4">
            <h2 className="h5 fw-semibold">Posted by</h2>
            <p className="mb-1">
              <Link to={`/profile/${job.employer._id}`} className="fw-semibold">{job.employer.name}</Link>
              {employerProfile?.company && <span className="text-slate"> · {employerProfile.company}</span>}
            </p>
            <Stars value={job.employer.ratingAvg} count={job.employer.ratingCount} />
            <p className="small text-slate mb-0 mt-1">Rated by workers who completed jobs for this employer.</p>
          </section>

          <section className="rounded-3 p-3 mt-4 d-flex gap-3 bg-leaf-soft">
            <i className="bi bi-wallet2 mt-1 text-leaf" />
            <p className="small mb-0" style={{ lineHeight: 1.55 }}>
              {/* The job keeps the minimum that applied when it was posted, even if the admin changes the rate later. */}
              The fair minimum for {trade?.plural.toLowerCase()} was {formatINR(job.minHourlyRate ?? trade?.minHourlyRate)}/hr when
              this job was posted. It pays the worker {formatINR(job.workerPayout / job.estimatedHours)}/hr after SIMSAR's
              fixed {job.feePercent}% fee; both were locked in when the job was posted.
            </p>
          </section>
        </div>

        <div className="col-lg-4">
          <aside className="ticket">
            <div className="ticket-top" />
            <div className="p-4">
              <h2 className="h4 fw-bold font-display">Price breakdown</h2>
              <PriceBreakdown budget={job.budget} feePercent={job.feePercent} hours={job.estimatedHours} />
            </div>
            <div className="ticket-cut" />
            <div className="p-4">
              <ApplyBox job={job} onApplied={reload} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

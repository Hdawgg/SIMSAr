import { useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsApi, profileApi } from '../../api';
import { useConfig } from '../../context/ConfigContext';
import useAsync from '../../utils/useAsync';
import { formatINR } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import EmptyState from '../../components/EmptyState';
import JobCard from '../../components/JobCard';
import Stars from '../../components/Stars';

const TABS = [
  { id: 'active', label: 'Active', statuses: ['open', 'assigned', 'in-progress'] },
  { id: 'completed', label: 'Completed', statuses: ['completed'] },
  { id: 'closed', label: 'Closed', statuses: ['closed'] },
];

// What needs the employer's attention on a job, if anything.
function nextStep(job) {
  if (job.status === 'open' && job.pendingApplicants > 0) return { text: `${job.pendingApplicants} new applicant${job.pendingApplicants > 1 ? 's' : ''} to review`, cta: 'Review applicants' };
  if (job.status === 'in-progress' && job.booking?.workerDoneAt) return { text: 'Worker says the work is done', cta: 'Confirm completion' };
  if (job.status === 'completed' && !job.myRating) return { text: 'Rate the worker', cta: 'Rate worker' };
  return null;
}

export default function EmployerDashboard() {
  const { platformFeePercent } = useConfig();
  const [tab, setTab] = useState('active');
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([jobsApi.mine(), profileApi.mine()]).then(([j, me]) => ({ jobs: j.jobs, me })),
    []
  );

  if (loading) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /></div>;

  const { jobs, me } = data;
  const completed = jobs.filter((j) => j.status === 'completed');
  const spent = completed.reduce((sum, j) => sum + j.budget, 0);
  const fees = completed.reduce((sum, j) => sum + j.platformFee, 0);
  const attention = jobs.filter(nextStep);
  const shown = jobs.filter((j) => TABS.find((t) => t.id === tab).statuses.includes(j.status));

  return (
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-3">
        <div>
          <p className="text-slate mb-0">Employer dashboard{me.profile?.company ? ` · ${me.profile.company}` : ''}</p>
          <h1 className="display-6 fw-bold font-display mb-1">Hello, {me.user.name.split(' ')[0]}</h1>
          <span className="small">Your rating from workers: <Stars value={me.user.ratingAvg} count={me.user.ratingCount} /></span>
        </div>
        <Link to="/employer/jobs/new" className="btn btn-primary"><i className="bi bi-plus-lg" /> Post a job</Link>
      </div>

      <div className="row g-3 mt-2">
        {[
          [jobs.length, 'jobs posted'],
          [jobs.filter((j) => ['open', 'assigned', 'in-progress'].includes(j.status)).length, 'active jobs'],
          [completed.length, 'completed'],
          [formatINR(spent), `paid, incl. ${formatINR(fees)} in fees`],
        ].map(([value, label]) => (
          <div className="col-6 col-lg-3" key={label}>
            <div className="card-panel p-3"><p className="stat-value mb-0">{value}</p><p className="small text-slate mb-0">{label}</p></div>
          </div>
        ))}
      </div>

      {attention.length > 0 && (
        <section className="card-panel p-4 mt-4" style={{ borderColor: 'var(--turmeric)' }}>
          <h2 className="h5 fw-semibold"><i className="bi bi-bell" /> Needs your attention</h2>
          <ul className="list-unstyled mb-0">
            {attention.map((j) => {
              const step = nextStep(j);
              return (
                <li key={j._id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2 border-bottom border-line">
                  <span><strong>{j.title}</strong> <span className="text-slate small">— {step.text}</span></span>
                  <Link to={`/employer/jobs/${j._id}`} className="btn btn-sm btn-warning">{step.cta}</Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ul className="nav nav-tabs mt-4">
        {TABS.map((t) => (
          <li className="nav-item" key={t.id}>
            <button type="button" className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label} <span className="badge rounded-pill text-bg-light">{jobs.filter((j) => t.statuses.includes(j.status)).length}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="d-flex flex-column gap-3 mt-3">
        {shown.length === 0 ? (
          <EmptyState icon="bi-briefcase" title={tab === 'active' ? 'No active jobs' : `No ${tab} jobs`}>
            {tab === 'active' && (
              <>
                <p>Post a job and verified workers nearby can apply. SIMSAR's fee is a fixed {platformFeePercent}%.</p>
                <Link to="/employer/jobs/new" className="btn btn-primary">Post a job</Link>
              </>
            )}
          </EmptyState>
        ) : shown.map((j) => (
          <JobCard key={j._id} job={j} showStatus>
            <div className="text-end">
              <p className="small text-slate mb-1">
                {j.assignedWorker ? <>Worker: <strong className="text-ink">{j.assignedWorker.name}</strong></> : `${j.applicants} applicant${j.applicants === 1 ? '' : 's'}`}
                {j.myRating && <> · you rated <Stars value={j.myRating} /></>}
              </p>
              <Link to={`/employer/jobs/${j._id}`} className="btn btn-sm btn-outline-dark">Manage</Link>
            </div>
          </JobCard>
        ))}
      </div>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { formatDate, formatINR, timeAgo } from '../utils/format';
import StatusPill from './StatusPill';

// One job in a list (job board, dashboards). Shows the price breakdown inline
// so the platform fee is visible before anyone clicks in.
export default function JobCard({ job, children, showStatus = false }) {
  const { getTrade } = useConfig();
  const trade = getTrade(job.category);

  return (
    <article className="card-panel p-4 job-card">
      <div className="d-flex flex-wrap justify-content-between gap-2">
        <p className="small text-slate mb-1">
          <i className={`bi ${trade?.icon}`} /> {trade?.label}
          <span className="mx-2">·</span>
          <i className="bi bi-geo-alt" /> {job.location}
          {job.scheduledFor && (<><span className="mx-2">·</span><i className="bi bi-calendar-event" /> {formatDate(job.scheduledFor)}</>)}
        </p>
        {showStatus ? <StatusPill status={job.status} /> : <span className="small text-slate">{timeAgo(job.createdAt)}</span>}
      </div>
      <h3 className="h5 fw-bold font-display mb-1">
        <Link to={`/jobs/${job._id}`} className="text-reset text-decoration-none">{job.title}</Link>
      </h3>
      {job.itiRequired && <p className="mb-1"><span className="badge-iti small"><i className="bi bi-mortarboard-fill" /> ITI-certified workers only</span></p>}
      <p className="text-slate small text-truncate-2 mb-3">{job.description}</p>

      <div className="d-flex flex-wrap align-items-end justify-content-between gap-3">
        <div className="d-flex flex-wrap gap-4 small">
          <div>
            <div className="text-slate">Budget</div>
            <div className="fw-semibold">{formatINR(job.budget)}</div>
          </div>
          <div>
            <div className="text-slate">SIMSAR fee ({job.feePercent}%)</div>
            <div className="fw-semibold">{formatINR(job.platformFee)}</div>
          </div>
          <div>
            <div className="text-slate">Worker gets</div>
            <div className="fw-bold text-leaf">{formatINR(job.workerPayout)}</div>
          </div>
          <div>
            <div className="text-slate">Time</div>
            <div className="fw-semibold">~{job.estimatedHours} hr</div>
          </div>
        </div>
        {children}
      </div>
    </article>
  );
}

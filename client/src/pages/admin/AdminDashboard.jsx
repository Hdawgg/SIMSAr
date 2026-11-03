import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../api';
import useAsync from '../../utils/useAsync';
import { formatINR } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import ChecksTab from './ChecksTab';
import UsersTab from './UsersTab';
import JobsTab from './JobsTab';
import ItiTab from './ItiTab';
import TradesTab from './TradesTab';

function StatCard({ value, label, sub }) {
  return (
    <div className="col-6 col-lg-3">
      <div className="card-panel p-3 h-100">
        <p className="stat-value mb-0">{value}</p>
        <p className="small text-slate mb-0">{label}</p>
        {sub && <p className="small mb-0 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'checks', label: 'Background checks', icon: 'bi-shield-check', pending: 'pendingChecks' },
  { id: 'iti', label: 'ITI Certificates', icon: 'bi-mortarboard', pending: 'pendingIti' },
  { id: 'trades', label: 'Trades & Wage Rates', icon: 'bi-cash-coin' },
  { id: 'users', label: 'Users', icon: 'bi-people' },
  { id: 'jobs', label: 'Job moderation', icon: 'bi-briefcase' },
];

export default function AdminDashboard() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'checks';
  const stats = useAsync(() => adminApi.stats(), []);

  const s = stats.data;
  return (
    <div className="container py-4">
      <p className="text-slate mb-0">SIMSAR admin</p>
      <h1 className="display-6 fw-bold font-display">Admin dashboard</h1>

      <ErrorAlert message={stats.error} onRetry={stats.reload} />
      {stats.loading && !s ? <Loading /> : s && (
        <div className="row g-3 mt-1">
          <StatCard value={s.users.total} label="total users" sub={`${s.users.workers} workers · ${s.users.employers} employers · ${s.users.admins} admin`} />
          <StatCard value={s.jobs.total} label="jobs posted" sub={`${s.jobs.byStatus.open || 0} open · ${(s.jobs.byStatus.assigned || 0) + (s.jobs.byStatus['in-progress'] || 0)} in progress`} />
          <StatCard value={s.jobs.completed} label="completed jobs" sub={`${formatINR(s.money.workerPayouts)} paid to workers · ${formatINR(s.money.platformFees)} fees`} />
          <StatCard value={s.reviews.total ? s.reviews.averageRating.toFixed(1) : '–'} label="average rating" sub={`${s.reviews.total} reviews · ${s.users.verifiedWorkers} verified · ${s.users.itiCertifiedWorkers} ITI certified`} />
        </div>
      )}

      <ul className="nav nav-tabs mt-4">
        {TABS.map((t) => (
          <li className="nav-item" key={t.id}>
            <button type="button" className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => setParams({ tab: t.id })}>
              <i className={`bi ${t.icon}`} /> {t.label}
              {t.pending && s?.[t.pending] > 0 && <span className="badge rounded-pill text-bg-warning ms-1">{s[t.pending]}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3">
        {/* Tabs call onChange after an action so the stats above stay current. */}
        {tab === 'checks' && <ChecksTab onChange={stats.reload} />}
        {tab === 'iti' && <ItiTab onChange={stats.reload} />}
        {tab === 'trades' && <TradesTab onChange={stats.reload} />}
        {tab === 'users' && <UsersTab onChange={stats.reload} />}
        {tab === 'jobs' && <JobsTab onChange={stats.reload} />}
      </div>
    </div>
  );
}

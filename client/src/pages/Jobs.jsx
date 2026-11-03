import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { jobsApi } from '../api';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import useAsync from '../utils/useAsync';
import JobCard from '../components/JobCard';
import Loading from '../components/Loading';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';

const FILTER_KEYS = ['q', 'category', 'location', 'minBudget', 'maxBudget'];

// Job board: search and filter open jobs by category, location and budget.
// Filters live in the URL (?category=plumber&...), so a filtered list can be shared.
export default function Jobs() {
  const { trades } = useConfig();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const applied = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const [draft, setDraft] = useState(applied);

  const { data, loading, error, reload } = useAsync(
    () => jobsApi.list(Object.fromEntries(Object.entries(applied).filter(([, v]) => v))),
    [params.toString()]
  );

  function apply(next) {
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v !== '')));
  }

  function onSubmit(e) {
    e.preventDefault();
    apply(draft);
  }

  function clear() {
    const empty = Object.fromEntries(FILTER_KEYS.map((k) => [k, '']));
    setDraft(empty);
    apply(empty);
  }

  const budgetError = draft.minBudget && draft.maxBudget && Number(draft.minBudget) > Number(draft.maxBudget);
  const jobs = data?.jobs || [];

  return (
    <div className="container py-5">
      <h1 className="display-6 fw-bold font-display">Find jobs</h1>
      <p className="text-slate">
        Every budget below already clears the fair minimum for its trade. The worker payout is shown after SIMSAR's fee.
      </p>

      <form className="card-panel p-3 mt-3" onSubmit={onSubmit} noValidate>
        <div className="row g-2">
          <div className="col-12 col-lg-4">
            <label htmlFor="jobQ" className="visually-hidden">Search</label>
            <div className="position-relative">
              <i className="bi bi-search position-absolute text-slate" style={{ left: 14, top: 9 }} />
              <input id="jobQ" className="form-control" style={{ paddingLeft: 38 }} placeholder="Search e.g. fan, leak, paint" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
            </div>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="jobCat" className="visually-hidden">Category</label>
            <select id="jobCat" className="form-select" value={draft.category} onChange={(e) => { const next = { ...draft, category: e.target.value }; setDraft(next); apply(next); }}>
              <option value="">All trades</option>
              {trades.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
            </select>
          </div>
          <div className="col-6 col-lg-2">
            <label htmlFor="jobLoc" className="visually-hidden">Location</label>
            <input id="jobLoc" className="form-control" placeholder="Location" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
          </div>
          <div className="col-6 col-lg-1">
            <label htmlFor="jobMin" className="visually-hidden">Minimum budget</label>
            <input id="jobMin" type="number" min="0" className={`form-control ${budgetError ? 'is-invalid' : ''}`} placeholder="Min ₹" value={draft.minBudget} onChange={(e) => setDraft({ ...draft, minBudget: e.target.value })} />
          </div>
          <div className="col-6 col-lg-1">
            <label htmlFor="jobMax" className="visually-hidden">Maximum budget</label>
            <input id="jobMax" type="number" min="0" className={`form-control ${budgetError ? 'is-invalid' : ''}`} placeholder="Max ₹" value={draft.maxBudget} onChange={(e) => setDraft({ ...draft, maxBudget: e.target.value })} />
          </div>
          <div className="col-12 col-lg-2 d-flex gap-2">
            <button type="submit" className="btn btn-primary flex-grow-1" disabled={budgetError}>Search</button>
            <button type="button" className="btn btn-outline-dark" onClick={clear} aria-label="Clear filters"><i className="bi bi-x-lg" /></button>
          </div>
        </div>
        {budgetError && <div className="small text-brick mt-2">Minimum budget can't be more than the maximum.</div>}
      </form>

      {!user && (
        <p className="small text-slate mt-3 mb-0">
          Want to apply? <Link to="/register/worker">Join as a worker</Link> or <Link to="/login/worker">log in</Link>.
        </p>
      )}

      <div className="mt-4">
        <ErrorAlert message={error} onRetry={reload} />
        {loading ? (
          <Loading label="Loading jobs…" />
        ) : !error && jobs.length === 0 ? (
          <EmptyState icon="bi-search" title="No open jobs match these filters.">
            <button type="button" className="btn btn-primary mt-2" onClick={clear}>Clear filters</button>
          </EmptyState>
        ) : (
          <>
            <p className="small text-slate">{jobs.length} open {jobs.length === 1 ? 'job' : 'jobs'}</p>
            <div className="d-flex flex-column gap-3">
              {jobs.map((job) => (
                <JobCard key={job._id} job={job}>
                  <Link to={`/jobs/${job._id}`} className="btn btn-outline-dark btn-sm">View details</Link>
                </JobCard>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

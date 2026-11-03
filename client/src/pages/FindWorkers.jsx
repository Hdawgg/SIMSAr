import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { profileApi } from '../api';
import { useConfig } from '../context/ConfigContext';
import useAsync from '../utils/useAsync';
import { formatINR } from '../utils/format';
import Avatar from '../components/Avatar';
import Stars from '../components/Stars';
import VerifiedBadge from '../components/VerifiedBadge';
import ItiBadge from '../components/ItiBadge';
import Loading from '../components/Loading';
import ErrorAlert from '../components/ErrorAlert';
import EmptyState from '../components/EmptyState';

// Ported from simsar-bootstrap/find-workers.html, now backed by GET /api/workers.
export default function FindWorkers() {
  const { trades, getTrade } = useConfig();
  const [params, setParams] = useSearchParams();
  const filters = {
    trade: params.get('trade') || '',
    q: params.get('q') || '',
    location: params.get('location') || '',
    sort: params.get('sort') || 'rating',
    verified: params.get('verified') || '',
    available: params.get('available') || '',
    iti: params.get('iti') || '',
  };
  const [search, setSearch] = useState(filters.q);
  const [location, setLocation] = useState(filters.location);

  const { data, loading, error, reload } = useAsync(
    () => profileApi.workers(Object.fromEntries(Object.entries(filters).filter(([, v]) => v))),
    [params.toString()]
  );

  function update(changes) {
    const next = { ...filters, ...changes };
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => v && !(k === 'sort' && v === 'rating'))));
  }

  function clear() {
    setSearch('');
    setLocation('');
    setParams({});
  }

  const workers = data?.workers || [];

  return (
    <div className="container py-5">
      <h1 className="display-6 fw-bold font-display">Find a worker</h1>
      <p className="text-slate">{loading ? 'Loading workers…' : `${workers.length} ${workers.length === 1 ? 'worker' : 'workers'} found`}</p>

      <form className="row g-3 align-items-center mt-1" onSubmit={(e) => { e.preventDefault(); update({ q: search.trim(), location: location.trim() }); }}>
        <div className="col-12 col-md-5">
          <label htmlFor="fwSearch" className="visually-hidden">Search workers</label>
          <div className="position-relative">
            <i className="bi bi-search position-absolute text-slate" style={{ left: 14, top: 9 }} />
            <input id="fwSearch" className="form-control" style={{ paddingLeft: 38 }} placeholder="Search by name or skill, e.g. fan install" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="col-6 col-md-3">
          <label htmlFor="fwArea" className="visually-hidden">Area</label>
          <input id="fwArea" className="form-control" placeholder="Area, e.g. Dadar" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="col-6 col-md-2">
          <label htmlFor="fwSort" className="visually-hidden">Sort by</label>
          <select id="fwSort" className="form-select" value={filters.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="rating">Highest rated</option>
            <option value="rate">Lowest rate</option>
            <option value="experience">Most experience</option>
          </select>
        </div>
        <div className="col-12 col-md-2">
          <button type="submit" className="btn btn-primary w-100">Search</button>
        </div>
      </form>

      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="button" className={`chip ${!filters.trade ? 'active' : ''}`} onClick={() => update({ trade: '' })}>All trades</button>
        {trades.map((t) => (
          <button key={t.slug} type="button" className={`chip ${filters.trade === t.slug ? 'active' : ''}`} onClick={() => update({ trade: t.slug })}>
            <i className={`bi ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>

      <div className="d-flex flex-wrap gap-4 mt-3">
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="fwVerified" checked={filters.verified === 'true'} onChange={(e) => update({ verified: e.target.checked ? 'true' : '' })} />
          <label className="form-check-label fw-medium" htmlFor="fwVerified">Verified only</label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="fwAvail" checked={filters.available === 'true'} onChange={(e) => update({ available: e.target.checked ? 'true' : '' })} />
          <label className="form-check-label fw-medium" htmlFor="fwAvail">Taking new jobs</label>
        </div>
        <div className="form-check">
          <input className="form-check-input" type="checkbox" id="fwIti" checked={filters.iti === 'true'} onChange={(e) => update({ iti: e.target.checked ? 'true' : '' })} />
          <label className="form-check-label fw-medium" htmlFor="fwIti">ITI certified</label>
        </div>
      </div>

      <div className="mt-4">
        <ErrorAlert message={error} onRetry={reload} />
        {loading ? <Loading /> : !error && workers.length === 0 ? (
          <EmptyState icon="bi-person-x" title="No workers match these filters.">
            <p>Clear the filters to see everyone.</p>
            <button type="button" className="btn btn-primary" onClick={clear}>Clear filters</button>
          </EmptyState>
        ) : (
          <div className="d-flex flex-column gap-3">
            {workers.map((w) => {
              const trade = getTrade(w.trade);
              return (
                <article key={w._id} className="card-panel p-4 job-card">
                  <div className="d-flex flex-column flex-md-row gap-3 justify-content-between">
                    <div className="d-flex gap-3">
                      <Avatar name={w.user.name} size={56} />
                      <div>
                        <h2 className="h5 fw-bold font-display mb-1">
                          <Link to={`/profile/${w.user._id}`} className="text-reset text-decoration-none">{w.user.name}</Link>
                        </h2>
                        <p className="small text-slate mb-1">
                          <i className={`bi ${trade?.icon}`} /> {trade?.label} · {w.location} · {w.experienceYears} yrs experience
                        </p>
                        <div className="d-flex flex-wrap gap-3 align-items-center">
                          <Stars value={w.user.ratingAvg} count={w.user.ratingCount} />
                          <VerifiedBadge verified={w.verified} showUnverified />
                          <ItiBadge certificates={w.itiCertificates} />
                          {!w.isAvailable && <span className="small text-brick">Not taking jobs</span>}
                        </div>
                        {w.skills?.length > 0 && <p className="small text-slate mt-2 mb-0">{w.skills.join(' · ')}</p>}
                      </div>
                    </div>
                    <div className="text-md-end">
                      <p className="fw-bold fs-5 mb-0">{formatINR(w.hourlyRate)}<span className="small fw-normal text-slate">/hr</span></p>
                      <p className="small text-slate mb-2">{w.stats.jobsCompleted} jobs on SIMSAR</p>
                      <Link to={`/profile/${w.user._id}`} className="btn btn-outline-dark btn-sm">View profile</Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api';
import { formatINR, priceBreakdown } from '../utils/format';
import Avatar from '../components/Avatar';
import Stars from '../components/Stars';
import VerifiedBadge from '../components/VerifiedBadge';
import ItiBadge from '../components/ItiBadge';

// Used only to illustrate what a contractor would keep on the same job.
// Labelled as illustrative on the page, as in the original static site.
const CONTRACTOR_CUT = 0.35;

function FairPayCalculator() {
  const { trades, platformFeePercent } = useConfig();
  const [tradeId, setTradeId] = useState(trades[0]?.slug || '');
  const [hours, setHours] = useState(3);

  // Trades and their minimum rates come from the database (GET /api/trades).
  const trade = trades.find((t) => t.slug === tradeId) || trades[0];
  if (!trade) return null;
  const job = trade.minHourlyRate * hours;
  const viaContractor = job * (1 - CONTRACTOR_CUT);
  const contractorKeeps = job - viaContractor;
  const simsar = priceBreakdown(job, platformFeePercent);
  const extra = simsar.workerPayout - viaContractor;
  const pct = (n) => `${(n / job) * 100}%`;

  return (
    <div className="ticket">
      <div className="ticket-top" />
      <div className="p-4">
        <h2 className="h3 fw-bold font-display mb-1">Where the money goes</h2>
        <p className="text-slate small mb-0">Pick a trade and job length to compare.</p>
        <div className="d-flex flex-wrap gap-2 mt-3">
          {trades.map((t) => (
            <button key={t.slug} type="button" className={`chip ${t.slug === trade.slug ? 'active' : ''}`} onClick={() => setTradeId(t.slug)}>
              <i className={`bi ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>
        <label htmlFor="calcHours" className="form-label small fw-semibold mt-4 mb-1">
          Job length: {hours} {hours === 1 ? 'hour' : 'hours'}
        </label>
        <input type="range" className="form-range" id="calcHours" min="1" max="8" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
      </div>
      <div className="ticket-cut" />
      <div className="p-4">
        <div className="mb-4">
          <p className="small fw-semibold mb-2">Booked through a contractor</p>
          <div className="split-bar">
            <div className="seg-worker" style={{ width: pct(viaContractor) }} />
            <div className="seg-hatch" style={{ width: pct(contractorKeeps) }} />
          </div>
          <div className="d-flex justify-content-between small mt-2">
            <span>Worker gets {formatINR(viaContractor)}</span>
            <span className="text-slate">Contractor keeps {formatINR(contractorKeeps)}</span>
          </div>
        </div>
        <div className="mb-4">
          <p className="small fw-semibold mb-2">Booked on SIMSAR</p>
          <div className="split-bar">
            <div className="seg-worker" style={{ width: pct(simsar.workerPayout) }} />
            <div className="seg-fee" style={{ width: pct(simsar.platformFee) }} />
          </div>
          <div className="d-flex justify-content-between small mt-2">
            <span>Worker gets {formatINR(simsar.workerPayout)}</span>
            <span className="text-slate">SIMSAR fee ({platformFeePercent}%) {formatINR(simsar.platformFee)}</span>
          </div>
        </div>
        <div className="rounded-3 p-3 d-flex align-items-center justify-content-between gap-3 bg-turmeric-soft">
          <p className="small fw-medium mb-0" style={{ maxWidth: 170 }}>More in the worker's pocket on this one job</p>
          <p className="font-display fw-bold mb-0 fs-2" aria-live="polite">{formatINR(extra)}</p>
        </div>
        <p className="small text-slate mt-3 mb-0">
          Illustrative figures. Assumes a 35% contractor cut on the fair minimum of {formatINR(trade.minHourlyRate)}/hr for a{' '}
          {trade.label.toLowerCase()}.
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const { trades, getTrade, platformFeePercent } = useConfig();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [heroTrade, setHeroTrade] = useState(trades[0]?.slug || '');
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    profileApi.workers({ verified: 'true', sort: 'rating' })
      .then((res) => setFeatured(res.workers.slice(0, 3)))
      .catch(() => setFeatured([]));
  }, []);

  // Support /#how-it-works links from the navbar and footer.
  useEffect(() => {
    if (location.hash) document.querySelector(location.hash)?.scrollIntoView({ behavior: 'smooth' });
  }, [location.hash]);

  const passportWorker = featured?.[0];

  return (
    <>
      {/* ===== Hero + fair-pay ticket ===== */}
      <section className="container py-5">
        <div className="row g-4 align-items-center">
          <div className="col-lg-6">
            <h1 className="display-4 fw-bold font-display" style={{ lineHeight: 1.02, letterSpacing: '-0.03em' }}>
              Skilled hands.<br />Fair pay.<br />Nothing hidden.
            </h1>
            <p className="lead text-slate mt-3" style={{ maxWidth: 480 }}>
              SIMSAR connects you directly with background-checked electricians, plumbers, tailors and other tradespeople.
              One fixed {platformFeePercent}% fee, shown on every job — the rest goes to the worker.
            </p>
            <form
              className="card-panel p-2 d-flex flex-column flex-sm-row gap-2 mt-4"
              style={{ maxWidth: 520 }}
              onSubmit={(e) => { e.preventDefault(); navigate(`/workers?trade=${heroTrade}`); }}
            >
              <label htmlFor="heroTrade" className="visually-hidden">What do you need done?</label>
              <select id="heroTrade" className="form-select border-0 flex-grow-1" value={heroTrade} onChange={(e) => setHeroTrade(e.target.value)}>
                {trades.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
              </select>
              <button type="submit" className="btn btn-primary text-nowrap"><i className="bi bi-search" /> Find workers</button>
            </form>
            {!user && (
              <p className="small text-slate mt-3 mb-0">
                Looking for work? <Link to="/jobs">Browse open jobs</Link> or <Link to="/register/worker">join as a worker</Link>.
              </p>
            )}
          </div>
          <div className="col-lg-6">
            <FairPayCalculator />
          </div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="how-it-works" className="bg-white border-top border-bottom border-line py-5">
        <div className="container">
          <h2 className="h1 fw-bold font-display">How SIMSAR works</h2>
          <div className="row g-4 mt-2">
            {[
              ['Post the job', `Say what needs doing, where, and your budget. You see the ${platformFeePercent}% fee and the worker's payout before you post. Budgets below the fair minimum are rejected.`],
              ['Pick a verified worker', 'Every worker passes a background check reviewed by the SIMSAR team. Compare ratings from past employers.'],
              ['Finish and rate each other', 'When the job is done, you rate the worker and the worker rates you. Both ratings are public.'],
            ].map(([title, text], i) => (
              <div className="col-md-4 d-flex gap-3" key={title}>
                <span className="font-display fw-bold" style={{ fontSize: '2.75rem', color: 'var(--turmeric)', lineHeight: 1 }}>{i + 1}</span>
                <div>
                  <h3 className="h5 fw-semibold">{title}</h3>
                  <p className="text-slate">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Trades ===== */}
      <section className="container py-5">
        <h2 className="h1 fw-bold font-display">Book by trade</h2>
        <p className="text-slate mt-1">Prices shown are the fair minimum hourly rate. Workers can charge more for experience.</p>
        <div className="row g-3 mt-2">
          {trades.map((t) => (
            <div className="col-6 col-md-4 col-lg-3" key={t.slug}>
              <Link to={`/workers?trade=${t.slug}`} className="card-panel p-3 d-block text-reset text-decoration-none h-100 job-card">
                <i className={`bi ${t.icon} fs-4`} style={{ color: 'var(--indigo)' }} />
                <p className="fw-semibold mb-0 mt-2">{t.plural}</p>
                <p className="small text-slate mb-0">from {formatINR(t.minHourlyRate)}/hr</p>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Featured workers ===== */}
      <section className="container pb-5">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
          <h2 className="h1 fw-bold font-display mb-0">Featured workers</h2>
          <Link to="/workers" className="link-underline-hover">Browse all workers →</Link>
        </div>
        <div className="row g-4 mt-1">
          {featured === null && <p className="text-slate">Loading…</p>}
          {featured?.length === 0 && <p className="text-slate">No verified workers yet.</p>}
          {featured?.map((w) => {
            const trade = getTrade(w.trade);
            return (
              <div className="col-md-4" key={w._id}>
                <Link to={`/profile/${w.user._id}`} className="card-panel p-4 d-block text-reset text-decoration-none h-100 job-card">
                  <div className="d-flex align-items-center gap-3">
                    <Avatar name={w.user.name} size={52} />
                    <div>
                      <p className="fw-semibold mb-0">{w.user.name}</p>
                      <p className="small text-slate mb-0">{trade?.label} · {w.location}</p>
                    </div>
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-3">
                    <Stars value={w.user.ratingAvg} count={w.user.ratingCount} />
                    <VerifiedBadge verified={w.verified} />
                  </div>
                  {w.itiCertificates?.length > 0 && <div className="mt-2"><ItiBadge certificates={w.itiCertificates} /></div>}
                  <p className="fw-semibold mt-2 mb-0">{formatINR(w.hourlyRate)}/hr</p>
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== Work Passport teaser (real numbers from the top worker) ===== */}
      <section className="bg-ink text-white py-5">
        <div className="container">
          <div className="row g-4 align-items-center">
            <div className="col-lg-6">
              <h2 className="display-6 fw-bold font-display" style={{ lineHeight: 1.05 }}>Your work history, in a record you own.</h2>
              <p className="mt-3" style={{ maxWidth: 440, color: '#C9CFE6', lineHeight: 1.6 }}>
                Every job finished on SIMSAR adds to a worker's Work Passport: completed jobs, ratings and earnings they can
                show a lender when applying for a tools loan.
              </p>
              <Link to="/register/worker" className="btn btn-warning mt-3">Join as a worker</Link>
            </div>
            <div className="col-lg-6">
              {passportWorker && (
                <div className="rounded-4 p-4" style={{ background: '#fff', color: 'var(--ink)', boxShadow: '0 30px 60px -30px rgba(0,0,0,.6)' }}>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="font-display fw-bold">Work Passport</span>
                    <span className="small text-slate">SIM-WP-{String(passportWorker.user._id).slice(-4).toUpperCase()}</span>
                  </div>
                  <div className="d-flex align-items-center gap-3 mt-3">
                    <Avatar name={passportWorker.user.name} size={56} />
                    <div>
                      <p className="fw-semibold mb-0">{passportWorker.user.name}</p>
                      <VerifiedBadge verified={passportWorker.verified} />
                    </div>
                  </div>
                  <div className="row text-center g-2 mt-3 pt-3 border-top border-line">
                    <div className="col-4"><p className="stat-value mb-0">{passportWorker.stats.jobsCompleted}</p><p className="small text-slate mb-0">completed jobs</p></div>
                    <div className="col-4"><p className="stat-value mb-0">{passportWorker.user.ratingAvg.toFixed(1)}</p><p className="small text-slate mb-0">avg. rating</p></div>
                    <div className="col-4"><p className="stat-value mb-0">{formatINR(passportWorker.stats.totalEarned)}</p><p className="small text-slate mb-0">earned on SIMSAR</p></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===== SDG teaser ===== */}
      <section className="container py-5 text-center">
        <span className="badge rounded-pill px-3 py-2" style={{ background: '#A21942' }}>SDG 8.5</span>
        <h2 className="h1 fw-bold font-display mt-3">Equal pay for work of equal value</h2>
        <p className="text-slate mx-auto mt-2" style={{ maxWidth: 560 }}>
          SIMSAR enforces a fair minimum rate for every trade as a validation rule, not a claim on an About page. A job whose
          worker payout falls below it simply can't be posted.
        </p>
      </section>

      {/* ===== Final CTA ===== */}
      {!user && (
        <section className="pb-5">
          <div className="container text-center">
            <h2 className="h1 fw-bold font-display">Ready to get started?</h2>
            <div className="d-flex flex-wrap justify-content-center gap-3 mt-3">
              <Link to="/register/employer" className="btn btn-primary btn-lg px-4">Hire a worker</Link>
              <Link to="/register/worker" className="btn btn-outline-dark btn-lg px-4">Become a worker</Link>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

import { Link, useParams } from 'react-router-dom';
import { profileApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import useAsync from '../utils/useAsync';
import { formatDate, formatINR } from '../utils/format';
import Avatar from '../components/Avatar';
import Stars from '../components/Stars';
import VerifiedBadge from '../components/VerifiedBadge';
import ItiBadge from '../components/ItiBadge';
import ReviewList from '../components/ReviewList';
import Loading from '../components/Loading';
import ErrorAlert from '../components/ErrorAlert';

function Stat({ value, label }) {
  return (
    <div className="col-6 col-sm-3">
      <p className="stat-value mb-0">{value}</p>
      <p className="small text-slate mb-0">{label}</p>
    </div>
  );
}

// Public profile for a worker or an employer, with average rating and
// recent reviews (two-way rating means employers have ratings too).
export default function PublicProfile() {
  const { id } = useParams();
  const { user: viewer } = useAuth();
  const { getTrade } = useConfig();
  const { data, loading, error, reload } = useAsync(() => profileApi.public(id), [id]);

  if (loading) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /></div>;

  const { user, profile, stats, reviews, itiCertificates = [] } = data;
  const isWorker = user.role === 'worker';
  const trade = isWorker ? getTrade(profile?.trade) : null;

  return (
    <div className="container py-4">
      <div className="row g-4 align-items-start">
        <div className="col-lg-8">
          <div className="d-flex align-items-start gap-3">
            <Avatar name={user.name} size={80} />
            <div>
              <h1 className="display-6 fw-bold font-display mb-1">{user.name}</h1>
              <p className="text-slate mb-2">
                {isWorker
                  ? `${trade?.label} · ${profile?.location} · ${profile?.experienceYears} years in trade`
                  : `${profile?.company || 'Employer'} · ${profile?.location}`}
              </p>
              <div className="d-flex flex-wrap gap-3 align-items-center">
                {isWorker && <VerifiedBadge verified={profile?.verified} showUnverified />}
                {isWorker && <ItiBadge certificates={itiCertificates} />}
                <Stars value={user.ratingAvg} count={user.ratingCount} />
                <span className="small text-slate">Member since {formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          {(profile?.bio || profile?.about) && (
            <section className="mt-4">
              <h2 className="h5 fw-semibold">About</h2>
              <p style={{ lineHeight: 1.6, maxWidth: 600 }}>{profile.bio || profile.about}</p>
              {profile.languages?.length > 0 && <p className="small text-slate">Speaks {profile.languages.join(', ')}</p>}
            </section>
          )}

          {isWorker && profile?.skills?.length > 0 && (
            <section className="mt-2">
              <h2 className="h5 fw-semibold">Skills</h2>
              <div className="d-flex flex-wrap gap-2 mt-2">
                {profile.skills.map((s) => <span key={s} className="chip">{s}</span>)}
              </div>
            </section>
          )}

          <section className="card-panel p-4 mt-4">
            {isWorker ? (
              <>
                <h2 className="h5 fw-semibold">Work Passport</h2>
                <p className="small text-slate">Every number here comes from completed SIMSAR jobs.</p>
                <div className="row text-center g-3 mt-1">
                  <Stat value={stats.jobsCompleted} label="jobs completed" />
                  <Stat value={user.ratingCount ? user.ratingAvg.toFixed(1) : '–'} label="avg. rating" />
                  <Stat value={stats.uniqueEmployers} label="employers served" />
                  <Stat value={formatINR(stats.totalEarned)} label="earned on SIMSAR" />
                </div>
              </>
            ) : (
              <>
                <h2 className="h5 fw-semibold">On SIMSAR</h2>
                <div className="row text-center g-3 mt-1">
                  <Stat value={stats.jobsPosted} label="jobs posted" />
                  <Stat value={stats.jobsCompleted} label="jobs completed" />
                  <Stat value={user.ratingCount ? user.ratingAvg.toFixed(1) : '–'} label="rating from workers" />
                  <Stat value={user.ratingCount} label="worker reviews" />
                </div>
              </>
            )}
          </section>

          {isWorker && (
            <section className="mt-4">
              <h2 className="h5 fw-semibold">Availability</h2>
              <p className="mb-1">
                {profile.isAvailable
                  ? <span className="text-leaf fw-semibold"><i className="bi bi-circle-fill small" /> Taking new jobs</span>
                  : <span className="text-brick fw-semibold"><i className="bi bi-circle small" /> Not taking new jobs right now</span>}
              </p>
              {profile.availableDays?.length > 0 && <p className="small text-slate">Usually works {profile.availableDays.join(', ')}</p>}
            </section>
          )}

          <section className="mt-4">
            <h2 className="h5 fw-semibold">Recent reviews</h2>
            <p className="small text-slate">{isWorker ? 'From employers this worker has done jobs for.' : 'From workers who completed jobs for this employer.'}</p>
            <ReviewList reviews={reviews} />
          </section>
        </div>

        {isWorker && (
          <div className="col-lg-4">
            <aside className="card-panel p-4">
              <p className="fw-bold fs-3 font-display mb-0">{formatINR(profile.hourlyRate)}<span className="fs-6 fw-normal text-slate">/hr</span></p>
              <p className="small text-slate">Set by the worker. The fair minimum for {trade?.plural.toLowerCase()} is {formatINR(trade?.minHourlyRate)}/hr.</p>
              {viewer?.role === 'employer' ? (
                <Link to={`/employer/jobs/new?category=${profile.trade}`} className="btn btn-primary w-100">Post a {trade?.label.toLowerCase()} job</Link>
              ) : !viewer ? (
                <Link to="/register/employer" className="btn btn-primary w-100">Sign up to hire</Link>
              ) : null}
              <p className="small text-slate mt-3 mb-0">
                <i className="bi bi-shield-check" /> {profile.verified ? 'This worker passed a SIMSAR background check.' : 'This worker has not completed a background check yet and cannot be hired.'}
              </p>
              {itiCertificates.map((c) => (
                <p key={c._id} className="small text-slate mt-2 mb-0">
                  <i className="bi bi-mortarboard" /> ITI certificate ({c.councilType}, {c.passingYear}) from {c.instituteName}, verified by
                  SIMSAR admin against the certificate.
                </p>
              ))}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

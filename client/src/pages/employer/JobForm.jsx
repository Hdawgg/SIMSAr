import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { jobsApi } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import { formatDate, formatINR, minimumBudget, priceBreakdown } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import PriceBreakdown from '../../components/PriceBreakdown';

const today = () => new Date().toISOString().slice(0, 10);

// Post a job (/employer/jobs/new) and edit a job (/employer/jobs/:id/edit).
// Ported from simsar-bootstrap/post-job.html: the wage floor is checked on
// every keystroke so the employer sees why a budget is rejected before submitting.
export default function JobForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { trades, getTrade, platformFeePercent } = useConfig();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    category: getTrade(searchParams.get('category'))?.active ? searchParams.get('category') : trades[0]?.slug,
    title: '', description: '', location: '', pincode: '', scheduledFor: '', estimatedHours: 2, budget: '', itiRequired: false,
  });
  const [feePercent, setFeePercent] = useState(platformFeePercent);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Edit mode: load the job. An edited job keeps the fee % it was posted with.
  useEffect(() => {
    if (!isEdit) return;
    jobsApi.get(id)
      .then(({ job }) => {
        if (job.employer._id !== user._id) throw new Error('This is not your job.');
        if (job.status !== 'open') throw new Error('Only open jobs can be edited.');
        setFeePercent(job.feePercent);
        setForm({
          category: job.category, title: job.title, description: job.description, location: job.location,
          pincode: job.pincode || '', scheduledFor: job.scheduledFor ? job.scheduledFor.slice(0, 10) : '',
          estimatedHours: job.estimatedHours, budget: job.budget, itiRequired: Boolean(job.itiRequired),
        });
      })
      .catch((err) => setLoadError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit, user._id]);

  if (loading) return <Loading />;
  if (loadError) return <div className="container py-5"><ErrorAlert message={loadError} /><Link to="/employer/dashboard">Back to dashboard</Link></div>;

  const trade = getTrade(form.category);
  if (!trade) {
    return <div className="container py-5"><ErrorAlert message="No trades are open for new jobs right now. Please try again later." /></div>;
  }
  // An edited job may belong to a trade the admin has since switched off; keep it selectable.
  const tradeOptions = trade.active ? trades : [trade, ...trades];
  const hours = Number(form.estimatedHours) || 0;
  const minBudget = minimumBudget(trade, hours, feePercent);
  const belowFloor = form.budget !== '' && Number(form.budget) < minBudget;
  // Editing a field clears its old error message.
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  function validateForm() {
    const e = {};
    if (form.title.trim().length < 5) e.title = 'Add a short title (at least 5 characters) so workers know what the job is.';
    if (form.description.trim().length < 15) e.description = 'Describe the job in at least 15 characters.';
    if (form.location.trim().length < 2) e.location = 'Enter where the job is.';
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) e.pincode = 'Enter a 6-digit pincode.';
    if (!isEdit && form.scheduledFor && form.scheduledFor < today()) e.scheduledFor = 'Pick today or a future date.';
    if (!hours || hours < 1 || hours > 200) e.estimatedHours = 'Enter 1–200 hours.';
    if (!form.budget) e.budget = 'Enter the total budget.';
    else if (belowFloor) e.budget = `Below the fair minimum. For ${hours} hr the budget must be at least ${formatINR(minBudget)}.`;
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const body = {
      category: form.category, title: form.title.trim(), description: form.description.trim(),
      location: form.location.trim(), pincode: form.pincode, scheduledFor: form.scheduledFor || undefined,
      estimatedHours: hours, budget: Number(form.budget), itiRequired: form.itiRequired,
    };
    setSubmitting(true);
    try {
      const { job } = isEdit ? await jobsApi.update(id, body) : await jobsApi.create(body);
      toast.success(isEdit ? 'Job updated.' : `Job posted. Verified ${trade.plural.toLowerCase()} can now apply.`);
      navigate(`/employer/jobs/${job._id}`);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const p = priceBreakdown(form.budget, feePercent);

  return (
    <div className="container py-5">
      <h1 className="display-6 fw-bold font-display">{isEdit ? 'Edit job' : 'Post a job'}</h1>
      <p className="text-slate mt-1">Verified workers see it and apply. You choose who to hire.</p>

      <div className="row g-4 mt-1 align-items-start">
        <div className="col-lg-8">
          <form className="card-panel p-4" onSubmit={handleSubmit} noValidate>
            <div className="mb-3">
              <label htmlFor="pjTrade" className="form-label fw-semibold">Trade</label>
              <select id="pjTrade" className="form-select" value={form.category} onChange={set('category')}>
                {tradeOptions.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
              </select>
              <div className="form-check mt-2">
                <input className="form-check-input" type="checkbox" id="pjIti" checked={form.itiRequired} onChange={(e) => setForm({ ...form, itiRequired: e.target.checked })} />
                <label className="form-check-label" htmlFor="pjIti">
                  ITI-certified workers only
                  <span className="d-block small text-slate">Only workers with an approved ITI certificate for {trade.label.toLowerCase()} work can apply. All workers still need a background check.</span>
                </label>
              </div>
            </div>
            <div className="mb-3">
              <label htmlFor="pjTitle" className="form-label fw-semibold">Job title</label>
              <input id="pjTitle" className={`form-control ${errors.title ? 'is-invalid' : ''}`} maxLength={100} placeholder="e.g. Kitchen sink is leaking" value={form.title} onChange={set('title')} />
              {errors.title && <div className="small text-brick mt-1">{errors.title}</div>}
            </div>
            <div className="mb-3">
              <label htmlFor="pjDetails" className="form-label fw-semibold">Details</label>
              <textarea id="pjDetails" className={`form-control ${errors.description ? 'is-invalid' : ''}`} rows="3" maxLength={2000} placeholder="What's wrong, what you've tried, anything the worker should bring" value={form.description} onChange={set('description')} />
              {errors.description && <div className="small text-brick mt-1">{errors.description}</div>}
            </div>
            <div className="row g-3">
              <div className="col-sm-5">
                <label htmlFor="pjLoc" className="form-label fw-semibold">Location</label>
                <input id="pjLoc" className={`form-control ${errors.location ? 'is-invalid' : ''}`} placeholder="e.g. Andheri West" value={form.location} onChange={set('location')} />
                {errors.location && <div className="small text-brick mt-1">{errors.location}</div>}
              </div>
              <div className="col-sm-3">
                <label htmlFor="pjPin" className="form-label fw-semibold">Pincode</label>
                <input id="pjPin" inputMode="numeric" maxLength={6} className={`form-control ${errors.pincode ? 'is-invalid' : ''}`} placeholder="400058" value={form.pincode} onChange={set('pincode')} />
                {errors.pincode && <div className="small text-brick mt-1">{errors.pincode}</div>}
              </div>
              <div className="col-sm-4">
                <label htmlFor="pjDate" className="form-label fw-semibold">Date</label>
                <input id="pjDate" type="date" min={isEdit ? undefined : today()} className={`form-control ${errors.scheduledFor ? 'is-invalid' : ''}`} value={form.scheduledFor} onChange={set('scheduledFor')} />
                {errors.scheduledFor && <div className="small text-brick mt-1">{errors.scheduledFor}</div>}
              </div>
            </div>
            <div className="row g-3 mt-0">
              <div className="col-sm-4">
                <label htmlFor="pjHours" className="form-label fw-semibold">Estimated hours</label>
                <input id="pjHours" type="number" min="1" max="200" className={`form-control ${errors.estimatedHours ? 'is-invalid' : ''}`} value={form.estimatedHours} onChange={set('estimatedHours')} />
                {errors.estimatedHours && <div className="small text-brick mt-1">{errors.estimatedHours}</div>}
              </div>
              <div className="col-sm-8">
                <label htmlFor="pjBudget" className="form-label fw-semibold">Total budget (₹)</label>
                <input id="pjBudget" type="number" min="1" className={`form-control ${belowFloor || errors.budget ? 'is-invalid' : ''}`} placeholder={minBudget ? `at least ${minBudget}` : ''} value={form.budget} onChange={set('budget')} />
              </div>
            </div>
            <p className={`small mt-2 mb-0 ${belowFloor || errors.budget ? 'text-brick' : 'text-slate'}`} aria-live="polite">
              {errors.budget || (belowFloor
                ? `This is below SIMSAR's fair minimum of ${formatINR(trade.minHourlyRate)}/hr for ${trade.plural.toLowerCase()}. After the ${feePercent}% fee, ${hours} hr needs a budget of at least ${formatINR(minBudget)}. Jobs below it can't be posted.`
                : `The fair minimum for ${trade.plural.toLowerCase()} is ${formatINR(trade.minHourlyRate)}/hr, so for ${hours || '?'} hr the budget must be at least ${formatINR(minBudget)}.`)}
            </p>
            <div className="d-flex gap-2 mt-4">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting && <span className="spinner-border spinner-border-sm me-1" />}{isEdit ? 'Save changes' : 'Post job'}
              </button>
              <Link to={isEdit ? `/employer/jobs/${id}` : '/employer/dashboard'} className="btn btn-outline-dark">Cancel</Link>
            </div>
          </form>
        </div>

        <div className="col-lg-4">
          <p className="small fw-medium text-slate mb-2">What workers will see</p>
          <div className="ticket">
            <div className="ticket-top" />
            <div className="p-4">
              <p className="small text-slate mb-1"><i className={`bi ${trade.icon}`} /> {trade.label} needed</p>
              <h3 className="h4 fw-bold font-display mt-1">{form.title.trim() || 'Your job title'}</h3>
              {form.itiRequired && <span className="badge-iti small"><i className="bi bi-mortarboard-fill" /> ITI-certified workers only</span>}
              <p className="small mt-2 mb-0">{form.description.trim() || 'Your job details will appear here.'}</p>
            </div>
            <div className="ticket-cut" />
            <div className="p-4 small">
              <p className="text-slate mb-1"><i className="bi bi-geo-alt" /> {form.location.trim() || 'Location'}{form.pincode && ` · ${form.pincode}`}</p>
              <p className="text-slate mb-3"><i className="bi bi-clock" /> {form.scheduledFor ? formatDate(form.scheduledFor) : 'Date'}, about {hours || 1} hr</p>
              <PriceBreakdown budget={form.budget} feePercent={feePercent} hours={p.budget ? hours : 0} />
            </div>
          </div>
          <p className="small text-slate mt-3">
            SIMSAR's fee is a fixed {feePercent}% of the budget, locked in when you post. There are no other charges.
          </p>
        </div>
      </div>
    </div>
  );
}

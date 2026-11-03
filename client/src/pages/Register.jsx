import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth, DASHBOARD_PATH } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useToast } from '../context/ToastContext';
import { errorMessage, fieldErrors } from '../api/client';
import { formatINR } from '../utils/format';
import NotFound from './NotFound';

// Same rules the server checks (server/src/validators/index.js).
function validateForm(f, role, trade) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email.';
  if (!/^[6-9]\d{9}$/.test(f.phone.trim())) e.phone = 'Enter a 10-digit mobile number.';
  if (f.password.length < 8 || !/[A-Za-z]/.test(f.password) || !/\d/.test(f.password)) {
    e.password = 'At least 8 characters, with a letter and a number.';
  }
  if (f.confirm !== f.password) e.confirm = 'Passwords do not match.';
  if (f.location.trim().length < 2) e.location = 'Enter your area or city.';
  if (role === 'worker') {
    if (!f.hourlyRate) e.hourlyRate = 'Enter your hourly rate.';
    else if (Number(f.hourlyRate) < trade.minHourlyRate) e.hourlyRate = `The fair minimum for ${trade.plural.toLowerCase()} is ${formatINR(trade.minHourlyRate)}/hr.`;
    if (f.experienceYears !== '' && (f.experienceYears < 0 || f.experienceYears > 60)) e.experienceYears = 'Enter 0–60 years.';
  }
  return e;
}

export default function Register() {
  const { role } = useParams();
  const { user, register } = useAuth();
  const { trades, getTrade } = useConfig();
  const toast = useToast();

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirm: '', location: '',
    trade: trades[0]?.slug, hourlyRate: '', experienceYears: '', skills: '', company: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!['worker', 'employer'].includes(role)) return <NotFound />;
  // After sign-up, new workers go straight to the background check.
  if (user) return <Navigate to={user.role === 'worker' ? '/worker/verification' : DASHBOARD_PATH[user.role]} replace />;

  const trade = getTrade(form.trade);
  if (role === 'worker' && !trade) {
    return <div className="container py-5"><div className="alert alert-warning">No trades are open for new workers right now. Please check back later.</div></div>;
  }
  // Editing a field clears its old error message.
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm(form, role, trade);
    setErrors(errs);
    setServerError('');
    if (Object.keys(errs).length) return;

    const body = {
      role,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      location: form.location.trim(),
    };
    if (role === 'worker') {
      Object.assign(body, {
        trade: form.trade,
        hourlyRate: Number(form.hourlyRate),
        experienceYears: form.experienceYears === '' ? 0 : Number(form.experienceYears),
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
      });
    } else {
      body.company = form.company.trim();
    }

    setSubmitting(true);
    try {
      await register(body);
      toast.success('Account created. Welcome to SIMSAR!');
    } catch (err) {
      setErrors(fieldErrors(err));
      setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const field = (key, label, props = {}) => (
    <div className="mb-3">
      <label htmlFor={`reg-${key}`} className="form-label fw-semibold">{label}</label>
      <input id={`reg-${key}`} className={`form-control ${errors[key] ? 'is-invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <div className="small text-brick mt-1">{errors[key]}</div>}
    </div>
  );

  return (
    <div className="container py-5">
      <div className="mx-auto card-panel p-4 p-md-5" style={{ maxWidth: 580 }}>
        <h1 className="h2 fw-bold font-display">{role === 'worker' ? 'Join as a worker' : 'Create an employer account'}</h1>
        <p className="text-slate small">
          {role === 'worker'
            ? 'After signing up you will submit a background check. Once an admin approves it you can apply for jobs.'
            : 'Post jobs, choose from verified workers, and rate them when the work is done.'}
        </p>
        {serverError && <div className="alert alert-danger small py-2" role="alert">{serverError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          {field('name', 'Full name', { placeholder: 'Your name', autoComplete: 'name' })}
          <div className="row g-3">
            <div className="col-sm-6">{field('email', 'Email', { type: 'email', placeholder: 'you@example.com', autoComplete: 'email' })}</div>
            <div className="col-sm-6">{field('phone', 'Mobile number', { inputMode: 'numeric', maxLength: 10, placeholder: '98XXXXXXXX', autoComplete: 'tel' })}</div>
          </div>
          <div className="row g-3">
            <div className="col-sm-6">{field('password', 'Password', { type: 'password', placeholder: 'At least 8 characters', autoComplete: 'new-password' })}</div>
            <div className="col-sm-6">{field('confirm', 'Confirm password', { type: 'password', placeholder: 'Re-enter password', autoComplete: 'new-password' })}</div>
          </div>
          {role === 'employer' && field('company', 'Company or organisation (optional)', { placeholder: 'Leave blank if hiring for your home' })}
          {field('location', role === 'worker' ? 'Service area' : 'Location', { placeholder: 'e.g. Andheri West' })}

          {role === 'worker' && (
            <div className="mt-4 pt-4" style={{ borderTop: '1px dashed var(--line)' }}>
              <p className="fw-semibold small mb-3">Worker details</p>
              <div className="mb-3">
                <label htmlFor="reg-trade" className="form-label fw-semibold">Trade</label>
                <select id="reg-trade" className="form-select" value={form.trade} onChange={set('trade')}>
                  {trades.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
                </select>
              </div>
              <div className="row g-3">
                <div className="col-sm-6">{field('hourlyRate', 'Hourly rate (₹)', { type: 'number', min: trade.minHourlyRate, placeholder: `at least ${trade.minHourlyRate}` })}</div>
                <div className="col-sm-6">{field('experienceYears', 'Experience (years)', { type: 'number', min: 0, max: 60, placeholder: 'e.g. 5' })}</div>
              </div>
              {!errors.hourlyRate && (
                <p className="small text-slate">The fair minimum for {trade.plural.toLowerCase()} is {formatINR(trade.minHourlyRate)}/hr. You can charge more.</p>
              )}
              {field('skills', 'Skills (comma separated, optional)', { placeholder: 'e.g. House wiring, Fan installation' })}
            </div>
          )}

          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={submitting}>
            {submitting && <span className="spinner-border spinner-border-sm me-1" />}Create account
          </button>
        </form>
        <p className="small text-center mt-4 mb-0">Already have an account? <Link to={`/login/${role}`}>Log in</Link></p>
      </div>
    </div>
  );
}

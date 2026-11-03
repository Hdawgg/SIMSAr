import { useEffect, useState } from 'react';
import { profileApi } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatINR } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import VerifiedBadge from '../../components/VerifiedBadge';

const list = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

export default function WorkerProfileEdit() {
  const { setUser } = useAuth();
  const { trades, weekdays, getTrade } = useConfig();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => profileApi.mine(), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Copy the loaded profile into editable form state once it arrives.
  useEffect(() => {
    if (!data) return;
    const { user, profile } = data;
    setForm({
      name: user.name, phone: user.phone || '',
      trade: profile.trade, hourlyRate: profile.hourlyRate, experienceYears: profile.experienceYears,
      location: profile.location, pincode: profile.pincode || '', bio: profile.bio || '',
      skills: (profile.skills || []).join(', '), languages: (profile.languages || []).join(', '),
      isAvailable: profile.isAvailable, availableDays: profile.availableDays || [],
    });
  }, [data]);

  if (loading || (!form && !error)) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /></div>;

  const trade = getTrade(form.trade);
  const rateChanged = form.trade !== data.profile.trade || Number(form.hourlyRate) !== data.profile.hourlyRate;
  // Editing a field clears its old error message.
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };
  const toggleDay = (day) => setForm({
    ...form,
    availableDays: form.availableDays.includes(day) ? form.availableDays.filter((d) => d !== day) : weekdays.filter((d) => d === day || form.availableDays.includes(d)),
  });

  function validateForm() {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!/^[6-9]\d{9}$/.test(form.phone)) e.phone = 'Enter a 10-digit mobile number.';
    // Same rule as the server: the minimum is checked when the trade or the rate changes.
    if (!form.hourlyRate || (rateChanged && Number(form.hourlyRate) < trade.minHourlyRate)) e.hourlyRate = `At least ${formatINR(trade.minHourlyRate)}/hr for ${trade.plural.toLowerCase()} (fair minimum).`;
    if (form.experienceYears === '' || form.experienceYears < 0 || form.experienceYears > 60) e.experienceYears = 'Enter 0–60 years.';
    if (form.location.trim().length < 2) e.location = 'Enter your service area.';
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) e.pincode = 'Pincode must be 6 digits.';
    if (list(form.skills).length > 15) e.skills = 'At most 15 skills.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await profileApi.update({
        name: form.name.trim(), phone: form.phone.trim(), trade: form.trade,
        hourlyRate: Number(form.hourlyRate), experienceYears: Number(form.experienceYears),
        location: form.location.trim(), pincode: form.pincode, bio: form.bio.trim(),
        skills: list(form.skills), languages: list(form.languages),
        isAvailable: form.isAvailable, availableDays: form.availableDays,
      });
      setUser(res.user);
      toast.success('Profile saved.');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const field = (key, label, props = {}) => (
    <>
      <label htmlFor={`wp-${key}`} className="form-label fw-semibold">{label}</label>
      <input id={`wp-${key}`} className={`form-control ${errors[key] ? 'is-invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <div className="small text-brick mt-1">{errors[key]}</div>}
    </>
  );

  return (
    <div className="container py-5">
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2">
          <h1 className="display-6 fw-bold font-display mb-0">My worker profile</h1>
          <VerifiedBadge verified={data.profile.verified} showUnverified />
        </div>
        <p className="text-slate">This is what employers see on your public profile.</p>

        <form className="card-panel p-4" onSubmit={handleSubmit} noValidate>
          <div className="row g-3">
            <div className="col-sm-6">{field('name', 'Full name')}</div>
            <div className="col-sm-6">{field('phone', 'Mobile number', { inputMode: 'numeric', maxLength: 10 })}</div>
            <div className="col-sm-6">
              <label htmlFor="wp-trade" className="form-label fw-semibold">Trade</label>
              <select id="wp-trade" className="form-select" value={form.trade} onChange={set('trade')}>
                {/* Keep the worker's own trade selectable even if the admin has switched it off. */}
                {(trade.active || form.trade !== data.profile.trade ? trades : [getTrade(data.profile.trade), ...trades])
                  .map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
              </select>
            </div>
            <div className="col-sm-3">{field('hourlyRate', 'Rate (₹/hr)', { type: 'number', min: trade.minHourlyRate })}</div>
            <div className="col-sm-3">{field('experienceYears', 'Experience (yrs)', { type: 'number', min: 0, max: 60 })}</div>
            <div className="col-12">
              <p className="small text-slate mb-0">Fair minimum for {trade.plural.toLowerCase()}: {formatINR(trade.minHourlyRate)}/hr.</p>
              {!rateChanged && data.profile.hourlyRate < trade.minHourlyRate && (
                <p className="small text-brick mb-0">
                  The fair minimum was raised after you set your rate. Your current {formatINR(data.profile.hourlyRate)}/hr stays until you change it;
                  any new rate must be at least {formatINR(trade.minHourlyRate)}/hr.
                </p>
              )}
            </div>
            <div className="col-sm-8">{field('location', 'Service area')}</div>
            <div className="col-sm-4">{field('pincode', 'Pincode', { inputMode: 'numeric', maxLength: 6 })}</div>
            <div className="col-12">
              <label htmlFor="wp-bio" className="form-label fw-semibold">About you</label>
              <textarea id="wp-bio" className="form-control" rows="3" maxLength={600} value={form.bio} onChange={set('bio')} placeholder="What kind of work do you do? What do you bring?" />
            </div>
            <div className="col-12">{field('skills', 'Skills (comma separated)', { placeholder: 'e.g. House wiring, MCB repair' })}</div>
            <div className="col-12">{field('languages', 'Languages (comma separated)', { placeholder: 'e.g. Hindi, Marathi' })}</div>
            <div className="col-12">
              <p className="form-label fw-semibold mb-2">Days you usually work</p>
              <div className="d-flex flex-wrap gap-2">
                {weekdays.map((d) => (
                  <button key={d} type="button" className={`chip ${form.availableDays.includes(d) ? 'active' : ''}`} aria-pressed={form.availableDays.includes(d)} onClick={() => toggleDay(d)}>{d}</button>
                ))}
              </div>
            </div>
            <div className="col-12">
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="wp-available" checked={form.isAvailable} onChange={(e) => setForm({ ...form, isAvailable: e.target.checked })} />
                <label className="form-check-label" htmlFor="wp-available">Taking new jobs</label>
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
            {saving && <span className="spinner-border spinner-border-sm me-1" />}Save profile
          </button>
        </form>
      </div>
    </div>
  );
}

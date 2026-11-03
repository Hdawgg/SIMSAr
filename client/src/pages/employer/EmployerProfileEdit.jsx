import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profileApi } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';

export default function EmployerProfileEdit() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => profileApi.mine(), []);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.user.name, phone: data.user.phone || '',
      company: data.profile.company || '', location: data.profile.location,
      pincode: data.profile.pincode || '', about: data.profile.about || '',
    });
  }, [data]);

  if (loading || (!form && !error)) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /></div>;

  // Editing a field clears its old error message.
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your full name.';
    if (!/^[6-9]\d{9}$/.test(form.phone)) errs.phone = 'Enter a 10-digit mobile number.';
    if (form.location.trim().length < 2) errs.location = 'Enter your location.';
    if (form.pincode && !/^\d{6}$/.test(form.pincode)) errs.pincode = 'Pincode must be 6 digits.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const res = await profileApi.update({
        name: form.name.trim(), phone: form.phone.trim(), company: form.company.trim(),
        location: form.location.trim(), pincode: form.pincode, about: form.about.trim(),
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
      <label htmlFor={`ep-${key}`} className="form-label fw-semibold">{label}</label>
      <input id={`ep-${key}`} className={`form-control ${errors[key] ? 'is-invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <div className="small text-brick mt-1">{errors[key]}</div>}
    </>
  );

  return (
    <div className="container py-5">
      <div className="mx-auto" style={{ maxWidth: 680 }}>
        <h1 className="display-6 fw-bold font-display">My employer profile</h1>
        <p className="text-slate">Workers see this before applying. <Link to={`/profile/${user._id}`}>View public profile</Link></p>
        <form className="card-panel p-4" onSubmit={handleSubmit} noValidate>
          <div className="row g-3">
            <div className="col-sm-6">{field('name', 'Full name')}</div>
            <div className="col-sm-6">{field('phone', 'Mobile number', { inputMode: 'numeric', maxLength: 10 })}</div>
            <div className="col-12">{field('company', 'Company or organisation (optional)', { placeholder: 'Leave blank if hiring for your home' })}</div>
            <div className="col-sm-8">{field('location', 'Location')}</div>
            <div className="col-sm-4">{field('pincode', 'Pincode', { inputMode: 'numeric', maxLength: 6 })}</div>
            <div className="col-12">
              <label htmlFor="ep-about" className="form-label fw-semibold">About</label>
              <textarea id="ep-about" className="form-control" rows="3" maxLength={600} value={form.about} onChange={set('about')} placeholder="What kind of work do you usually hire for?" />
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

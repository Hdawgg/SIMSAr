import { useState } from 'react';
import { Link } from 'react-router-dom';
import { checksApi, itiApi, profileApi } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatDate } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';
import StatusPill from '../../components/StatusPill';
import ItiSection from './ItiSection';

// Same patterns as server/src/models/BackgroundCheck.js
const ID_TYPES = {
  aadhaar: { label: 'Aadhaar', pattern: /^\d{12}$/, hint: '12 digits, e.g. 123456789012' },
  pan: { label: 'PAN card', pattern: /^[A-Z]{5}\d{4}[A-Z]$/, hint: 'e.g. ABCDE1234F' },
  'voter-id': { label: 'Voter ID', pattern: /^[A-Z]{3}\d{7}$/, hint: 'e.g. ABC1234567' },
  'driving-licence': { label: 'Driving licence', pattern: /^[A-Z]{2}\d{2}\s?\d{11}$/, hint: 'e.g. MH01 20110012345' },
  passport: { label: 'Passport', pattern: /^[A-Z]\d{7}$/, hint: 'e.g. A1234567' },
};

const EMPTY = { idType: 'aadhaar', idNumber: '', fullNameOnId: '', dateOfBirth: '', line1: '', city: '', state: 'Maharashtra', pincode: '', consent: false };

function maskId(id) {
  return id.length > 4 ? '•'.repeat(id.length - 4) + id.slice(-4) : id;
}

export default function Verification() {
  const toast = useToast();
  // Two separate credentials on one page: the background check (required to
  // apply for any job) and ITI certificates (optional, extra).
  const { data, loading, error, reload } = useAsync(
    () => Promise.all([checksApi.mine(), itiApi.mine(), profileApi.mine()]).then(([bc, iti, me]) => ({
      backgroundChecks: bc.backgroundChecks,
      itiCertificates: iti.itiCertificates,
      trade: me.profile?.trade,
    })),
    []
  );
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Loading />;
  if (error) return <div className="container py-5"><ErrorAlert message={error} onRetry={reload} /></div>;

  const checks = data.backgroundChecks;
  const latest = checks[0];
  const canSubmit = !latest || latest.status === 'rejected';
  // Editing a field clears its old error message.
  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  function validateForm() {
    const e = {};
    const id = form.idNumber.trim().toUpperCase();
    if (!ID_TYPES[form.idType].pattern.test(id)) e.idNumber = `Format: ${ID_TYPES[form.idType].hint}`;
    if (form.fullNameOnId.trim().length < 2) e.fullNameOnId = 'Enter your name as printed on the ID.';
    if (!form.dateOfBirth) e.dateOfBirth = 'Enter your date of birth.';
    else {
      const adult = new Date();
      adult.setFullYear(adult.getFullYear() - 18);
      if (new Date(form.dateOfBirth) > adult) e.dateOfBirth = 'You must be at least 18.';
    }
    if (form.line1.trim().length < 5) e.line1 = 'Enter your street address.';
    if (form.city.trim().length < 2) e.city = 'Enter your city.';
    if (form.state.trim().length < 2) e.state = 'Enter your state.';
    if (!/^\d{6}$/.test(form.pincode)) e.pincode = 'Pincode must be 6 digits.';
    if (!form.consent) e.consent = 'You must agree to the background check.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await checksApi.submit({
        idType: form.idType,
        idNumber: form.idNumber.trim().toUpperCase(),
        fullNameOnId: form.fullNameOnId.trim(),
        dateOfBirth: form.dateOfBirth,
        address: { line1: form.line1.trim(), city: form.city.trim(), state: form.state.trim(), pincode: form.pincode },
        consent: true,
      });
      toast.success('Background check submitted. An admin will review it soon.');
      setForm(EMPTY);
      reload();
    } catch (err) {
      const f = fieldErrors(err);
      // Server sends nested address fields as "address.city" etc.; map them back.
      setErrors(Object.fromEntries(Object.entries(f).map(([k, v]) => [k.replace('address.', ''), v])));
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const input = (key, label, props = {}) => (
    <>
      <label htmlFor={`bc-${key}`} className="form-label fw-semibold">{label}</label>
      <input id={`bc-${key}`} className={`form-control ${errors[key] ? 'is-invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <div className="small text-brick mt-1">{errors[key]}</div>}
    </>
  );

  return (
    <div className="container py-5">
      <div className="mx-auto" style={{ maxWidth: 760 }}>
        <h1 className="display-6 fw-bold font-display">Verification</h1>
        <p className="text-slate">
          SIMSAR has two separate credentials. The <strong>background check</strong> is required before you can apply for
          any job and gives you the <strong>Verified</strong> badge. An <strong>ITI certificate</strong> is optional and gives
          you the <strong>ITI Certified</strong> badge. Both are simulated checks for this project: a SIMSAR admin reviews them
          by hand and no third-party or government service is contacted.
        </p>

        <div className="d-flex flex-wrap align-items-center gap-2 mt-4">
          <h2 className="h3 fw-bold font-display mb-0">1. Background check</h2>
          <span className="badge rounded-pill text-bg-light border">required to apply for jobs</span>
        </div>
        <p className="text-slate mt-2">Submit your ID and address; a SIMSAR admin checks them by hand.</p>

        {latest && (
          <div className={`card-panel p-4 mb-4 ${latest.status === 'approved' ? 'bg-leaf-soft' : ''}`}>
            <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
              <h3 className="h5 fw-semibold mb-0">Current status</h3>
              <StatusPill status={latest.status} />
            </div>
            <p className="small text-slate mt-2 mb-1">
              {ID_TYPES[latest.idType]?.label} {maskId(latest.idNumber)} · submitted {formatDate(latest.createdAt)}
              {latest.reviewedAt && ` · reviewed ${formatDate(latest.reviewedAt)}`}
            </p>
            {latest.status === 'pending' && <p className="mb-0">Your details are with the admin team. You will be able to apply for jobs as soon as they approve.</p>}
            {latest.status === 'approved' && (
              <p className="mb-0"><i className="bi bi-patch-check-fill text-leaf" /> You are verified. The Verified badge now shows on your profile. <Link to="/jobs">Find jobs</Link></p>
            )}
            {latest.status === 'rejected' && <p className="mb-0 text-brick">Not approved. Reviewer's note: “{latest.reviewerNotes}”. Please correct the details and submit again below.</p>}
          </div>
        )}

        {canSubmit && (
          <form className="card-panel p-4" onSubmit={handleSubmit} noValidate>
            <h3 className="h5 fw-semibold">{latest ? 'Submit again' : 'Your details'}</h3>
            <div className="row g-3 mt-1">
              <div className="col-sm-5">
                <label htmlFor="bc-idType" className="form-label fw-semibold">ID document</label>
                <select id="bc-idType" className="form-select" value={form.idType} onChange={set('idType')}>
                  {Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div className="col-sm-7">{input('idNumber', 'ID number', { placeholder: ID_TYPES[form.idType].hint, autoComplete: 'off' })}</div>
              <div className="col-sm-7">{input('fullNameOnId', 'Name as on the ID')}</div>
              <div className="col-sm-5">{input('dateOfBirth', 'Date of birth', { type: 'date' })}</div>
              <div className="col-12">{input('line1', 'Address', { placeholder: 'House / building, street' })}</div>
              <div className="col-sm-5">{input('city', 'City')}</div>
              <div className="col-sm-4">{input('state', 'State')}</div>
              <div className="col-sm-3">{input('pincode', 'Pincode', { inputMode: 'numeric', maxLength: 6 })}</div>
              <div className="col-12">
                <div className="form-check">
                  <input className={`form-check-input ${errors.consent ? 'is-invalid' : ''}`} type="checkbox" id="bc-consent" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} />
                  <label className="form-check-label small" htmlFor="bc-consent">
                    I confirm these details are true and I agree to SIMSAR verifying my identity and address.
                  </label>
                </div>
                {errors.consent && <div className="small text-brick mt-1">{errors.consent}</div>}
              </div>
            </div>
            <button type="submit" className="btn btn-primary mt-4" disabled={submitting}>
              {submitting && <span className="spinner-border spinner-border-sm me-1" />}Submit for review
            </button>
          </form>
        )}

        {checks.length > 1 && (
          <section className="mt-4">
            <h3 className="h6 fw-semibold text-slate">Background check history</h3>
            <ul className="list-group">
              {checks.slice(1).map((c) => (
                <li key={c._id} className="list-group-item d-flex justify-content-between small">
                  <span>{ID_TYPES[c.idType]?.label} · {formatDate(c.createdAt)}{c.reviewerNotes && ` — “${c.reviewerNotes}”`}</span>
                  <StatusPill status={c.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {data.trade && <ItiSection certificates={data.itiCertificates} workerTrade={data.trade} onChange={reload} />}
      </div>
    </div>
  );
}

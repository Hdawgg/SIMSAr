import { useState } from 'react';
import { Link } from 'react-router-dom';
import { itiApi } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import { formatBytes, formatDate } from '../../utils/format';
import StatusPill from '../../components/StatusPill';
import ItiBadge from '../../components/ItiBadge';
import CertificateViewer from '../../components/CertificateViewer';

const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const thisYear = new Date().getFullYear();
// Same rule as the server: upper case, without spaces, slashes or hyphens.
const normalise = (v) => v.toUpperCase().replace(/[\s/-]/g, '');

const emptyForm = (trade) => ({
  trade, councilType: 'NCVT', certificateNumber: '', registrationNumber: '', instituteName: '',
  instituteState: 'Maharashtra', instituteDistrict: '', passingYear: '', grade: '', percentage: '',
});

function maskNumber(n) {
  return n.length > 4 ? '•'.repeat(n.length - 4) + n.slice(-4) : n;
}

// ITI certificate: an optional, extra credential next to the background check.
// The worker uploads a scan; a SIMSAR admin compares it with the details by hand.
export default function ItiSection({ certificates, workerTrade, onChange }) {
  const { getTrade, councilTypes, certificateMaxBytes } = useConfig();
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(workerTrade));
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0); // remounts the file input to clear it
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [viewing, setViewing] = useState(null);

  const trade = getTrade(workerTrade);
  const forMyTrade = certificates.filter((c) => c.trade === workerTrade);
  const active = forMyTrade.find((c) => c.status !== 'rejected');
  const approved = certificates.filter((c) => c.status === 'approved');

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  // "Fix and re-submit": start from the rejected certificate's details.
  function resubmitFrom(cert) {
    setForm({
      ...emptyForm(workerTrade),
      ...Object.fromEntries(Object.keys(emptyForm(workerTrade)).filter((k) => cert[k] != null).map((k) => [k, String(cert[k])])),
      trade: workerTrade,
    });
    setFile(null);
    setFileKey((k) => k + 1);
    setErrors({});
    document.getElementById('iti-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  function validateForm() {
    const e = {};
    if (!/^(?=.*\d)[A-Z0-9]{8,20}$/.test(normalise(form.certificateNumber))) e.certificateNumber = '8–20 letters and digits, with at least one digit (spaces and slashes are ignored).';
    if (form.registrationNumber && !/^[A-Z0-9]{6,20}$/.test(normalise(form.registrationNumber))) e.registrationNumber = '6–20 letters and digits.';
    if (form.instituteName.trim().length < 3) e.instituteName = 'Enter the name of your ITI.';
    if (form.instituteState.trim().length < 2) e.instituteState = 'Enter the state.';
    if (form.instituteDistrict.trim().length < 2) e.instituteDistrict = 'Enter the district.';
    const year = Number(form.passingYear);
    if (!Number.isInteger(year) || year < 1960 || year > thisYear) e.passingYear = `Enter a year between 1960 and ${thisYear}.`;
    if (form.percentage !== '' && (Number(form.percentage) < 0 || Number(form.percentage) > 100)) e.percentage = 'Enter 0–100.';
    if (!file) e.certificateFile = 'Upload a photo or PDF of the certificate.';
    else if (!FILE_TYPES.includes(file.type)) e.certificateFile = 'Only JPG, PNG or PDF files.';
    else if (file.size > certificateMaxBytes) e.certificateFile = `The file is ${formatBytes(file.size)}; the limit is ${formatBytes(certificateMaxBytes)}.`;
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length) return;

    // multipart/form-data, because a file is included.
    const body = new FormData();
    for (const [key, value] of Object.entries(form)) if (String(value).trim() !== '') body.append(key, String(value).trim());
    body.append('certificateFile', file);

    setSubmitting(true);
    try {
      await itiApi.submit(body);
      toast.success('ITI certificate submitted. An admin will compare it with your scan.');
      setForm(emptyForm(workerTrade));
      setFile(null);
      setFileKey((k) => k + 1);
      onChange();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const input = (key, label, props = {}) => (
    <>
      <label htmlFor={`iti-${key}`} className="form-label fw-semibold">{label}</label>
      <input id={`iti-${key}`} className={`form-control ${errors[key] ? 'is-invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <div className="small text-brick mt-1">{errors[key]}</div>}
    </>
  );

  return (
    <section className="mt-5" aria-labelledby="iti-heading">
      <div className="d-flex flex-wrap align-items-center gap-2">
        <h2 id="iti-heading" className="h3 fw-bold font-display mb-0">2. ITI certificate</h2>
        <span className="badge rounded-pill text-bg-light border">optional · extra credential</span>
      </div>
      <p className="text-slate mt-2">
        If you trained at an Industrial Training Institute, add your NCVT or SCVT certificate. Approved certificates show an{' '}
        <strong>ITI Certified</strong> badge on your profile, and let you apply for jobs that ask for ITI-certified workers.
        A SIMSAR admin compares the details with your scan by hand; SIMSAR does not connect to any government database.
      </p>
      {approved.length > 0 && <div className="d-flex flex-wrap gap-2 mb-3"><ItiBadge certificates={approved} /></div>}

      {certificates.length > 0 && (
        <ul className="list-group mb-4">
          {certificates.map((c) => (
            <li key={c._id} className="list-group-item p-3">
              <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center">
                <div>
                  <span className="fw-semibold">{getTrade(c.trade)?.label || c.trade}</span>
                  <span className="text-slate small"> · {c.councilType} · No. {maskNumber(c.certificateNumber)} · {c.instituteName}, {c.passingYear}</span>
                </div>
                <StatusPill status={c.status} />
              </div>
              <p className="small text-slate mb-0 mt-1">
                Submitted {formatDate(c.createdAt)}{c.reviewedAt && ` · reviewed ${formatDate(c.reviewedAt)}`}
                {' · '}<button type="button" className="btn btn-link btn-sm p-0 align-baseline" onClick={() => setViewing(c)}>view scan</button>
              </p>
              {c.status === 'pending' && <p className="small mb-0 mt-1">An admin will review it soon.</p>}
              {c.status === 'approved' && <p className="small mb-0 mt-1 text-leaf"><i className="bi bi-mortarboard-fill" /> Approved — verified by SIMSAR admin against the certificate.</p>}
              {c.status === 'rejected' && (
                <div className="small mt-1">
                  <span className="text-brick">Not approved: “{c.reviewerNote}”</span>
                  {!active && c.trade === workerTrade && (
                    <button type="button" className="btn btn-sm btn-outline-dark ms-2" onClick={() => resubmitFrom(c)}>Fix and re-submit</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {active ? (
        <p className="small text-slate">
          You have an ITI certificate for {trade?.label} that is {active.status}. To add a certificate for another trade, first{' '}
          <Link to="/worker/profile">change your trade</Link>.
        </p>
      ) : (
        <form id="iti-form" className="card-panel p-4" onSubmit={handleSubmit} noValidate>
          <h3 className="h5 fw-semibold">{forMyTrade.length ? 'Submit again' : 'Add your ITI certificate'}</h3>
          <div className="row g-3 mt-1">
            <div className="col-sm-6">
              <label htmlFor="iti-trade" className="form-label fw-semibold">Trade</label>
              <input id="iti-trade" className={`form-control ${errors.trade ? 'is-invalid' : ''}`} value={trade?.label || workerTrade} disabled />
              <div className="small text-slate mt-1">Must match your trade on SIMSAR. <Link to="/worker/profile">Change it in My profile</Link>.</div>
              {errors.trade && <div className="small text-brick mt-1">{errors.trade}</div>}
            </div>
            <div className="col-sm-6">
              <label htmlFor="iti-councilType" className="form-label fw-semibold">Council</label>
              <select id="iti-councilType" className="form-select" value={form.councilType} onChange={set('councilType')}>
                {councilTypes.map((c) => <option key={c} value={c}>{c === 'NCVT' ? 'NCVT (national)' : 'SCVT (state)'}</option>)}
              </select>
            </div>
            <div className="col-sm-6">{input('certificateNumber', 'Certificate number', { placeholder: 'e.g. R150727033412', autoComplete: 'off' })}</div>
            <div className="col-sm-6">{input('registrationNumber', 'Registration / roll number (optional)', { autoComplete: 'off' })}</div>
            <div className="col-12">{input('instituteName', 'Institute (ITI) name', { placeholder: 'e.g. Government ITI Kurla' })}</div>
            <div className="col-sm-6">{input('instituteDistrict', 'District')}</div>
            <div className="col-sm-6">{input('instituteState', 'State')}</div>
            <div className="col-sm-4">{input('passingYear', 'Year of passing', { type: 'number', min: 1960, max: thisYear, inputMode: 'numeric' })}</div>
            <div className="col-sm-4">{input('grade', 'Grade (optional)', { maxLength: 20, placeholder: 'e.g. First class' })}</div>
            <div className="col-sm-4">{input('percentage', 'Percentage (optional)', { type: 'number', min: 0, max: 100, step: '0.1' })}</div>
            <div className="col-12">
              <label htmlFor="iti-file" className="form-label fw-semibold">Scan or photo of the certificate</label>
              <input
                key={fileKey}
                id="iti-file"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className={`form-control ${errors.certificateFile ? 'is-invalid' : ''}`}
                onChange={(e) => { setFile(e.target.files[0] || null); setErrors({ ...errors, certificateFile: undefined }); }}
              />
              <div className="small text-slate mt-1">JPG, PNG or PDF, up to {formatBytes(certificateMaxBytes)}. Only you and SIMSAR admins can see it.</div>
              {errors.certificateFile && <div className="small text-brick mt-1">{errors.certificateFile}</div>}
            </div>
          </div>
          <button type="submit" className="btn btn-primary mt-4" disabled={submitting}>
            {submitting && <span className="spinner-border spinner-border-sm me-1" />}Submit certificate for review
          </button>
        </form>
      )}

      {viewing && <CertificateViewer certificate={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}

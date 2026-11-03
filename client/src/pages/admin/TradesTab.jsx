import { useState } from 'react';
import { adminApi } from '../../api';
import { errorMessage, fieldErrors } from '../../api/client';
import { useConfig } from '../../context/ConfigContext';
import { useToast } from '../../context/ToastContext';
import useAsync from '../../utils/useAsync';
import { formatINR } from '../../utils/format';
import Loading from '../../components/Loading';
import ErrorAlert from '../../components/ErrorAlert';

const EDITABLE = ['label', 'plural', 'icon', 'minHourlyRate', 'sortOrder', 'description'];
const EMPTY_NEW = { slug: '', label: '', plural: '', icon: 'bi-tools', minHourlyRate: '', sortOrder: '', description: '' };

// Body for the API: numbers as numbers, blank optional fields left out.
function toBody(draft) {
  const body = {};
  for (const key of EDITABLE.concat('slug')) {
    if (draft[key] === undefined || draft[key] === '') continue;
    body[key] = ['minHourlyRate', 'sortOrder'].includes(key) ? Number(draft[key]) : String(draft[key]).trim();
  }
  return body;
}

// One editable row. Saving a new minimum applies to jobs posted from now on;
// jobs already posted keep the minimum they were posted with.
function TradeRow({ trade, onSaved }) {
  const toast = useToast();
  const [draft, setDraft] = useState(() => Object.fromEntries(EDITABLE.map((k) => [k, trade[k] ?? ''])));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const dirty = EDITABLE.some((k) => String(draft[k] ?? '') !== String(trade[k] ?? ''));
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });

  async function run(action, message) {
    setBusy(true);
    setErrors({});
    try {
      const res = await action();
      toast.success(res?.message || message);
      await onSaved();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const save = () => {
    const raised = Number(draft.minHourlyRate) > trade.minHourlyRate;
    // description is sent even when empty, so it can be cleared.
    run(() => adminApi.updateTrade(trade._id, { ...toBody(draft), description: String(draft.description).trim() }),
      `${draft.label} saved.${raised ? ' The new minimum applies to jobs posted from now on.' : ''}`);
  };
  const toggleActive = () => run(() => adminApi.updateTrade(trade._id, { active: !trade.active }),
    `${trade.label} ${trade.active ? 'deactivated — hidden from new jobs and sign-ups' : 'activated'}.`);
  const remove = () => {
    if (!window.confirm(`Remove ${trade.label}? If any worker, job or certificate uses it, it will be deactivated instead.`)) return;
    run(() => adminApi.deleteTrade(trade._id), `${trade.label} removed.`);
  };

  const input = (key, props = {}) => (
    <input className={`form-control form-control-sm ${errors[key] ? 'is-invalid' : ''}`} value={draft[key]} onChange={set(key)} title={errors[key]} aria-label={`${trade.label} ${key}`} {...props} />
  );
  const u = trade.usage;

  return (
    <tr className={trade.active ? '' : 'table-light text-slate'}>
      <td style={{ minWidth: 220 }}>
        <div className="d-flex gap-2 align-items-center">
          <i className={`bi ${draft.icon} fs-5`} style={{ color: 'var(--indigo)' }} />
          {input('label')}
        </div>
        <div className="d-flex gap-2 mt-1">{input('plural', { placeholder: 'Plural' })}{input('icon', { placeholder: 'bi-tools' })}</div>
        <div className="mt-1">{input('description', { placeholder: 'Short description (optional)', maxLength: 300 })}</div>
      </td>
      <td><code>{trade.slug}</code></td>
      <td style={{ width: 130 }}>
        <div className="input-group input-group-sm">
          <span className="input-group-text">₹</span>
          {input('minHourlyRate', { type: 'number', min: 0 })}
        </div>
        <div className="small text-slate mt-1">per hour</div>
        {errors.minHourlyRate && <div className="small text-brick">{errors.minHourlyRate}</div>}
      </td>
      <td style={{ width: 80 }}>{input('sortOrder', { type: 'number', min: 0, max: 999 })}</td>
      <td className="small">
        {u.workers} workers · {u.jobs} jobs
        {u.itiCertificates > 0 && <div>{u.itiCertificates} ITI certificates</div>}
        {u.workersBelowMinimum > 0 && <div className="text-brick">{u.workersBelowMinimum} worker(s) charge below {formatINR(trade.minHourlyRate)}/hr</div>}
      </td>
      <td>
        <div className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" role="switch" id={`active-${trade._id}`} checked={trade.active} disabled={busy} onChange={toggleActive} />
          <label className="form-check-label small" htmlFor={`active-${trade._id}`}>{trade.active ? 'Active' : 'Inactive'}</label>
        </div>
      </td>
      <td className="text-end text-nowrap">
        <button type="button" className="btn btn-sm btn-primary me-1" disabled={!dirty || busy} onClick={save}>
          {busy && <span className="spinner-border spinner-border-sm me-1" />}Save
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} aria-label={`Remove ${trade.label}`} onClick={remove}><i className="bi bi-trash" /></button>
      </td>
    </tr>
  );
}

// Trades & wage rates: the fair minimum hourly rate for each trade lives in
// MongoDB, and this tab is where it is changed. The server reads it on every
// job post and worker rate change, so a change here takes effect at once.
export default function TradesTab({ onChange }) {
  const { reloadTrades } = useConfig();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => adminApi.trades(), []);
  const [form, setForm] = useState(EMPTY_NEW);
  const [errors, setErrors] = useState({});
  const [adding, setAdding] = useState(false);

  // After any change: refresh this table, the trade list the rest of the app uses, and the stats.
  async function refresh() {
    await Promise.all([reload(), reloadTrades()]);
    onChange();
  }

  const set = (key) => (e) => {
    setForm({ ...form, [key]: e.target.value });
    if (errors[key]) setErrors({ ...errors, [key]: undefined });
  };

  async function addTrade(e) {
    e.preventDefault();
    const errs = {};
    if (!/^[a-z][a-z0-9-]{1,29}$/.test(form.slug)) errs.slug = '2–30 lowercase letters, digits or hyphens, starting with a letter.';
    if (form.label.trim().length < 2) errs.label = 'Enter a name.';
    if (form.plural.trim().length < 2) errs.plural = 'Enter the plural, e.g. Welders.';
    if (form.minHourlyRate === '' || Number(form.minHourlyRate) < 0) errs.minHourlyRate = 'Enter a rate of ₹0 or more.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setAdding(true);
    try {
      const { trade } = await adminApi.createTrade(toBody(form));
      toast.success(`${trade.label} added at ${formatINR(trade.minHourlyRate)}/hr.`);
      setForm(EMPTY_NEW);
      await refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setAdding(false);
    }
  }

  const field = (key, label, props = {}, col = 'col-sm-6 col-lg-3') => (
    <div className={col}>
      <label htmlFor={`nt-${key}`} className="form-label small fw-semibold">{label}</label>
      <input id={`nt-${key}`} className={`form-control form-control-sm ${errors[key] ? 'is-invalid' : ''}`} value={form[key]} onChange={set(key)} {...props} />
      {errors[key] && <div className="small text-brick mt-1">{errors[key]}</div>}
    </div>
  );

  return (
    <>
      <p className="small text-slate">
        Each trade's fair minimum hourly rate is the wage floor: a job whose worker payout per hour is below it can't be
        posted, and workers can't advertise a lower rate. Jobs already posted keep the minimum they were posted with.
        Trades that are in use can be deactivated (hidden from new jobs and sign-ups) but not deleted.
      </p>
      <ErrorAlert message={error} onRetry={reload} />
      {loading && !data ? <Loading /> : data && (
        <div className="card-panel table-responsive">
          <table className="table mb-0 small">
            <thead>
              <tr><th>Trade</th><th>Slug</th><th>Fair minimum</th><th>Order</th><th>Used by</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {/* key includes updatedAt so a row's draft resets after it is saved */}
              {data.trades.map((t) => <TradeRow key={`${t._id}-${t.updatedAt}`} trade={t} onSaved={refresh} />)}
            </tbody>
          </table>
        </div>
      )}

      <form className="card-panel p-4 mt-4" onSubmit={addTrade} noValidate>
        <h3 className="h5 fw-semibold">Add a trade</h3>
        <div className="row g-3">
          {field('label', 'Name', { placeholder: 'e.g. Welder', maxLength: 40 })}
          {field('plural', 'Plural', { placeholder: 'e.g. Welders', maxLength: 40 })}
          {field('slug', 'Slug (permanent)', { placeholder: 'e.g. welder', maxLength: 30 })}
          {field('minHourlyRate', 'Fair minimum (₹/hr)', { type: 'number', min: 0 })}
          {field('icon', 'Bootstrap icon', { placeholder: 'bi-tools' })}
          {field('sortOrder', 'Order', { type: 'number', min: 0, max: 999 })}
          {field('description', 'Description (optional)', { maxLength: 300 }, 'col-lg-6')}
        </div>
        <p className="small text-slate mt-2 mb-0">The slug is how jobs and workers refer to the trade, so it can't be changed later. Icons: any name from icons.getbootstrap.com, e.g. <code>bi-wrench</code>.</p>
        <button type="submit" className="btn btn-primary mt-3" disabled={adding}>
          {adding && <span className="spinner-border spinner-border-sm me-1" />}Add trade
        </button>
      </form>
    </>
  );
}

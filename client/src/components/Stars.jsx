// Read-only star display, e.g. <Stars value={4.5} count={12} />
export default function Stars({ value = 0, count }) {
  const full = Math.round(value);
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span className="stars" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <i key={n} className={`bi ${n <= full ? 'bi-star-fill' : 'bi-star'}`} />
        ))}
      </span>
      {count !== undefined && (
        <span className="small text-slate">
          {count > 0 ? `${Number(value).toFixed(1)} (${count})` : 'No ratings yet'}
        </span>
      )}
    </span>
  );
}

// Clickable 1–5 star input for review forms.
export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className={n <= value ? 'on' : ''}
          onClick={() => onChange(n)}
        >
          <i className={`bi ${n <= value ? 'bi-star-fill' : 'bi-star'}`} />
        </button>
      ))}
    </div>
  );
}

export default function ErrorAlert({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2" role="alert">
      <span><i className="bi bi-exclamation-triangle" /> {message}</span>
      {onRetry && (
        <button type="button" className="btn btn-sm btn-outline-dark" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

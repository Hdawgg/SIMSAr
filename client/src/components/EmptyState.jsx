export default function EmptyState({ icon = 'bi-inbox', title, children }) {
  return (
    <div className="card-panel p-5 text-center">
      <i className={`bi ${icon} fs-1 text-slate`} />
      <p className="h5 mt-2">{title}</p>
      {children && <div className="text-slate">{children}</div>}
    </div>
  );
}

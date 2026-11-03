// Shown on workers whose background check an admin has approved.
export default function VerifiedBadge({ verified, showUnverified = false }) {
  if (verified) {
    return (
      <span className="badge-verified small" title="Background check approved by SIMSAR">
        <i className="bi bi-patch-check-fill" /> Verified
      </span>
    );
  }
  if (!showUnverified) return null;
  return <span className="small text-slate"><i className="bi bi-hourglass-split" /> Not verified yet</span>;
}

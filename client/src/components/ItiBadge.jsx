import { useConfig } from '../context/ConfigContext';

// "ITI Certified · Electrician" — shown for each approved ITI certificate.
// Separate from the Verified badge, which means the background check passed.
// `certificates` are { trade, councilType } objects; `trades` is a list of slugs.
export default function ItiBadge({ certificates, trades }) {
  const { getTrade } = useConfig();
  const slugs = [...new Set(trades || (certificates || []).map((c) => c.trade))];
  if (slugs.length === 0) return null;
  return slugs.map((slug) => (
    <span key={slug} className="badge-iti small" title="ITI certificate verified by SIMSAR admin against the certificate (simulated check, no government database)">
      <i className="bi bi-mortarboard-fill" /> ITI Certified · {getTrade(slug)?.label || slug}
    </span>
  ));
}

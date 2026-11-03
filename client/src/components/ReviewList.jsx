import { Link } from 'react-router-dom';
import Stars from './Stars';
import { timeAgo } from '../utils/format';

export default function ReviewList({ reviews }) {
  if (!reviews?.length) return <p className="text-slate">No reviews yet.</p>;
  return (
    <ul className="list-unstyled mb-0">
      {reviews.map((r) => (
        <li key={r._id} className="pb-3 mb-3 border-bottom border-line">
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <span className="fw-semibold">
              <Link to={`/profile/${r.reviewer?._id}`} className="text-reset">{r.reviewer?.name}</Link>{' '}
              <span className="small text-slate fw-normal">({r.reviewer?.role})</span>
            </span>
            <span className="small text-slate">{timeAgo(r.createdAt)}</span>
          </div>
          <Stars value={r.rating} />
          {r.job && <p className="small text-slate mb-1">for “{r.job.title}”</p>}
          {r.comment && <p className="mb-0">{r.comment}</p>}
        </li>
      ))}
    </ul>
  );
}

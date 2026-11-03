import { useState } from 'react';
import Modal from './Modal';
import { StarInput } from './Stars';
import { reviewsApi } from '../api';
import { errorMessage } from '../api/client';
import { useToast } from '../context/ToastContext';

// Used by both sides after a job is completed: the employer rates the worker
// and the worker rates the employer.
export default function ReviewModal({ jobId, revieweeName, onClose, onSaved }) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setError('Choose between 1 and 5 stars.');
    setSaving(true);
    try {
      await reviewsApi.create({ jobId, rating, comment: comment.trim() });
      toast.success(`Thanks — your rating for ${revieweeName} is saved.`);
      onSaved(rating);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Rate ${revieweeName}`} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <p className="small text-slate">Ratings are public and help others decide. You can rate each job once.</p>
        <StarInput value={rating} onChange={(n) => { setRating(n); setError(''); }} />
        <label htmlFor="reviewComment" className="form-label fw-semibold mt-3">
          Comment <span className="text-slate fw-normal">(optional)</span>
        </label>
        <textarea
          id="reviewComment"
          className="form-control"
          rows="3"
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What went well? What could be better?"
        />
        <div className="small text-slate text-end">{comment.length}/500</div>
        {error && <div className="small text-brick mt-1">{error}</div>}
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-outline-dark" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner-border spinner-border-sm me-1" />}Submit rating
          </button>
        </div>
      </form>
    </Modal>
  );
}

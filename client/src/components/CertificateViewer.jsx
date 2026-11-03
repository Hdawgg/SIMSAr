import { useEffect, useState } from 'react';
import { itiApi } from '../api';
import { errorMessage } from '../api/client';
import Modal from './Modal';
import Loading from './Loading';

// Shows an uploaded ITI certificate scan. The file route needs the login
// token (only the worker and admins may see it), so it is downloaded as a Blob
// and shown from a temporary object URL instead of a plain <img src>.
export default function CertificateViewer({ certificate, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl;
    itiApi.file(certificate._id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => setError(errorMessage(err)));
    return () => objectUrl && URL.revokeObjectURL(objectUrl);
  }, [certificate._id]);

  const isPdf = certificate.file?.mimeType === 'application/pdf';

  return (
    <Modal title="ITI certificate scan" onClose={onClose}>
      {error && <div className="alert alert-danger small">{error}</div>}
      {!url && !error && <Loading label="Loading the scan…" />}
      {url && (isPdf
        ? <iframe src={url} title="Certificate PDF" className="w-100 border rounded" style={{ height: 420 }} />
        : <img src={url} alt="Uploaded ITI certificate" className="img-fluid border rounded" />)}
      {url && (
        <p className="small mt-2 mb-0">
          <a href={url} target="_blank" rel="noreferrer">Open in a new tab</a>
          <span className="text-slate"> · {certificate.file?.originalName}</span>
        </p>
      )}
    </Modal>
  );
}

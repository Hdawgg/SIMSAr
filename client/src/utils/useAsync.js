import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../api/client';

// Runs an async loader on mount (and when `deps` change) and tracks
// loading / error / data, so pages don't repeat the same three useStates.
// Returns { data, loading, error, reload, setData }.
export default function useAsync(loader, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    return run()
      .then(setData)
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [run]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

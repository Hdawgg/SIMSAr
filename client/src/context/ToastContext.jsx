import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: 'bi-check-circle-fill', color: 'var(--leaf)' },
  error: { icon: 'bi-exclamation-octagon-fill', color: 'var(--brick)' },
  info: { icon: 'bi-info-circle-fill', color: 'var(--indigo)' },
};

// Small toast system built on Bootstrap's .toast markup.
// Usage: const toast = useToast(); toast.success('Saved');
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { id, type, message }]);
    setTimeout(() => dismiss(id), 4000);
  }, [dismiss]);

  const toast = {
    success: (m) => show('success', m),
    error: (m) => show('error', m),
    info: (m) => show('info', m),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast show bg-white border-line" role={t.type === 'error' ? 'alert' : 'status'}>
            <div className="toast-body d-flex align-items-start gap-2">
              <i className={`bi ${STYLES[t.type].icon} mt-1`} style={{ color: STYLES[t.type].color }} />
              <span className="flex-grow-1">{t.message}</span>
              <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={() => dismiss(t.id)} />
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

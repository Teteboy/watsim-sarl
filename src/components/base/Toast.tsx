import { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const toastConfig: Record<ToastType, { icon: string; color: string; bg: string; border: string }> = {
  success: { icon: 'ri-checkbox-circle-line', color: '#22C55E', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.3)' },
  error: { icon: 'ri-close-circle-line', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' },
  warning: { icon: 'ri-error-warning-line', color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' },
  info: { icon: 'ri-information-line', color: '#D4AF37', bg: 'rgba(212,175,55,0.12)', border: 'rgba(212,175,55,0.3)' },
};

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const cfg = toastConfig[toast.type];

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10);
    const hide = setTimeout(() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }, 3500);
    return () => { clearTimeout(show); clearTimeout(hide); };
  }, [toast.id, onRemove]);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl transition-all duration-300"
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(12px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        minWidth: '280px',
        maxWidth: '360px',
      }}
    >
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
        <i className={`${cfg.icon} text-base`} style={{ color: cfg.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white" style={{ fontFamily: 'Poppins, sans-serif' }}>{toast.title}</p>
        {toast.message && <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{toast.message}</p>}
      </div>
      <button onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 300); }} className="w-5 h-5 flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <i className="ri-close-line text-sm" />
      </button>
    </div>
  );
}

export default function Toast({ toasts, onRemove }: ToastProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  );
}

// Hook
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: ToastType, title: string, message?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
  };

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  return { toasts, addToast, removeToast };
}

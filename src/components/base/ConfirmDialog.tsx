interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', confirmColor = '#EF4444', icon = 'ri-error-warning-line', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} onClick={onCancel}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: '#014945', border: '1px solid rgba(77,176,89,0.2)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${confirmColor}20` }}>
            <i className={`${icon} text-xl`} style={{ color: confirmColor }} />
          </div>
          <div>
            <p className="text-white font-semibold" style={{ fontFamily: 'Montserrat, sans-serif' }}>{title}</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Poppins, sans-serif' }}>{message}</p>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'Poppins, sans-serif' }}>
            Annuler
          </button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap" style={{ background: `${confirmColor}20`, color: confirmColor, border: `1px solid ${confirmColor}40`, fontFamily: 'Poppins, sans-serif' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

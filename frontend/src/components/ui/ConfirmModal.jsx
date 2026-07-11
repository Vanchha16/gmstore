export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  const confirmClasses = tone === 'danger'
    ? 'bg-rose-600 hover:bg-rose-500 text-white'
    : 'bg-emerald-600 hover:bg-emerald-500 text-white'

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-slate-100">{title}</h2>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-slate-600 transition disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${confirmClasses}`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

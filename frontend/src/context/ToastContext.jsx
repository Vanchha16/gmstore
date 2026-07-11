import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismiss = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm shadow-2xl backdrop-blur animate-fade-in max-w-sm ${
              t.type === 'success' ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300' :
              t.type === 'error'   ? 'border-red-500/30 bg-red-950/90 text-red-300' :
              t.type === 'warning' ? 'border-amber-500/30 bg-amber-950/90 text-amber-300' :
                                     'border-slate-700 bg-slate-900/95 text-slate-200'
            }`}
          >
            {t.type === 'success' && <span className="text-emerald-400">✓</span>}
            {t.type === 'error'   && <span className="text-red-400">✕</span>}
            {t.type === 'warning' && <span className="text-amber-400">⚠</span>}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-300 transition text-xs">✕</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)

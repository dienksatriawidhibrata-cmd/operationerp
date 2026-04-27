import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext(null)

let _id = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const add = useCallback((message, type = 'info') => {
    const id = ++_id
    setToasts((prev) => [...prev.slice(-2), { id, message, type }])
    return id
  }, [])

  const toastSuccess = useCallback((message) => add(message, 'success'), [add])
  const toastError   = useCallback((message) => add(message, 'error'), [add])
  const toastInfo    = useCallback((message) => add(message, 'info'), [add])
  const showToast    = useCallback((message, type = 'info') => add(message, type), [add])

  return (
    <ToastContext.Provider value={{ toastSuccess, toastError, toastInfo, showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast harus dipakai di dalam ToastProvider')
  return ctx
}

// ── Internal components ──────────────────────────────────────────────────────

const TONE = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-rose-600 text-white',
  info:    'bg-slate-800 text-white',
}

const ICON = {
  success: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
}

function ToastItem({ toast, onDismiss }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timerRef.current)
  }, [toast.id, onDismiss])

  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-lg text-sm font-medium max-w-xs w-full ${TONE[toast.type]}`}
    >
      {ICON[toast.type]}
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="opacity-70 hover:opacity-100 transition-opacity ml-1 shrink-0"
        aria-label="Tutup notifikasi"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-20 inset-x-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4 sm:bottom-6">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto w-full max-w-xs">
          <ToastItem toast={toast} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  )
}

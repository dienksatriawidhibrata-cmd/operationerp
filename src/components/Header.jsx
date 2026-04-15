import { useNavigate } from 'react-router-dom'

export default function Header({ title, sub, onBack, action }) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) onBack()
    else navigate(-1)
  }

  return (
    <header className="bg-primary-600 text-white px-4 py-3.5 flex items-center gap-3 sticky top-0 z-20 shadow-md">
      {onBack !== false && (
        <button
          onClick={handleBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 transition-colors flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[15px] leading-tight truncate">{title}</div>
        {sub && <div className="text-xs opacity-70 mt-0.5 truncate">{sub}</div>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  )
}

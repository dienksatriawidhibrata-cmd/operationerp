const VARIANTS = {
  warn:  { bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-800', icon: '⚠️' },
  info:  { bg: 'bg-primary-50 border-primary-200', text: 'text-primary-800', icon: 'ℹ️' },
  ok:    { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: '✅' },
  error: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: '❌' },
}

export default function Alert({ variant = 'info', children, className = '' }) {
  const v = VARIANTS[variant]
  return (
    <div className={`flex gap-2.5 items-start p-3 rounded-xl border text-sm leading-relaxed ${v.bg} ${v.text} ${className}`}>
      <span className="text-base flex-shrink-0 mt-0.5">{v.icon}</span>
      <span>{children}</span>
    </div>
  )
}

const VARIANTS = {
  ok:      'bg-green-50 text-green-700 border border-green-200',
  warn:    'bg-yellow-50 text-yellow-700 border border-yellow-200',
  danger:  'bg-red-50 text-red-700 border border-red-200',
  blue:    'bg-primary-50 text-primary-700 border border-primary-200',
  gray:    'bg-gray-50 text-gray-600 border border-gray-200',
  purple:  'bg-purple-50 text-purple-700 border border-purple-200',
}

export default function Badge({ variant = 'gray', children, className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-wide ${VARIANTS[variant]} ${className}`}>
      {children}
    </span>
  )
}

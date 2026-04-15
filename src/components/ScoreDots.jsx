export default function ScoreDots({ value, onChange, disabled }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange?.(n)}
          className={`
            w-7 h-7 rounded-lg text-xs font-bold transition-all
            ${n <= value
              ? 'bg-primary-600 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 border border-gray-200'
            }
            ${!disabled ? 'active:scale-90' : 'cursor-not-allowed opacity-60'}
          `}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export default function Toggle({ checked, onChange, disabled }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={e => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      <div className={`
        w-10 h-6 rounded-full peer transition-colors
        peer-focus:ring-2 peer-focus:ring-primary-300
        ${checked ? 'bg-primary-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}>
        <div className={`
          absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm
          transition-transform duration-200
          ${checked ? 'translate-x-4' : 'translate-x-0'}
        `} />
      </div>
    </label>
  )
}

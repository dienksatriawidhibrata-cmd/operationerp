import { Link, useNavigate } from 'react-router-dom'

const ICON_PATHS = {
  approval: (
    <>
      <path d="M9 12.75 11.25 15 15 9.75" />
      <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9Z" />
    </>
  ),
  bell: (
    <>
      <path d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.42V11a6 6 0 1 0-12 0v3.18a2 2 0 0 1-.6 1.42L4 17h5" />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </>
  ),
  calendar: (
    <>
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 10h18" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V5" />
      <path d="M10 19V9" />
      <path d="M16 19v-6" />
      <path d="M22 19V3" />
    </>
  ),
  checklist: (
    <>
      <path d="M8 7h9" />
      <path d="M8 12h9" />
      <path d="M8 17h9" />
      <path d="m4 7 1.3 1.3L7 6.4" />
      <path d="m4 12 1.3 1.3L7 11.4" />
      <path d="m4 17 1.3 1.3L7 16.4" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  finance: (
    <>
      <path d="M12 3v18" />
      <path d="M16.5 7.5c0-1.93-2.01-3.5-4.5-3.5S7.5 5.57 7.5 7.5 9.51 11 12 11s4.5 1.57 4.5 3.5S14.49 18 12 18s-4.5-1.57-4.5-3.5" />
    </>
  ),
  home: (
    <>
      <path d="m3 10.5 9-7 9 7" />
      <path d="M5 9.25V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.25" />
    </>
  ),
  map: (
    <>
      <path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
      <path d="M9 3v15" />
      <path d="M15 6v15" />
    </>
  ),
  opex: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0 2 5.3" />
      <path d="M20 4v7h-7" />
    </>
  ),
  spark: (
    <>
      <path d="m12 2 1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2Z" />
      <path d="m5 18 .75 2 .75-2 2-.75-2-.75L5 14l-.75 2-.75.75 2 .75Z" />
    </>
  ),
  store: (
    <>
      <path d="M4 7.5 5.5 3h13L20 7.5V9a2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 1-5 0Z" />
      <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  logout: (
    <>
      <path d="M15 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" />
      <path d="m10 12 10 0" />
      <path d="m17 9 3 3-3 3" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 3.6 18.5A1 1 0 0 0 4.47 20h15.06a1 1 0 0 0 .87-1.5L12 4Z" />
      <path d="M12 9v4.5" />
      <path d="M12 17h.01" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  matrix: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
}

export function AppIcon({ name, size = 20, className = '', strokeWidth = 1.8 }) {
  const icon = ICON_PATHS[name] || ICON_PATHS.spark

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {icon}
    </svg>
  )
}

export function AppCanvas({ children, className = '' }) {
  return (
    <div className={`relative min-h-screen overflow-x-clip bg-slate-50 text-slate-900 ${className}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_58%),linear-gradient(180deg,_rgba(219,234,254,0.72),_rgba(248,250,252,0.98)_52%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[18rem] bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_44%)]" />
      <div className="relative">{children}</div>
    </div>
  )
}

export function ShellHeader({
  brandTitle,
  brandSubtitle,
  profileName,
  profileRole,
  primaryAction,
  secondaryAction,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[4.4rem] max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-[0_18px_50px_-26px_rgba(15,23,42,0.8)] sm:h-11 sm:w-11">
            <AppIcon name="store" size={20} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px] sm:tracking-[0.2em]">
              {brandSubtitle}
            </div>
            <div className="truncate text-base font-semibold tracking-tight text-slate-950 sm:text-lg">
              {brandTitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {secondaryAction}
          {primaryAction}
          <div className="hidden h-9 w-px bg-slate-200 sm:block" />
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-slate-900">{profileName}</div>
            <div className="text-[11px] text-slate-500">{profileRole}</div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 shadow-inner shadow-primary-200/70 sm:h-11 sm:w-11">
            <span className="text-sm font-bold">{(profileName || '?').slice(0, 1).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export function SubpageShell({
  title,
  subtitle,
  eyebrow,
  showBack = true,
  onBack,
  action,
  footer,
  children,
}) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    navigate(-1)
  }

  return (
    <AppCanvas>
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/84 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.4rem] max-w-7xl items-center gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-[0_16px_44px_-34px_rgba(15,23,42,0.35)] transition-colors hover:border-primary-200 hover:text-primary-700 sm:h-11 sm:w-11"
              aria-label="Kembali"
            >
              <AppIcon name="chevronLeft" size={18} />
            </button>
          )}

          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 sm:text-[11px] sm:tracking-[0.2em]">
                {eyebrow}
              </div>
            )}
            <div className="truncate text-base font-semibold tracking-tight text-slate-950 sm:text-lg">{title}</div>
            {subtitle && <div className="truncate text-sm text-slate-500">{subtitle}</div>}
          </div>

          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-36 pt-3 sm:px-6 sm:pt-4 lg:px-8 lg:pb-32 lg:pt-6">
        {children}
      </main>

      {footer}
    </AppCanvas>
  )
}

export function HeroCard({ eyebrow, title, description, meta, actions, children }) {
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(135deg,_rgba(30,64,175,0.96),_rgba(37,99,235,0.92)_46%,_rgba(56,189,248,0.85)_120%)] px-4 py-5 text-white shadow-[0_30px_90px_-36px_rgba(37,99,235,0.85)] sm:px-6 sm:py-6 lg:rounded-[28px] lg:px-8">
      <div className="pointer-events-none absolute -right-20 top-[-3.5rem] h-44 w-44 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-28 h-24 w-24 rounded-full bg-sky-200/20 blur-2xl" />

      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-100 sm:text-[11px] sm:tracking-[0.22em]">{eyebrow}</div>
          <h1 className="mt-2.5 text-[1.7rem] font-semibold leading-tight tracking-tight sm:mt-3 sm:text-4xl">{title}</h1>
          <p className="mt-2.5 max-w-xl text-sm leading-5.5 text-blue-50/92 sm:mt-3 sm:text-[15px] sm:leading-6">{description}</p>
          {meta && <div className="mt-3.5 flex flex-wrap items-center gap-2 text-xs text-blue-100 sm:mt-4">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>

      {children && <div className="relative mt-5 sm:mt-6">{children}</div>}
    </section>
  )
}

export function MetricCard({
  title,
  value,
  total,
  note,
  onClick,
  icon,
  tone = 'primary',
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700 ring-primary-100',
    orange: 'bg-orange-50 text-orange-700 ring-orange-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    violet: 'bg-violet-50 text-violet-700 ring-violet-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  }

  const interactive = typeof onClick === 'function'

  return (
    <button
      onClick={onClick}
      type="button"
      className={`group rounded-[22px] border border-white/75 bg-white p-4 text-left shadow-[0_18px_55px_-32px_rgba(15,23,42,0.32)] transition-all sm:rounded-[24px] sm:p-5 ${
        interactive ? 'hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-[0_24px_70px_-34px_rgba(37,99,235,0.35)]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:text-[11px] sm:tracking-[0.18em]">{title}</div>
          <div className="mt-3 flex items-end gap-2">
            <div className="text-[1.7rem] font-semibold leading-none tracking-tight text-slate-950 sm:text-3xl">{value}</div>
            {total != null && <div className="pb-1 text-sm text-slate-400">/ {total}</div>}
          </div>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ring-1 sm:h-12 sm:w-12 ${tones[tone] || tones.primary}`}>
          <AppIcon name={icon} size={20} />
        </div>
      </div>
      {note && <div className="mt-3.5 text-sm leading-5.5 text-slate-500">{note}</div>}
    </button>
  )
}

export function ActionCard({ title, description, icon, href, to, onClick, accent = 'primary' }) {
  const tone = {
    primary: 'from-primary-50 to-white text-primary-700',
    emerald: 'from-emerald-50 to-white text-emerald-700',
    violet: 'from-violet-50 to-white text-violet-700',
    amber: 'from-amber-50 to-white text-amber-700',
  }

  const content = (
    <div className="group rounded-[22px] border border-white/75 bg-white p-4 text-left shadow-[0_18px_55px_-32px_rgba(15,23,42,0.28)] transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-[0_24px_70px_-34px_rgba(37,99,235,0.32)] sm:rounded-[24px] sm:p-5">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br sm:h-11 sm:w-11 ${tone[accent] || tone.primary}`}>
        <AppIcon name={icon} size={20} />
      </div>
      <div className="mt-3.5 text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div>
      <div className="mt-3.5 inline-flex items-center gap-2 text-sm font-semibold text-primary-700">
        Buka
        <AppIcon name="chevronRight" size={16} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </div>
  )

  if (to) {
    return <Link to={to}>{content}</Link>
  }

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} className="block w-full">
      {content}
    </button>
  )
}

export function SectionPanel({ eyebrow, title, description, actions, children, className = '' }) {
  return (
    <section className={`rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_22px_65px_-38px_rgba(15,23,42,0.26)] backdrop-blur sm:rounded-[28px] sm:p-5 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400 sm:text-[11px] sm:tracking-[0.2em]">
              {eyebrow}
            </div>
          )}
          <div className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950 sm:mt-2 sm:text-xl">{title}</div>
          {description && <div className="mt-1.5 text-sm leading-5.5 text-slate-500 sm:mt-2 sm:leading-6">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="mt-4 sm:mt-5">{children}</div>
    </section>
  )
}

export function SegmentedControl({ options, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex rounded-2xl bg-slate-100 p-0.5 ${className}`}>
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={`whitespace-nowrap rounded-2xl px-3 py-2 text-xs font-semibold transition-all sm:px-4 sm:text-sm ${
            value === option.key
              ? 'bg-white text-slate-950 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.45)]'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ToneBadge({ tone = 'slate', children }) {
  const tones = {
    danger: 'bg-rose-50 text-rose-700 ring-rose-100',
    warn: 'bg-amber-50 text-amber-700 ring-amber-100',
    info: 'bg-primary-50 text-primary-700 ring-primary-100',
    ok: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 sm:px-3 sm:py-1.5 sm:text-[11px] ${tones[tone] || tones.slate}`}>
      {children}
    </span>
  )
}

export function EmptyPanel({ title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/85 px-4 py-6 text-center sm:rounded-[24px] sm:px-5 sm:py-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm sm:h-14 sm:w-14">
        <AppIcon name="spark" size={24} />
      </div>
      <div className="mt-3.5 text-base font-semibold text-slate-900">{title}</div>
      <div className="mx-auto mt-2 max-w-md text-sm leading-5.5 text-slate-500 sm:leading-6">{description}</div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white sm:mt-5"
        >
          {actionLabel}
          <AppIcon name="chevronRight" size={16} />
        </button>
      )}
    </div>
  )
}

export function InlineStat({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    primary: 'bg-primary-50 text-primary-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  }

  return (
    <div className={`rounded-2xl px-3.5 py-3 sm:px-4 ${tones[tone] || tones.slate}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-75 sm:text-[11px] sm:tracking-[0.18em]">{label}</div>
      <div className="mt-1.5 text-xl font-semibold tracking-tight sm:mt-2 sm:text-2xl">{value}</div>
    </div>
  )
}

export function SoftButton({ children, onClick, icon, tone = 'light', className = '', type = 'button' }) {
  const tones = {
    light: 'border-white/20 bg-white/10 text-white hover:bg-white/16',
    white: 'border-slate-200 bg-white text-slate-700 hover:border-primary-200 hover:text-primary-700',
    primary: 'border-primary-500 bg-primary-600 text-white hover:bg-primary-700',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition-colors sm:px-4 sm:py-2.5 ${tones[tone] || tones.light} ${className}`}
    >
      {icon && <AppIcon name={icon} size={18} />}
      {children}
    </button>
  )
}

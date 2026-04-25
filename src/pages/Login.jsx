import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppCanvas } from '../components/ui/AppKit'

const STAFF_EMAIL_ONLY_ROLES = ['staff', 'barista', 'kitchen', 'waitress', 'asst_head_store', 'auditor']

export default function Login() {
  const { signIn, signInStaff, user, profile, loading, profileError } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState('staff')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return

    if (profile) {
      const role = profile.role
      if (role === 'auditor') navigate('/dm/stores', { replace: true })
      else if (['head_store', ...STAFF_EMAIL_ONLY_ROLES].includes(role)) navigate('/staff', { replace: true })
      else if (role === 'ops_manager' || ['support_spv', 'support_admin'].includes(role)) navigate('/ops', { replace: true })
      else if (['district_manager', 'area_manager'].includes(role)) navigate('/dm', { replace: true })
      else if (role === 'finance_supervisor') navigate('/finance', { replace: true })
      else if (role === 'trainer') navigate('/trainer', { replace: true })
      else navigate('/', { replace: true })
      return
    }

    if (submitting && user && !profile) {
      setError(profileError || 'Login berhasil, tapi profil belum siap. Hubungi admin.')
      setSubmitting(false)
    }
  }, [user, profile, loading, navigate, profileError, submitting])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error: err } = mode === 'staff'
      ? await signInStaff(email.trim())
      : await signIn(email.trim(), password)
    if (err) {
      setError(
        mode === 'staff'
          ? (err.message || 'Email tidak ditemukan atau akun staff tidak aktif.')
          : 'Email atau password salah.'
      )
      setSubmitting(false)
    }
  }

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    setEmail('')
    setPassword('')
    setError('')
  }

  return (
    <AppCanvas>
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-600 shadow-[0_20px_50px_-12px_rgba(37,99,235,0.45)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 010 8h-1" />
                <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
                <line x1="6" y1="1" x2="6" y2="4" />
                <line x1="10" y1="1" x2="10" y2="4" />
                <line x1="14" y1="1" x2="14" y2="4" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Bagi Kopi Ops</h1>
            <p className="mt-1 text-sm text-slate-500">Sistem Operasional Toko</p>
          </div>

          <div className="mb-6 grid grid-cols-2 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => handleModeChange('staff')}
              className={`rounded-[20px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                mode === 'staff'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Staff
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('manager')}
              className={`rounded-[20px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                mode === 'manager'
                  ? 'bg-primary-600 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              Head Store & Manager
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                required
                autoComplete="email"
                className="input"
              />
            </div>

            {mode === 'manager' && (
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="........"
                  required
                  autoComplete="current-password"
                  className="input"
                />
              </div>
            )}

            {mode === 'staff' && (
              <p className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-700">
                Untuk staff toko dan asisten head store. Cukup isi email yang sudah didaftarkan admin.
              </p>
            )}

            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary mt-1 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Masuk...
                </>
              ) : 'Masuk'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            {mode === 'staff'
              ? 'Login staff memakai email yang sudah terdaftar. Jika gagal masuk, hubungi admin.'
              : 'Gunakan email dan password akun masing-masing. Jika lupa password, hubungi admin.'}
          </p>
        </div>
      </div>
    </AppCanvas>
  )
}

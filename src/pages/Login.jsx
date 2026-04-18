import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { AppCanvas } from '../components/ui/AppKit'

const STAFF_PASS = import.meta.env.VITE_STAFF_PASS

export default function Login() {
  const { signIn, user, profile, loading, profileError } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode]         = useState('staff')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (loading) return

    if (profile) {
      const role = profile.role
      if (['staff', 'asst_head_store', 'head_store'].includes(role))
        navigate('/staff/ceklis', { replace: true })
      else if (['district_manager', 'area_manager', 'ops_manager'].includes(role))
        navigate('/dm', { replace: true })
      else if (role === 'finance_supervisor')
        navigate('/finance', { replace: true })
      else if (role === 'trainer')
        navigate('/trainer', { replace: true })
      else
        navigate('/', { replace: true })
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
    const pass = mode === 'staff' ? STAFF_PASS : password
    const { error: err } = await signIn(email.trim(), pass)
    if (err) {
      setError(
        mode === 'staff'
          ? 'Email tidak ditemukan. Pastikan email sudah didaftarkan oleh admin.'
          : 'Email atau password salah.'
      )
      setSubmitting(false)
    }
  }

  const handleModeChange = (next) => {
    setMode(next)
    setError('')
    setEmail('')
    setPassword('')
  }

  return (
    <AppCanvas>
      <div className="flex min-h-screen items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">

          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-primary-600 shadow-[0_20px_50px_-12px_rgba(37,99,235,0.45)]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 010 8h-1"/>
                <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/>
                <line x1="10" y1="1" x2="10" y2="4"/>
                <line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Bagi Kopi Ops</h1>
            <p className="mt-1 text-sm text-slate-500">Sistem Operasional Toko</p>
          </div>

          {/* Mode tabs */}
          <div className="mb-5 flex gap-1 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            {[
              { key: 'staff', label: 'Staff' },
              { key: 'manager', label: 'Head Store & Manager' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => handleModeChange(key)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  mode === key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Form */}
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
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                  className="input"
                />
              </div>
            )}

            {mode === 'staff' && (
              <p className="text-xs text-slate-400">
                Cukup masukkan email yang sudah didaftarkan admin. Tidak perlu password.
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

          {mode === 'manager' && (
            <p className="mt-6 text-center text-xs text-slate-400">
              Head Store, DM, AM, Finance &amp; Trainer. Lupa password? Hubungi admin.
            </p>
          )}

        </div>
      </div>
    </AppCanvas>
  )
}

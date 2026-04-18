import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const STAFF_PASS = import.meta.env.VITE_STAFF_PASS

export default function Login() {
  const { signIn, user, profile, loading, profileError } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode]         = useState('staff') // 'staff' | 'manager'
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    if (loading) return

    if (profile) {
      const role = profile.role
      if (['staff', 'asst_head_store', 'head_store'].includes(role))
        navigate('/staff', { replace: true })
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
      setError(profileError || 'Login berhasil, tapi profil user belum siap. Cek tabel profiles di Supabase.')
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
    <div className="page-shell items-center justify-center px-6 py-12">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
          <span className="text-4xl">☕</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Bagi Kopi Ops</h1>
        <p className="text-sm text-gray-500 mt-1">Sistem Operasional Toko</p>
      </div>

      {/* Tab */}
      <div className="flex w-full rounded-xl overflow-hidden border border-gray-200 mb-6">
        <button
          type="button"
          onClick={() => handleModeChange('staff')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mode === 'staff'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          Staff
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('manager')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mode === 'manager'
              ? 'bg-primary-600 text-white'
              : 'bg-white text-gray-500 hover:bg-gray-50'
          }`}
        >
          Head Store & Manager
        </button>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
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
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="input"
            />
          </div>
        )}

        {mode === 'staff' && (
          <p className="text-xs text-gray-400">
            Untuk Staff dan Asst. Head Store. Cukup masukkan email yang sudah didaftarkan admin.
          </p>
        )}

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary mt-2"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Masuk...
            </span>
          ) : 'Masuk →'}
        </button>
      </form>

      {mode === 'manager' && (
        <p className="text-xs text-gray-400 mt-6 text-center">
          Untuk Head Store, DM, AM, dan Finance. Lupa password? Hubungi admin.
        </p>
      )}
    </div>
  )
}

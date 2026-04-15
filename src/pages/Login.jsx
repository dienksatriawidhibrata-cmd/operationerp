import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const { signIn, profile } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: err } = await signIn(email.trim(), password)

    if (err) {
      setError('Email atau password salah.')
      setLoading(false)
      return
    }

    // Redirect handled by App.jsx via RootRedirect after profile loads
    navigate('/', { replace: true })
  }

  return (
    <div className="page-shell items-center justify-center px-6 py-12">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-200">
          <span className="text-4xl">☕</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Bagi Kopi Ops</h1>
        <p className="text-sm text-gray-500 mt-1">Sistem Operasional Toko</p>
      </div>

      {/* Form */}
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

        {error && (
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary mt-2"
        >
          {loading ? (
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

      <p className="text-xs text-gray-400 mt-6 text-center">
        Lupa password? Hubungi admin toko atau DM kamu.
      </p>
    </div>
  )
}

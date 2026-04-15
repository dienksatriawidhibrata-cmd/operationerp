import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const PROFILE_TIMEOUT_MS = 20000
const PROFILE_CACHE_KEY = 'bagikopi_ops_profile_cache'

function readCachedProfile(userId) {
  if (typeof window === 'undefined' || !userId) return null

  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.id !== userId) return null
    return parsed
  } catch {
    return null
  }
}

function writeCachedProfile(profile) {
  if (typeof window === 'undefined') return

  try {
    if (!profile) {
      window.localStorage.removeItem(PROFILE_CACHE_KEY)
      return
    }
    window.localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
  } catch {
    // Ignore cache write errors.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState('')

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, branch_id, managed_districts, managed_areas, is_active, branch:branches(id, name, store_id, district, area)')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  const fetchProfileWithTimeout = async (userId) => {
    return await Promise.race([
      fetchProfile(userId),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout mengambil data profil.')), PROFILE_TIMEOUT_MS)
      })
    ])
  }

  const hydrateSession = async (session) => {
    setUser(session?.user ?? null)
    setProfileError('')

    if (!session?.user) {
      setProfile(null)
      setLoading(false)
      return
    }

    try {
      const profileData = await fetchProfileWithTimeout(session.user.id)
      setProfile(profileData || null)
      writeCachedProfile(profileData || null)

      if (!profileData) {
        setProfileError('Profil user tidak ditemukan. Cek tabel profiles di Supabase.')
      }
    } catch (error) {
      const cachedProfile = readCachedProfile(session.user.id)
      setProfile(cachedProfile || null)
      setProfileError(
        cachedProfile
          ? 'Koneksi ke profil sedang lambat. Aplikasi memakai data login terakhir agar tidak perlu login ulang.'
          : (error.message || 'Gagal mengambil profil user.')
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await hydrateSession(session)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setLoading(true)
        await hydrateSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileError('')
    writeCachedProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

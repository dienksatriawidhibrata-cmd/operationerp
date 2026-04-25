import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)
const PROFILE_TIMEOUT_MS = 20000
const PROFILE_CACHE_KEY = 'bagikopi_ops_profile_cache'
const SESSION_TIMEOUT_MS = 8000
const AUTH_STORAGE_KEY = 'bagikopi-ops-auth'
const BACKEND_BASE = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:8000'

function clearCachedSessionUser() {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Ignore cache clear errors.
  }
}

function readCachedSessionUser() {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.user || parsed?.currentSession?.user || null
  } catch {
    return null
  }
}

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

function clearLocalAuthState() {
  clearCachedSessionUser()
  writeCachedProfile(null)
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(() => readCachedSessionUser())
  const [profile, setProfile] = useState(() => readCachedProfile(readCachedSessionUser()?.id))
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState('')
  const currentUserIdRef = useRef(readCachedSessionUser()?.id || null)
  const profileRef = useRef(null)

  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const fetchProfile = async (userId, accessToken = null) => {
    // When accessToken is provided (e.g. right after setSession while its lock is held),
    // use a raw fetch to avoid calling getSession() which would contend the same lock.
    if (accessToken) {
      const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles`)
      url.searchParams.set('id', `eq.${userId}`)
      url.searchParams.set('select', 'id,full_name,email,role,branch_id,managed_districts,managed_areas,is_active,branch:branches(id,name,store_id,district,area)')
      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Accept': 'application/vnd.pgrst.object+json',
        },
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.message || `HTTP ${res.status}`)
      }
      return (await res.json()) || null
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, branch_id, managed_districts, managed_areas, is_active, branch:branches(id, name, store_id, district, area)')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    return data
  }

  const fetchProfileWithTimeout = async (userId, accessToken = null) => {
    return await Promise.race([
      fetchProfile(userId, accessToken),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout mengambil data profil.')), PROFILE_TIMEOUT_MS)
      })
    ])
  }

  const getSessionWithTimeout = async () => {
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout memeriksa sesi login.')), SESSION_TIMEOUT_MS)
      }),
    ])
  }

  const hydrateSession = async (session) => {
    setUser(session?.user ?? null)
    setProfileError('')

    if (!session?.user) {
      currentUserIdRef.current = null
      setProfile(null)
      clearLocalAuthState()
      setLoading(false)
      return
    }

    const fetchingForUserId = session.user.id
    currentUserIdRef.current = fetchingForUserId

    try {
      const profileData = await fetchProfileWithTimeout(fetchingForUserId, session?.access_token ?? null)
      // Guard: auth state might have changed while we were awaiting
      if (currentUserIdRef.current !== fetchingForUserId) return
      setProfile(profileData || null)
      writeCachedProfile(profileData || null)

      if (!profileData) {
        setProfileError('Profil user tidak ditemukan. Cek tabel profiles di Supabase.')
      }
    } catch (error) {
      if (currentUserIdRef.current !== fetchingForUserId) return
      const cachedProfile = readCachedProfile(fetchingForUserId)
      setProfile(cachedProfile || null)
      setProfileError(
        cachedProfile
          ? 'Koneksi ke profil sedang lambat. Aplikasi memakai data login terakhir agar tidak perlu login ulang.'
          : (error.message || 'Gagal mengambil profil user.')
      )
    } finally {
      if (currentUserIdRef.current === fetchingForUserId) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const cachedUser = readCachedSessionUser()
    const cachedProfile = readCachedProfile(cachedUser?.id)
    if (cachedUser && cachedProfile) {
      setUser(cachedUser)
      setProfile(cachedProfile)
      currentUserIdRef.current = cachedUser.id
    }

    getSessionWithTimeout()
      .then(async ({ data: { session } }) => {
        await hydrateSession(session)
      })
      .catch(async (error) => {
        currentUserIdRef.current = null
        setUser(null)
        setProfile(null)
        setProfileError(error?.message || 'Sesi login tidak bisa diverifikasi. Silakan login ulang.')
        clearLocalAuthState()
        setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const nextUserId = session?.user?.id ?? null
        const sameUser = currentUserIdRef.current && currentUserIdRef.current === nextUserId
        const hasUsableProfile = !!profileRef.current || !!readCachedProfile(nextUserId)
        const isStableSessionRefresh = sameUser && hasUsableProfile && session?.user

        // On mobile, returning from camera/file picker can trigger auth events
        // even though the user session is still healthy. Keep the current screen
        // visible while we re-verify profile data for the same signed-in user.
        if (!isStableSessionRefresh) {
          setLoading(true)
        }

        await hydrateSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signInStaff = async (email) => {
    let res
    try {
      res = await fetch(`${BACKEND_BASE}/api/auth/staff-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
    } catch {
      return { error: { message: 'Tidak dapat terhubung ke server. Pastikan backend sedang berjalan.' } }
    }

    let payload = null
    try {
      payload = await res.json()
    } catch {
      // Ignore JSON parsing failures.
    }

    if (!res.ok) {
      return {
        error: {
          message: payload?.detail || 'Login staff gagal diproses.',
        },
      }
    }

    const accessToken = payload?.access_token
    const refreshToken = payload?.refresh_token
    if (!accessToken || !refreshToken) {
      return {
        error: {
          message: 'Session login staff tidak lengkap.',
        },
      }
    }

    return await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileError('')
    clearLocalAuthState()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileError, signIn, signInStaff, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

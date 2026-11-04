// src/context/AuthContext.jsx
// Sown App — Working authentication context with Supabase integration

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, authLinkOnLoad } from '../lib/supabase'

// ─── Password recovery flag ───────────────────────────────────────────────────
// True from the moment a recovery link is opened until the user sets a new
// password or cancels. Kept in sessionStorage so a reload of the
// /password-reset page doesn't lose it (the link's tokens are gone by then).
const RECOVERY_KEY = 'sown_password_recovery'

function readRecoveryFlag() {
  try { return sessionStorage.getItem(RECOVERY_KEY) === '1' } catch { return false }
}

function writeRecoveryFlag(on) {
  try {
    if (on) sessionStorage.setItem(RECOVERY_KEY, '1')
    else sessionStorage.removeItem(RECOVERY_KEY)
  } catch { /* storage blocked: the in-memory state still works */ }
}

if (authLinkOnLoad.recovery) writeRecoveryFlag(true)

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recoveryMode, setRecoveryMode] = useState(readRecoveryFlag)

  const setRecovery = (on) => {
    writeRecoveryFlag(on)
    setRecoveryMode(on)
  }

  useEffect(() => {
    let isMounted = true

    // Subscribe before anything is awaited, so no event is missed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, !!session)
        if (!isMounted) return
        if (event === 'PASSWORD_RECOVERY') setRecovery(true)
        if (event === 'SIGNED_OUT') setRecovery(false)
        setSession(session)
        setUser(session?.user ?? null)
        setError(null)
      }
    )

    // Store auth callback for OAuth redirects
    if (typeof window !== 'undefined') {
      window.authStateCallback = (_event, session) => {
        console.log('OAuth callback triggered:', _event, !!session)
        if (isMounted) {
          setSession(session)
          setUser(session?.user ?? null)
          setError(null)
        }
      }
    }

    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...')

        // Waits for the client to finish reading any auth link in the URL
        const { data: { session }, error } = await supabase.auth.getSession()

        if (isMounted) {
          if (error) {
            console.error('Session error:', error)
            setError(error.message)
          } else {
            console.log('Session found:', !!session)
            setSession(session)
            setUser(session?.user ?? null)
          }
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        if (isMounted) {
          setError('Authentication system error')
          setLoading(false)
        }
      }
    }

    initializeAuth()

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ── Sign out helper ────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
      setRecovery(false)
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // ── Context value ─────────────────────────────────────────────────────────
  const value = {
    user,
    session,
    loading,
    error,
    isAuthenticated: !!user,
    signOut,
    // Password recovery: true while the user must set a new password
    recoveryMode,
    endRecovery: () => setRecovery(false),
    // Error from an auth link opened on this page load (e.g. expired link)
    linkError: authLinkOnLoad.error,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

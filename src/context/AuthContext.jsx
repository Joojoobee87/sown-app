// src/context/AuthContext.jsx
// Sown App — Working authentication context with Supabase integration

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true
    let subscription = null

    const initializeAuth = async () => {
      try {
        console.log('Initializing authentication...')
        
        // Get current session
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

        // Listen for auth changes
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            console.log('Auth state changed:', _event, !!session)
            if (isMounted) {
              setSession(session)
              setUser(session?.user ?? null)
              setError(null)
            }
          }
        ).catch((error) => {
          console.error('Auth state change error:', error)
          setError(error.message)
        })
        
        subscription = authSub

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
      if (subscription) subscription.unsubscribe()
    }
  }, [])

  // ── Sign out helper ────────────────────────────────────────────────────────
  const signOut = async () => {
    try {
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
    signOut
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

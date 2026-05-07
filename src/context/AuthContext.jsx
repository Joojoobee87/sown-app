// src/context/AuthContext.jsx
// Sown App — Robust authentication context with fallbacks

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let isMounted = true
    let subscription = null

    const initializeAuth = async () => {
      try {
        // Check if we have a real Supabase client
        if (!supabase || !supabase.auth) {
          console.warn('No Supabase client available - redirecting to auth')
          if (isMounted) {
            setLoading(false)
            setError('Authentication not available')
          }
          return
        }

        // Get current session
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (isMounted) {
          if (error) {
            console.error('Session error:', error)
            setError(error.message)
          } else {
            setSession(session)
            setUser(session?.user ?? null)
          }
          setLoading(false)
        }

        // Listen for auth changes
        const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (isMounted) {
              setSession(session)
              setUser(session?.user ?? null)
              setError(null)
            }
          }
        )
        
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
      if (supabase && supabase.auth) {
        await supabase.auth.signOut()
      }
    } catch (error) {
      console.error('Sign out error:', error)
    }
    // onAuthStateChange above will handle setting user to null
  }

  // ── Check if user has Pro ──────────────────────────────────────────────────
  const isPro = async () => {
    if (!user) return false
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('is_pro')
        .eq('user_id', user.id)
        .single()
      
      if (error) {
        console.error('Pro status check error:', error)
        return false
      }
      
      return data?.is_pro || false
    } catch (err) {
      console.error('Pro status error:', err)
      return false
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
    isPro
  }

  // Debug logging
  console.log('AuthContext: State updated:', { 
    user: !!user, 
    session: !!session, 
    loading, 
    error, 
    isAuthenticated: !!user 
  })

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

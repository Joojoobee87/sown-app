// src/context/AuthContext.jsx
// Sown App — Global authentication context
// Paste this file into src/context/AuthContext.jsx (create the context folder)
//
// What this does:
//   1. Wraps the entire app and makes the current user available everywhere
//   2. Listens for Supabase auth state changes (sign in, sign out, token refresh)
//   3. Exposes useAuth() hook for any component to access the user
//   4. Handles the loading state while Supabase checks for an existing session
//
// Usage in any component:
//   import { useAuth } from '../context/AuthContext'
//   const { user, session, loading, signOut } = useAuth()

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)  // true until first session check

  useEffect(() => {
    // 1. Get the current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 2. Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    // 3. Clean up listener on unmount
    return () => subscription.unsubscribe()
  }, [])

  // ── Sign out helper ────────────────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut()
    // onAuthStateChange above will handle setting user to null
  }

  // ── Check if user has Pro ──────────────────────────────────────────────────
  // This checks the user_profiles table in Supabase.
  // Call this where you need to gate Pro features.
  const checkPro = async () => {
    if (!user) return false
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('is_pro, pro_expiry')
        .eq('user_id', user.id)
        .single()

      if (!data || !data.is_pro) return false
      if (!data.pro_expiry) return true  // lifetime Pro (no expiry set)

      // Check expiry
      return new Date(data.pro_expiry) > new Date()
    } catch {
      return false
    }
  }

  const value = {
    user,
    session,
    loading,
    signOut,
    checkPro,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return context
}

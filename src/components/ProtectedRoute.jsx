// src/components/ProtectedRoute.jsx
// Sown App — Route guard for authenticated screens
// Paste this file into src/components/ProtectedRoute.jsx
//
// What this does:
//   Wraps any route that requires the user to be signed in.
//   If not authenticated → redirects to /auth (sign in screen)
//   While checking auth → shows a branded loading screen
//   If authenticated → renders the child component normally
//
// Usage in App.jsx:
//   <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />

import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// ─── Seed S loading screen ────────────────────────────────────────────────────
function SownLoader() {
  return (
    <div className="min-h-screen bg-fern flex flex-col items-center
                    justify-center gap-4">
      {/* Animated Seed S */}
      <div className="animate-pulse">
        <svg width="36" height="48" viewBox="0 0 36 48">
          <ellipse cx="18" cy="13" rx="11" ry="13" fill="#D4DCCA"/>
          <line x1="11" y1="6" x2="18" y2="17"
            stroke="#4A5940" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
          <ellipse cx="18" cy="35" rx="11" ry="13" fill="#D4DCCA"
            transform="rotate(180 18 35)"/>
          <line x1="14" y1="28" x2="21" y2="39"
            stroke="#4A5940" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
        </svg>
      </div>
      <p className="font-serif text-sage text-xl tracking-widest">Sown</p>
      <div className="flex gap-1.5">
        <div className="w-1.5 h-1.5 bg-moss rounded-full animate-bounce"
             style={{ animationDelay: '0ms' }} />
        <div className="w-1.5 h-1.5 bg-moss rounded-full animate-bounce"
             style={{ animationDelay: '150ms' }} />
        <div className="w-1.5 h-1.5 bg-moss rounded-full animate-bounce"
             style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// ─── Protected Route ──────────────────────────────────────────────────────────
export default function ProtectedRoute({ children }) {
  console.log('ProtectedRoute: Starting authentication check')
  
  try {
    const { isAuthenticated, loading, error } = useAuth()
    
    console.log('ProtectedRoute: Auth state:', { isAuthenticated, loading, error })

    // Show loader while checking auth
    if (loading) {
      console.log('ProtectedRoute: Still loading, showing loader')
      return <SownLoader />
    }

    // If there's an auth error, still try to redirect to auth
    if (error) {
      console.warn('Auth error, redirecting to auth:', error)
      return <Navigate to="/auth" replace />
    }

    // Not signed in — redirect to auth screen
    if (!isAuthenticated) {
      console.log('ProtectedRoute: Not authenticated, redirecting to /auth')
      return <Navigate to="/auth" replace />
    }

    // Authenticated — render the screen
    console.log('ProtectedRoute: Authenticated, showing children')
    return children

  } catch (err) {
    // If useAuth hook fails, redirect to auth anyway
    console.warn('ProtectedRoute error, redirecting to auth:', err)
    return <Navigate to="/auth" replace />
  }
}

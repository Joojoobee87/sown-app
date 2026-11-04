import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function PasswordReset() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()
  const {
    recoveryMode, endRecovery, signOut, isAuthenticated,
    loading: authLoading, linkError,
  } = useAuth()

  // Leaving without setting a password signs the user out again, so a
  // reset link can't be used as a way to sign in.
  const cancel = async () => {
    if (recoveryMode && isAuthenticated) await signOut()
    else endRecovery()
    navigate('/auth', { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password || !confirmPassword) {
      setError('Please fill in both fields.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      // Already signed in by the reset link, so go straight to the garden
      setTimeout(() => {
        endRecovery()
        navigate('/', { replace: true })
      }, 2500)
    }
  }

  // Reading the reset link and signing in
  if (authLoading && !success) {
    return (
      <div className="min-h-screen bg-fern flex flex-col items-center justify-center gap-4">
        <div className="animate-pulse">
          <svg width="36" height="48" viewBox="0 0 36 48">
            <ellipse cx="18" cy="13" rx="11" ry="13" fill="#D4DCCA"/>
            <ellipse cx="18" cy="35" rx="11" ry="13" fill="#D4DCCA" transform="rotate(180 18 35)"/>
          </svg>
        </div>
        <p className="font-serif text-sage text-xl tracking-widest">Sown</p>
        <p className="text-moss text-xs tracking-widest">Verifying your reset link…</p>
      </div>
    )
  }

  // Opened without a working reset link (expired, already used, or typed in)
  if (!success && (!recoveryMode || !isAuthenticated)) {
    return (
      <div className="min-h-screen bg-fern flex flex-col items-center justify-center gap-4 px-8 text-center">
        <svg width="36" height="48" viewBox="0 0 36 48">
          <ellipse cx="18" cy="13" rx="11" ry="13" fill="#D4DCCA"/>
          <ellipse cx="18" cy="35" rx="11" ry="13" fill="#D4DCCA" transform="rotate(180 18 35)"/>
        </svg>
        <p className="font-serif text-sage text-xl tracking-widest">Sown</p>
        <p className="text-sage text-sm leading-relaxed">
          This reset link has expired or has already been used.
        </p>
        {linkError && (
          <p className="text-moss text-xs leading-relaxed">{linkError}</p>
        )}
        <button
          onClick={cancel}
          className="mt-2 bg-sage text-fern text-sm font-medium px-6 py-3 rounded-xl tracking-wide active:opacity-80"
        >
          Request a new link
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-fern flex flex-col">
      <div className="flex flex-col items-center justify-center pt-14 pb-8 px-6">
        <svg width="36" height="48" viewBox="0 0 36 48">
          <ellipse cx="18" cy="13" rx="11" ry="13" fill="#D4DCCA"/>
          <ellipse cx="18" cy="35" rx="11" ry="13" fill="#D4DCCA" transform="rotate(180 18 35)"/>
        </svg>
        <h1 className="font-serif text-sage text-4xl tracking-widest mt-4 mb-1">Sown</h1>
        <div className="w-8 h-px bg-clay mb-3" />
        <p className="text-moss text-xs tracking-widest uppercase">Set your new password</p>
      </div>

      <div className="flex-1 bg-parchment rounded-t-3xl px-6 pt-6 pb-10">
        {success ? (
          <div className="flex flex-col gap-4">
            <div className="bg-leaf rounded-xl px-4 py-3">
              <p className="text-sm text-fern leading-relaxed">
                Password updated! Taking you to your garden…
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="bg-clay/10 border border-clay/40 rounded-xl px-4 py-3 text-sm text-clay">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-subtle uppercase tracking-widest font-medium">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                className="w-full bg-white border border-moss/40 rounded-xl px-4 py-3 text-sm text-dark placeholder:text-subtle/50 focus:outline-none focus:border-fern transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-subtle uppercase tracking-widest font-medium">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat your new password"
                autoComplete="new-password"
                className="w-full bg-white border border-moss/40 rounded-xl px-4 py-3 text-sm text-dark placeholder:text-subtle/50 focus:outline-none focus:border-fern transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fern text-sage font-medium py-4 rounded-xl tracking-wide text-sm mt-1 disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {loading ? 'Saving…' : 'Set new password'}
            </button>

            <button
              type="button"
              onClick={cancel}
              className="text-subtle text-xs text-center underline underline-offset-2"
            >
              Cancel and go back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

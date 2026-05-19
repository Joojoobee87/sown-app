import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function PasswordReset() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [ready, setReady] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

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
      setTimeout(() => navigate('/auth'), 2500)
    }
  }

  // Waiting for the PASSWORD_RECOVERY event from the email link
  if (!ready && !success) {
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
        <button
          onClick={() => navigate('/auth')}
          className="mt-4 text-moss text-xs underline underline-offset-2"
        >
          Back to sign in
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
                Password updated! Redirecting you to sign in…
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
              onClick={() => navigate('/auth')}
              className="text-subtle text-xs text-center underline underline-offset-2"
            >
              Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

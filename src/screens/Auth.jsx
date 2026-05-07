// src/screens/Auth.jsx
// Sown App — Sign up / Sign in screen
// Paste this file into src/screens/Auth.jsx
//
// What this does:
//   1. Sign up with email + password
//   2. Sign in with email + password
//   3. Magic link (passwordless email sign in) — recommended for mobile
//   4. Grow Code redemption on sign up (unlocks Pro trial)
//   5. Handles all Supabase auth errors gracefully
//   6. Redirects to Home on successful auth
//
// Supabase handles:
//   - Email verification
//   - Password reset emails
//   - Session management
//   - JWT tokens

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// ─── Seed S mark ─────────────────────────────────────────────────────────────
function SeedMark({ size = 48, color = '#D4DCCA' }) {
  const h = size, w = size * 0.75
  const rx = w * 0.45, ry = h * 0.3
  const cy1 = h * 0.28, cy2 = h * 0.72
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <ellipse cx={w/2} cy={cy1} rx={rx} ry={ry} fill={color}/>
      <line x1={w*0.25} y1={h*0.1} x2={w*0.55} y2={h*0.35}
        stroke="#4A5940" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
      <ellipse cx={w/2} cy={cy2} rx={rx} ry={ry} fill={color}
        transform={`rotate(180 ${w/2} ${cy2})`}/>
      <line x1={w*0.35} y1={h*0.62} x2={w*0.65} y2={h*0.87}
        stroke="#4A5940" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
    </svg>
  )
}

// ─── Input field ──────────────────────────────────────────────────────────────
function Field({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-subtle uppercase tracking-widest font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-white border border-moss/40 rounded-xl
                     px-4 py-3 text-sm text-dark placeholder:text-subtle/50
                     focus:outline-none focus:border-fern transition-colors
                     pr-10"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle"
          >
            {show
              ? <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
              : <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Error / success banner ───────────────────────────────────────────────────
function Banner({ type, message }) {
  if (!message) return null
  const styles = {
    error:   'bg-clay/10 border-clay/40 text-clay',
    success: 'bg-leaf border-moss/40 text-fern',
    info:    'bg-leaf border-moss/40 text-fern',
  }
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm
                     leading-relaxed ${styles[type] || styles.info}`}>
      {message}
    </div>
  )
}

// ─── Grow Code field ──────────────────────────────────────────────────────────
function GrowCodeField({ value, onChange, status }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-subtle uppercase tracking-widest font-medium">
        Grow Code <span className="normal-case text-subtle/60">(optional)</span>
      </label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value.toUpperCase())}
          placeholder="e.g. SOWN-2026-ABCD"
          className="w-full bg-white border border-moss/40 rounded-xl
                     px-4 py-3 text-sm text-dark placeholder:text-subtle/50
                     focus:outline-none focus:border-fern transition-colors
                     font-mono tracking-wider pr-10"
        />
        {status === 'valid' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-fern">
            ✓
          </span>
        )}
        {status === 'invalid' && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-clay">
            ✗
          </span>
        )}
      </div>
      <p className="text-xs text-subtle">
        Found inside your Sown product packaging. Unlocks a free Pro trial.
      </p>
    </div>
  )
}

// ─── Main Auth screen ─────────────────────────────────────────────────────────
export default function Auth() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ── State ──────────────────────────────────────────────────────────
  const [mode, setMode]           = useState('signin')  // 'signin' | 'signup' | 'magic' | 'reset' | 'verify'
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [name, setName]           = useState('')
  const [growCode, setGrowCode]   = useState('')
  const [codeStatus, setCodeStatus] = useState(null)  // null | 'valid' | 'invalid'
  const [loading, setLoading]     = useState(false)
  const [banner, setBanner]       = useState(null)    // { type, message }
  const [verifying, setVerifying] = useState(false)

  // ── Handle email verification from URL ───────────────────────────────────
  useEffect(() => {
    const verifyToken = async () => {
      const accessToken = searchParams.get('access_token')
      const refreshToken = searchParams.get('refresh_token')
      
      if (accessToken && refreshToken) {
        setMode('verify')
        setVerifying(true)
        try {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (error) {
            setBanner({ type: 'error', message: 'Email verification failed. Please try again.' })
            navigate('/auth')
          } else {
            setBanner({ type: 'success', message: 'Email verified! You can now sign in.' })
            setTimeout(() => navigate('/'), 2000)
          }
        } catch (err) {
          setBanner({ type: 'error', message: 'Email verification failed. Please try again.' })
          navigate('/auth')
        } finally {
          setVerifying(false)
        }
      }
    }

    verifyToken()
  }, [searchParams, navigate])

  const showBanner = (type, message) => setBanner({ type, message })
  const clearBanner = () => setBanner(null)

  // ── Validate Grow Code against Supabase ───────────────────────────────────
  const validateGrowCode = async (code) => {
    if (!code || code.length < 8) { setCodeStatus(null); return }
    try {
      const { data } = await supabase
        .from('grow_codes')
        .select('id, redeemed')
        .eq('code', code)
        .single()

      if (data && !data.redeemed) setCodeStatus('valid')
      else setCodeStatus('invalid')
    } catch {
      setCodeStatus('invalid')
    }
  }

  const handleGrowCodeChange = (val) => {
    setGrowCode(val)
    validateGrowCode(val)
  }

  // ── Sign in ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      showBanner('error', 'Please enter your email and password.')
      return
    }
    setLoading(true)
    clearBanner()
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      navigate('/')
    } catch (err) {
      showBanner('error', friendlyError(err.message))
    } finally {
      setLoading(false)
    }
  }

  // ── Sign up ────────────────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault()
    if (!email || !password) {
      showBanner('error', 'Please enter your email and a password.')
      return
    }
    if (password.length < 8) {
      showBanner('error', 'Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    clearBanner()
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name || null },
        },
      })
      if (error) throw error

      // Redeem Grow Code if provided and valid
      if (growCode && codeStatus === 'valid' && data.user) {
        await redeemGrowCode(growCode, data.user.id)
      }

      showBanner('success',
        'Account created! Check your email to confirm your address, then sign in.'
      )
      setMode('signin')
    } catch (err) {
      showBanner('error', friendlyError(err.message))
    } finally {
      setLoading(false)
    }
  }

  // ── Magic link ────────────────────────────────────────────────────────────
  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email) {
      showBanner('error', 'Please enter your email address.')
      return
    }
    setLoading(true)
    clearBanner()
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) throw error
      showBanner('success',
        `Magic link sent to ${email}. Check your inbox and tap the link to sign in.`
      )
    } catch (err) {
      showBanner('error', friendlyError(err.message))
    } finally {
      setLoading(false)
    }
  }

  // ── Password reset ────────────────────────────────────────────────────────
  const handleReset = async (e) => {
    e.preventDefault()
    if (!email) {
      showBanner('error', 'Please enter your email address.')
      return
    }
    setLoading(true)
    clearBanner()
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      showBanner('success',
        `Password reset email sent to ${email}. Check your inbox.`
      )
    } catch (err) {
      showBanner('error', friendlyError(err.message))
    } finally {
      setLoading(false)
    }
  }

  // ── Redeem Grow Code ───────────────────────────────────────────────────────
  const redeemGrowCode = async (code, userId) => {
    try {
      // 1. Get code details
      const { data: codeRow } = await supabase
        .from('grow_codes')
        .select('id, pro_months, product')
        .eq('code', code)
        .eq('redeemed', false)
        .single()

      if (!codeRow) return

      // 2. Mark code as redeemed
      await supabase
        .from('grow_codes')
        .update({
          redeemed:    true,
          redeemed_by: userId,
          redeemed_at: new Date().toISOString(),
        })
        .eq('id', codeRow.id)

      // 3. Set Pro expiry on user profile
      // You'll need a user_profiles table for this — see note below
      const proExpiry = new Date()
      proExpiry.setMonth(proExpiry.getMonth() + codeRow.pro_months)

      await supabase
        .from('user_profiles')
        .upsert({
          user_id:    userId,
          is_pro:     true,
          pro_expiry: proExpiry.toISOString(),
          pro_source: `grow_code:${code}`,
        })

    } catch (err) {
      // Silent fail — code redemption can be retried
      console.warn('Grow code redemption failed:', err)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-fern flex flex-col">

      {/* Brand header */}
      <div className="flex flex-col items-center justify-center
                      pt-14 pb-8 px-6">
        <SeedMark size={56} />
        <h1 className="font-serif text-sage text-4xl tracking-widest mt-4 mb-1">
          Sown
        </h1>
        <div className="w-8 h-px bg-clay mb-3" />
        <p className="text-moss text-xs tracking-widest uppercase text-center">
          Your intelligent garden companion
        </p>
      </div>

      {/* Auth card */}
      <div className="flex-1 bg-parchment rounded-t-3xl px-6 pt-6 pb-10">

        {/* Mode tabs */}
        <div className="flex gap-1 bg-leaf rounded-xl p-1 mb-6">
          <button
            onClick={() => { setMode('signin'); clearBanner() }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium
                        tracking-wide transition-colors
                        ${mode === 'signin' || mode === 'magic' || mode === 'reset'
                          ? 'bg-white text-fern shadow-sm'
                          : 'text-subtle'}`}
          >
            Sign in
          </button>
          <button
            onClick={() => { setMode('signup'); clearBanner() }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium
                        tracking-wide transition-colors
                        ${mode === 'signup'
                          ? 'bg-white text-fern shadow-sm'
                          : 'text-subtle'}`}
          >
            Create account
          </button>
        </div>

        {/* Banner */}
        {banner && (
          <div className="mb-4">
            <Banner type={banner.type} message={banner.message} />
          </div>
        )}

        {/* ── Email verification ─────────────────────────────────────────── */}
        {mode === 'verify' && (
          <div className="flex flex-col gap-4">
            <div className="bg-leaf rounded-xl px-4 py-3">
              <p className="text-sm text-fern leading-relaxed">
                {verifying ? 'Verifying your email address...' : 'Email verified! You can now sign in.'}
              </p>
            </div>
            
            {!verifying && (
              <button
                onClick={() => setMode('signin')}
                className="w-full bg-fern text-sage font-medium py-4
                           rounded-xl tracking-wide text-sm mt-4
                           active:bg-moss/30 transition-colors"
              >
                Continue to sign in
              </button>
            )}
          </div>
        )}

        {/* ── Sign in form ─────────────────────────────────────────────── */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="flex flex-col gap-4">
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Your password"
              autoComplete="current-password"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fern text-sage font-medium py-4
                         rounded-xl tracking-wide text-sm mt-1
                         disabled:opacity-50 active:opacity-80
                         transition-opacity"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-moss/30" />
              <p className="text-xs text-subtle">or</p>
              <div className="flex-1 h-px bg-moss/30" />
            </div>

            <button
              type="button"
              onClick={() => { setMode('magic'); clearBanner() }}
              className="w-full bg-leaf border border-moss/40 text-fern
                         font-medium py-3.5 rounded-xl tracking-wide text-sm
                         active:bg-moss/30 transition-colors"
            >
              Send magic link instead
            </button>

            <button
              type="button"
              onClick={() => { setMode('reset'); clearBanner() }}
              className="text-subtle text-xs text-center underline
                         underline-offset-2"
            >
              Forgot your password?
            </button>
          </form>
        )}

        {/* ── Magic link form ───────────────────────────────────────────── */}
        {mode === 'magic' && (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-4">
            <div className="bg-leaf rounded-xl px-4 py-3">
              <p className="text-sm text-fern leading-relaxed">
                Enter your email and we'll send a link that signs you in instantly — no password needed.
              </p>
            </div>

            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fern text-sage font-medium py-4
                         rounded-xl tracking-wide text-sm
                         disabled:opacity-50 active:opacity-80
                         transition-opacity"
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('signin'); clearBanner() }}
              className="text-subtle text-xs text-center underline
                         underline-offset-2"
            >
              Sign in with password instead
            </button>
          </form>
        )}

        {/* ── Password reset form ───────────────────────────────────────── */}
        {mode === 'reset' && (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div className="bg-leaf rounded-xl px-4 py-3">
              <p className="text-sm text-fern leading-relaxed">
                Enter your email and we'll send a link to reset your password.
              </p>
            </div>

            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fern text-sage font-medium py-4
                         rounded-xl tracking-wide text-sm
                         disabled:opacity-50 active:opacity-80
                         transition-opacity"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>

            <button
              type="button"
              onClick={() => { setMode('signin'); clearBanner() }}
              className="text-subtle text-xs text-center underline
                         underline-offset-2"
            >
              Back to sign in
            </button>
          </form>
        )}

        {/* ── Sign up form ──────────────────────────────────────────────── */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="flex flex-col gap-4">
            <Field
              label="Your name (optional)"
              type="text"
              value={name}
              onChange={setName}
              placeholder="Jo Frances"
              autoComplete="name"
            />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />

            {/* Grow Code field */}
            <GrowCodeField
              value={growCode}
              onChange={handleGrowCodeChange}
              status={codeStatus}
            />

            {codeStatus === 'valid' && (
              <Banner type="success"
                message="Grow Code valid — your Pro trial will be activated on sign up." />
            )}
            {codeStatus === 'invalid' && growCode.length >= 8 && (
              <Banner type="error"
                message="This code doesn't look right or has already been used." />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-fern text-sage font-medium py-4
                         rounded-xl tracking-wide text-sm mt-1
                         disabled:opacity-50 active:opacity-80
                         transition-opacity"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-xs text-subtle text-center leading-relaxed">
              By creating an account you agree to our{' '}
              <span className="underline underline-offset-2 cursor-pointer">
                Terms of Service
              </span>{' '}
              and{' '}
              <span className="underline underline-offset-2 cursor-pointer">
                Privacy Policy
              </span>.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Error message helper ─────────────────────────────────────────────────────
// Supabase returns technical error messages — translate to friendly copy.
function friendlyError(message = '') {
  const m = message.toLowerCase()
  if (m.includes('invalid login'))    return 'Email or password is incorrect. Please try again.'
  if (m.includes('email not confirmed')) return 'Please check your email and confirm your address before signing in.'
  if (m.includes('already registered')) return 'An account with this email already exists. Try signing in instead.'
  if (m.includes('password'))         return 'Password must be at least 8 characters.'
  if (m.includes('rate limit'))       return 'Too many attempts. Please wait a moment and try again.'
  if (m.includes('network'))          return 'Connection error. Check your internet and try again.'
  return 'Something went wrong. Please try again.'
}

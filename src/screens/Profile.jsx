import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  )
}

// ─── Editable field ───────────────────────────────────────────────────────────
function EditableField({ label, value, onSave, type = 'text', hint }) {
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(value || '')
  const [saving, setSaving]     = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success'|'error', msg }

  const handleSave = async () => {
    if (draft === value || !draft.trim()) { setEditing(false); return }
    setSaving(true)
    setFeedback(null)
    try {
      await onSave(draft.trim())
      setFeedback({ type: 'success', msg: 'Saved' })
      setTimeout(() => setFeedback(null), 2500)
      setEditing(false)
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Could not save — please try again' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setDraft(value || '')
    setEditing(false)
    setFeedback(null)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
          {label}
        </label>
        {!editing && (
          <button
            onClick={() => { setDraft(value || ''); setEditing(true) }}
            className="text-fern active:opacity-60 transition-opacity flex items-center gap-1
                       text-xs font-medium"
          >
            <EditIcon /> Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full bg-white border border-fern rounded-xl
                       px-4 py-3 text-sm text-dark
                       focus:outline-none focus:ring-2 focus:ring-fern/30
                       transition-colors"
          />
          {hint && (
            <p className="text-xs text-subtle leading-relaxed">{hint}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 bg-leaf text-fern text-sm font-medium
                         py-2.5 rounded-xl active:opacity-70 transition-opacity"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-fern text-sage text-sm font-medium
                         py-2.5 rounded-xl disabled:opacity-50
                         active:opacity-80 transition-opacity flex items-center justify-center gap-2"
            >
              {saving
                ? <span className="w-4 h-4 border-2 border-sage/30 border-t-sage rounded-full animate-spin" />
                : <><CheckIcon /> Save</>
              }
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-dark py-1">{value || <span className="text-subtle italic">Not set</span>}</p>
      )}

      {feedback && (
        <p className={`text-xs ${feedback.type === 'success' ? 'text-fern' : 'text-clay'}`}>
          {feedback.msg}
        </p>
      )}
    </div>
  )
}

// ─── Change password section ──────────────────────────────────────────────────
function ChangePassword() {
  const [open, setOpen]           = useState(false)
  const [current, setCurrent]     = useState('')
  const [newPass, setNewPass]     = useState('')
  const [confirm, setConfirm]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [feedback, setFeedback]   = useState(null)
  const [showNew, setShowNew]     = useState(false)

  const reset = () => {
    setCurrent(''); setNewPass(''); setConfirm('')
    setFeedback(null); setOpen(false)
  }

  const handleSave = async () => {
    if (newPass.length < 8) {
      setFeedback({ type: 'error', msg: 'New password must be at least 8 characters.' })
      return
    }
    if (newPass !== confirm) {
      setFeedback({ type: 'error', msg: 'Passwords don\'t match.' })
      return
    }
    setSaving(true)
    setFeedback(null)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPass })
      if (error) throw error
      setFeedback({ type: 'success', msg: 'Password updated successfully.' })
      setTimeout(reset, 2000)
    } catch (err) {
      setFeedback({ type: 'error', msg: err.message || 'Could not update password.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-sm text-fern font-medium underline underline-offset-2
                     active:opacity-60 transition-opacity"
        >
          Change password
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-subtle uppercase tracking-widest font-medium">
            Change password
          </p>

          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              placeholder="New password"
              value={newPass}
              onChange={e => setNewPass(e.target.value)}
              className="w-full bg-white border border-moss/40 rounded-xl
                         px-4 py-3 text-sm text-dark placeholder:text-subtle/50
                         focus:outline-none focus:border-fern transition-colors pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth="2">
                {showNew
                  ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></>
                  : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                }
              </svg>
            </button>
          </div>

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="w-full bg-white border border-moss/40 rounded-xl
                       px-4 py-3 text-sm text-dark placeholder:text-subtle/50
                       focus:outline-none focus:border-fern transition-colors"
          />

          <p className="text-xs text-subtle">At least 8 characters.</p>

          {feedback && (
            <p className={`text-xs ${feedback.type === 'success' ? 'text-fern' : 'text-clay'}`}>
              {feedback.msg}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 bg-leaf text-fern text-sm font-medium
                         py-2.5 rounded-xl active:opacity-70 transition-opacity"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !newPass || !confirm}
              className="flex-1 bg-fern text-sage text-sm font-medium
                         py-2.5 rounded-xl disabled:opacity-50
                         active:opacity-80 transition-opacity"
            >
              {saving ? 'Saving...' : 'Update'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Profile screen ──────────────────────────────────────────────────────
export default function Profile() {
  const navigate    = useNavigate()
  const { user }    = useAuth()

  const fullName    = user?.user_metadata?.full_name || ''
  const email       = user?.email || ''
  const provider    = user?.app_metadata?.provider || 'email'
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null

  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email[0]?.toUpperCase() || 'S'

  const updateName = async (name) => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
    if (error) throw error
  }

  const updateEmail = async (newEmail) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) throw error
  }

  const isOAuth = provider !== 'email'

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-10">

      {/* Header */}
      <div className="bg-fern px-4 pt-4 pb-10">
        <button
          onClick={() => navigate(-1)}
          className="text-sage/80 active:text-sage transition-colors mb-4
                     flex items-center gap-1.5"
        >
          <BackIcon />
          <span className="text-sm">Back</span>
        </button>

        {/* Avatar */}
        <div className="flex flex-col items-center pt-2">
          <div className="w-20 h-20 bg-dark/30 rounded-full flex items-center justify-center">
            <span className="font-serif text-sage text-3xl leading-none">{initials}</span>
          </div>
          {fullName && (
            <p className="text-sage font-medium text-lg mt-3">{fullName}</p>
          )}
          {memberSince && (
            <p className="text-moss text-xs mt-1">Member since {memberSince}</p>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="mx-4 -mt-5 flex flex-col gap-3">

        {/* Personal details */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-5 flex flex-col gap-5">
          <p className="text-xs text-subtle uppercase tracking-widest font-medium -mb-1">
            Personal details
          </p>

          <EditableField
            label="Full name"
            value={fullName}
            onSave={updateName}
          />

          <div className="h-px bg-moss/15" />

          <EditableField
            label="Email address"
            value={email}
            type="email"
            onSave={isOAuth ? null : updateEmail}
            hint={isOAuth
              ? undefined
              : 'We\'ll send a confirmation to your new address before it takes effect.'}
          />
          {isOAuth && (
            <p className="text-xs text-subtle -mt-3">
              Your email is managed by your {provider} account.
            </p>
          )}
        </div>

        {/* Security */}
        {!isOAuth && (
          <div className="bg-white rounded-2xl shadow-sm px-5 py-5 flex flex-col gap-4">
            <p className="text-xs text-subtle uppercase tracking-widest font-medium">
              Security
            </p>
            <ChangePassword />
          </div>
        )}

        {/* Account info */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-5 flex flex-col gap-3">
          <p className="text-xs text-subtle uppercase tracking-widest font-medium">
            Account
          </p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-subtle">Sign-in method</span>
            <span className="text-sm text-dark capitalize font-medium">{provider}</span>
          </div>
          {memberSince && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-subtle">Member since</span>
              <span className="text-sm text-dark font-medium">{memberSince}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-subtle">Account ID</span>
            <span className="text-xs text-subtle/60 font-mono">
              {user?.id?.slice(0, 8)}…
            </span>
          </div>
        </div>

        {/* Danger zone */}
        <div className="bg-white rounded-2xl shadow-sm px-5 py-5">
          <p className="text-xs text-subtle uppercase tracking-widest font-medium mb-3">
            Danger zone
          </p>
          <p className="text-sm text-subtle leading-relaxed mb-3">
            Deleting your account is permanent and cannot be undone. All your plants,
            zones, and library data will be removed.
          </p>
          <button
            disabled
            className="text-sm text-clay/50 underline underline-offset-2 cursor-default"
          >
            Delete my account
          </button>
          <p className="text-xs text-subtle/50 mt-1">
            Contact support to request account deletion.
          </p>
        </div>

      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SownIcon from './SownIcon'
import { useAuth } from '../context/AuthContext'

// ─── Hamburger icon ───────────────────────────────────────────────────────────
function BurgerIcon({ size = 22, stroke = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <line x1="3" y1="6"  x2="21" y2="6"  stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
      <line x1="3" y1="18" x2="21" y2="18" stroke={stroke} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}

// ─── Menu icons ───────────────────────────────────────────────────────────────
function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  )
}
function LeafIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12"/>
      <path d="M12 12C12 12 5 10 5 4c4 0 7 2 7 8z"/>
      <path d="M12 12c0 0 7-2 7-8-4 0-7 2-7 8z"/>
    </svg>
  )
}
function ShopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 01-8 0"/>
    </svg>
  )
}
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

// ─── Slide-in menu drawer ─────────────────────────────────────────────────────
function MenuDrawer({ onClose }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const fullName = user?.user_metadata?.full_name || ''
  const email    = user?.email || ''
  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : (email[0] || 'S').toUpperCase()

  const go = (path) => { navigate(path); onClose() }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth')
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-dark/40 z-50"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 bottom-0 w-72 bg-parchment z-50
                      flex flex-col shadow-2xl">

        {/* Profile header */}
        <div className="bg-fern px-5 pt-14 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-dark/30 rounded-full flex items-center
                            justify-center flex-shrink-0">
              <span className="font-serif text-sage text-lg leading-none">
                {initials}
              </span>
            </div>
            <div className="min-w-0">
              {fullName && (
                <p className="text-sage font-medium text-sm truncate">{fullName}</p>
              )}
              <p className="text-moss text-xs truncate">{email}</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          <button
            onClick={() => go('/profile')}
            className="w-full text-left px-4 py-3 rounded-xl text-sm text-dark
                       font-medium active:bg-leaf transition-colors
                       flex items-center gap-3"
          >
            <span className="text-fern"><PersonIcon /></span>
            My Profile
          </button>

          <button
            onClick={() => go('/about')}
            className="w-full text-left px-4 py-3 rounded-xl text-sm text-dark
                       font-medium active:bg-leaf transition-colors
                       flex items-center gap-3"
          >
            <span className="text-fern"><LeafIcon /></span>
            About Sown
          </button>

          <a
            href="https://www.etsy.com/uk"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full text-left px-4 py-3 rounded-xl text-sm text-dark
                       font-medium active:bg-leaf transition-colors
                       flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-3">
              <span className="text-fern"><ShopIcon /></span>
              The Sown Shop
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
              className="text-subtle flex-shrink-0">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
              <polyline points="15,3 21,3 21,9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>

          {/* Divider */}
          <div className="h-px bg-moss/20 my-2 mx-1" />

          {/* Placeholder items */}
          <p className="px-4 pt-1 pb-2 text-[10px] text-subtle uppercase tracking-widest">
            Coming soon
          </p>
          {['Settings', 'Help & support', 'Send feedback'].map(label => (
            <button
              key={label}
              disabled
              className="w-full text-left px-4 py-2.5 rounded-xl text-sm
                         text-subtle/50 flex items-center gap-3 cursor-default"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 pb-8 pt-2 border-t border-moss/20">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-3 rounded-xl text-sm text-clay
                       font-medium active:bg-clay/10 transition-colors
                       flex items-center gap-3"
          >
            <span><SignOutIcon /></span>
            Sign out
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Top bar ──────────────────────────────────────────────────────────────────
export default function TopBar({ right }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="bg-fern px-4 py-3 flex items-center justify-between">
        {/* Brand icon — larger so the S-mark reads clearly */}
        <SownIcon size={44} fill="#D4DCCA" />

        {/* Wordmark */}
        <div className="flex flex-col items-center">
          <h1 className="font-serif text-sage text-2xl tracking-widest leading-none">
            Sown
          </h1>
          <p className="text-moss text-[9px] tracking-[0.25em] uppercase mt-0.5">
            Garden and Home
          </p>
        </div>

        {/* Right slot: custom override or burger */}
        <div className="w-11 flex justify-end">
          {right || (
            <button
              onClick={() => setMenuOpen(true)}
              className="text-sage/80 active:text-sage transition-colors p-1"
              aria-label="Open menu"
            >
              <BurgerIcon />
            </button>
          )}
        </div>
      </header>

      {menuOpen && <MenuDrawer onClose={() => setMenuOpen(false)} />}
    </>
  )
}

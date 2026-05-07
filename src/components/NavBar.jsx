import { Link, useLocation } from 'react-router-dom'

const tabs = [
  {
    path: '/',
    label: 'Home',
    icon: ({ active }) => (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
        stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
        <path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"/>
      </svg>
    ),
  },
  {
    path: '/scan',
    label: 'Scan',
    icon: ({ active }) => (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
        stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
        <path d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2M9 12h6"/>
      </svg>
    ),
  },
  {
    path: '/library',
    label: 'Library',
    icon: ({ active }) => (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
        stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 014 17V5a2 2 0 012-2h12a2 2 0 012 2v12H6.5"/>
      </svg>
    ),
  },
  {
    path: '/calendar',
    label: 'Calendar',
    icon: ({ active }) => (
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
        stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
  },
]

export default function NavBar() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                    bg-white border-t border-sage/60 flex justify-around
                    items-center px-2 py-2 z-50">
      {tabs.map(({ path, label, icon: Icon }) => {
        // Home tab is only active on exact match
        const active = path === '/'
          ? pathname === '/'
          : pathname.startsWith(path)

        return (
          <Link
            key={path}
            to={path}
            className="flex flex-col items-center gap-1 px-3 py-1"
          >
            <div className={`w-8 h-8 rounded-full flex items-center
                             justify-center transition-colors duration-200
                             ${active ? 'bg-fern' : 'bg-leaf'}`}>
              <Icon active={active} />
            </div>
            <span className={`text-[10px] tracking-wide transition-colors
                              ${active
                                ? 'text-fern font-medium'
                                : 'text-subtle'}`}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}

// Simple SVG icons — replace with a proper icon library later
function HomeIcon({ active }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
      <path d="M3 12L12 3l9 9M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9"/>
    </svg>
  )
}

function ScanIcon({ active }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
      <path d="M4 8V6a2 2 0 012-2h2M4 16v2a2 2 0 002 2h2m8-16h2a2 2 0 012 2v2m0 8v2a2 2 0 01-2 2h-2M9 12h6"/>
    </svg>
  )
}

function LibraryIcon({ active }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
      <path d="M12 6.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11zM12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M2 12h2m16 0h2"/>
    </svg>
  )
}

function CalIcon({ active }) {
  return (
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={active ? '#D4DCCA' : '#8A7E6E'} strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  )
}
// Force deployment trigger

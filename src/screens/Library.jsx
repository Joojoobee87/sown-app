// src/screens/Library.jsx
// Sown App — My Garden Library screen
// Paste this file into src/screens/Library.jsx

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '../components/TopBar'

// ─── Seed S icon (matches TopBar / brand mark) ───────────────────────────────
function SeedMark({ size = 16, color = '#4A5940' }) {
  const h = size
  const w = size * 0.75
  const rx = w * 0.45
  const ry1 = h * 0.3
  const cy1 = h * 0.28
  const cy2 = h * 0.72
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <ellipse cx={w / 2} cy={cy1} rx={rx} ry={ry1} fill={color} />
      <line
        x1={w * 0.25} y1={h * 0.1} x2={w * 0.55} y2={h * 0.35}
        stroke={color === '#4A5940' ? '#D4DCCA' : '#4A5940'}
        strokeWidth="0.7" strokeLinecap="round" opacity="0.45"
      />
      <ellipse cx={w / 2} cy={cy2} rx={rx} ry={ry1} fill={color}
        transform={`rotate(180 ${w / 2} ${cy2})`} />
      <line
        x1={w * 0.35} y1={h * 0.62} x2={w * 0.65} y2={h * 0.87}
        stroke={color === '#4A5940' ? '#D4DCCA' : '#4A5940'}
        strokeWidth="0.7" strokeLinecap="round" opacity="0.45"
      />
    </svg>
  )
}

// ─── Botanical illustration placeholder ──────────────────────────────────────
// In production this would load from your Supabase illustrations bucket.
// For now renders a consistent pencil-sketch style SVG per plant.
function BotanicalThumb({ name = '', color = '#4A5940' }) {
  // Use plant name to seed a simple variation so each looks different
  const seed = name.charCodeAt(0) % 4
  const variants = [
    // Simple flower
    <svg key="a" width="36" height="36" viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="18" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="18" y1="26" x2="13" y2="22" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
      <ellipse cx="18" cy="14" rx="6" ry="7" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 1.5"/>
      <circle cx="18" cy="14" r="2.5" fill="none" stroke={color} strokeWidth="0.8"/>
    </svg>,
    // Leaf stem
    <svg key="b" width="36" height="36" viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <ellipse cx="12" cy="20" rx="7" ry="5" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="1.5 1.5" transform="rotate(-30 12 20)"/>
      <ellipse cx="24" cy="16" rx="7" ry="5" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="1.5 1.5" transform="rotate(30 24 16)"/>
    </svg>,
    // Round bloom
    <svg key="c" width="36" height="36" viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="20" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="18" cy="14" r="8" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 1.5"/>
      <circle cx="18" cy="14" r="3" fill="none" stroke={color} strokeWidth="0.8"/>
      <line x1="18" y1="6" x2="18" y2="10" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      <line x1="10" y1="14" x2="14" y2="14" stroke={color} strokeWidth="0.8" opacity="0.5"/>
      <line x1="22" y1="14" x2="26" y2="14" stroke={color} strokeWidth="0.8" opacity="0.5"/>
    </svg>,
    // Tall spike
    <svg key="d" width="36" height="36" viewBox="0 0 36 36" fill="none">
      <line x1="18" y1="32" x2="18" y2="8" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
      <ellipse cx="18" cy="10" rx="4" ry="6" fill="none" stroke={color} strokeWidth="1" strokeDasharray="1.5 1"/>
      <line x1="18" y1="24" x2="12" y2="19" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
      <line x1="18" y1="20" x2="24" y2="15" stroke={color} strokeWidth="0.9" strokeLinecap="round"/>
    </svg>
  ]
  return variants[seed]
}

// ─── Status dot ──────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const colours = {
    growing:  'bg-fern',
    dormant:  'bg-clay',
    lost:     'bg-subtle/40',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1
      ${colours[status] || 'bg-moss'}`} />
  )
}

// ─── Plant Card ───────────────────────────────────────────────────────────────
function PlantCard({ plant, onClick }) {
  return (
    <button
      onClick={() => onClick(plant)}
      className="w-full bg-white border border-moss/40 rounded-xl
                 p-3 flex gap-3 items-start text-left
                 active:bg-leaf transition-colors"
    >
      {/* Botanical thumbnail */}
      <div className="w-12 h-12 bg-leaf rounded-lg flex-shrink-0
                      flex items-center justify-center">
        <BotanicalThumb name={plant.common_name} />
      </div>

      {/* Plant info */}
      <div className="flex-1 min-w-0">
        <p className="font-serif text-dark text-sm leading-tight truncate">
          {plant.common_name}
        </p>
        {plant.latin_name && (
          <p className="text-xs text-subtle italic truncate mt-0.5">
            {plant.latin_name}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          {plant.location && (
            <span className="text-[10px] bg-leaf text-fern px-2 py-0.5
                             rounded-full tracking-wide">
              {plant.location}
            </span>
          )}
          {plant.date_added && (
            <span className="text-[10px] text-subtle">
              {formatDate(plant.date_added)}
            </span>
          )}
        </div>
      </div>

      {/* Status dot */}
      <StatusDot status={plant.status} />
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ filter, onScan }) {
  return (
    <div className="flex flex-col items-center justify-center
                    py-16 px-6 text-center gap-4">
      <div className="w-16 h-16 bg-leaf rounded-full flex items-center
                      justify-center">
        <SeedMark size={32} color="#4A5940" />
      </div>
      <div>
        <p className="font-serif text-dark text-lg mb-1">
          {filter === 'All' ? 'Your library is empty' : `No plants in ${filter}`}
        </p>
        <p className="text-sm text-muted leading-relaxed">
          {filter === 'All'
            ? 'Scan your first plant to start building your garden library.'
            : 'Try a different location filter, or scan a new plant.'}
        </p>
      </div>
      {filter === 'All' && (
        <button
          onClick={onScan}
          className="bg-fern text-sage text-sm font-medium
                     px-6 py-3 rounded-xl tracking-wide
                     active:opacity-80 transition-opacity"
        >
          Scan your first plant
        </button>
      )}
    </div>
  )
}

// ─── Plant detail sheet ───────────────────────────────────────────────────────
// Slides up from bottom when a plant card is tapped.
function PlantDetailSheet({ plant, onClose }) {
  if (!plant) return null
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-dark/40 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                      bg-parchment rounded-t-2xl z-50 pb-safe">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-moss rounded-full" />
        </div>

        {/* Header */}
        <div className="bg-fern px-5 py-4 mx-3 rounded-xl mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-dark/30 rounded-lg flex items-center
                            justify-center flex-shrink-0">
              <BotanicalThumb name={plant.common_name} color="#D4DCCA" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-serif text-sage text-base leading-tight">
                {plant.common_name}
              </p>
              {plant.latin_name && (
                <p className="text-xs text-moss italic mt-0.5">
                  {plant.latin_name}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-4 pb-6 flex flex-col gap-3">

          {/* Key facts */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Location',   value: plant.location },
              { label: 'Status',     value: plant.status },
              { label: 'Added',      value: plant.date_added ? formatDate(plant.date_added) : null },
              { label: 'Sun',        value: plant.sun_requirements },
              { label: 'Soil',       value: plant.soil_type },
              { label: 'Aspect',     value: plant.aspect },
            ].filter(f => f.value).map(({ label, value }) => (
              <div key={label} className="bg-leaf rounded-lg px-3 py-2">
                <p className="text-[10px] text-subtle uppercase tracking-widest mb-0.5">
                  {label}
                </p>
                <p className="text-sm text-dark font-medium capitalize">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Care note */}
          {plant.care_notes && (
            <div className="bg-white border border-moss/40 rounded-xl
                            px-4 py-3 border-l-2 border-l-fern">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide">
                Care note
              </p>
              <p className="text-sm text-muted leading-relaxed">
                {plant.care_notes}
              </p>
            </div>
          )}

          {/* Personal notes */}
          {plant.personal_notes && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-subtle mb-1 tracking-wide uppercase">
                Your notes
              </p>
              <p className="text-sm text-muted leading-relaxed italic">
                {plant.personal_notes}
              </p>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="w-full bg-leaf text-fern text-sm font-medium
                       py-3 rounded-xl tracking-wide mt-1
                       active:bg-moss/30 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main Library screen ───────────────────────────────────────────────────────
export default function Library() {
  const navigate = useNavigate()

  // ── State ──────────────────────────────────────────────────────────────────
  const [search, setSearch]         = useState('')
  const [activeFilter, setFilter]   = useState('All')
  const [selectedPlant, setPlant]   = useState(null)

  // ── Sample data ─────────────────────────────────────────────────────────────
  // Replace this with a real Supabase fetch when auth is set up.
  // Pattern: useEffect(() => { fetchFromSupabase() }, [])
  const plants = SAMPLE_PLANTS

  // ── Location filters ────────────────────────────────────────────────────────
  const locations = ['All', ...new Set(plants.map(p => p.location).filter(Boolean))]

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = plants.filter(p => {
    const matchesSearch =
      p.common_name.toLowerCase().includes(search.toLowerCase()) ||
      (p.latin_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      activeFilter === 'All' || p.location === activeFilter
    return matchesSearch && matchesFilter
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />

      <main className="flex-1 flex flex-col">

        {/* Search bar */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle"
              width="16" height="16" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search your plants..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-white border border-moss/40 rounded-xl
                         pl-9 pr-4 py-2.5 text-sm text-dark
                         placeholder:text-subtle/60
                         focus:outline-none focus:border-fern
                         transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-subtle hover:text-fern transition-colors"
              >
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                  stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Location filters */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto
                        scrollbar-none [-ms-overflow-style:none]
                        [&::-webkit-scrollbar]:hidden">
          {locations.map(loc => (
            <button
              key={loc}
              onClick={() => setFilter(loc)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full
                          font-medium tracking-wide transition-colors
                          ${activeFilter === loc
                            ? 'bg-fern text-sage'
                            : 'bg-white border border-moss/40 text-subtle'
                          }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Count */}
        {filtered.length > 0 && (
          <p className="px-4 pb-2 text-xs text-subtle tracking-wide">
            {filtered.length} {filtered.length === 1 ? 'plant' : 'plants'}
            {activeFilter !== 'All' ? ` in ${activeFilter}` : ''}
          </p>
        )}

        {/* Plant list */}
        <div className="px-4 flex flex-col gap-2 flex-1">
          {filtered.length === 0
            ? <EmptyState filter={activeFilter} onScan={() => navigate('/scan')} />
            : filtered.map(plant => (
                <PlantCard
                  key={plant.id}
                  plant={plant}
                  onClick={setPlant}
                />
              ))
          }

          {/* Add plant CTA */}
          {filtered.length > 0 && (
            <button
              onClick={() => navigate('/scan')}
              className="w-full border border-dashed border-moss/60
                         rounded-xl py-3 text-sm text-subtle
                         flex items-center justify-center gap-2
                         active:bg-leaf transition-colors mt-1"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
                stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add a plant
            </button>
          )}
        </div>

      </main>

      {/* Plant detail sheet */}
      <PlantDetailSheet
        plant={selectedPlant}
        onClose={() => setPlant(null)}
      />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

// ─── Sample data ──────────────────────────────────────────────────────────────
// Remove this and replace with a Supabase fetch once auth is wired up.
// See the comment in the Library component above.
const SAMPLE_PLANTS = [
  {
    id: '1',
    common_name: "Dahlia 'Bishop of Llandaff'",
    latin_name: 'Dahlia × hybrida',
    location: 'Front garden',
    status: 'growing',
    date_added: '2026-04-10',
    sun_requirements: 'Full sun',
    soil_type: 'Well drained',
    aspect: 'S / SW',
    care_notes: 'Lift tubers before first frost. Store in a cool dry place over winter.',
    personal_notes: 'Planted along the south fence — gorgeous deep red.',
  },
  {
    id: '2',
    common_name: "Rosa 'Gertrude Jekyll'",
    latin_name: 'Rosa',
    location: 'Patio',
    status: 'growing',
    date_added: '2026-03-15',
    sun_requirements: 'Full sun',
    soil_type: 'Fertile, moist',
    aspect: 'S facing',
    care_notes: 'Feed with rose fertiliser in May and July. Watch for blackspot.',
    personal_notes: null,
  },
  {
    id: '3',
    common_name: 'Lavandula angustifolia',
    latin_name: 'Lavandula angustifolia',
    location: 'Front garden',
    status: 'growing',
    date_added: '2026-03-20',
    sun_requirements: 'Full sun',
    soil_type: 'Well drained',
    aspect: 'S / SE',
    care_notes: 'Light trim after flowering. Do not cut into old wood.',
    personal_notes: 'Three plants along the path edge.',
  },
  {
    id: '4',
    common_name: 'Hydrangea macrophylla',
    latin_name: 'Hydrangea macrophylla',
    location: 'Back garden',
    status: 'dormant',
    date_added: '2025-09-05',
    sun_requirements: 'Partial shade',
    soil_type: 'Moist, well drained',
    aspect: 'E / NE',
    care_notes: 'Prune dead heads in spring. Do not prune hard.',
    personal_notes: null,
  },
  {
    id: '5',
    common_name: 'Allium Purple Sensation',
    latin_name: 'Allium aflatunense',
    location: 'Front garden',
    status: 'dormant',
    date_added: '2025-10-12',
    sun_requirements: 'Full sun',
    soil_type: 'Well drained',
    aspect: 'S / SW',
    care_notes: 'Bulbs planted 10cm deep, 15cm apart. Flowers May–June.',
    personal_notes: 'Stored in hessian bulb bag in garage.',
  },
]

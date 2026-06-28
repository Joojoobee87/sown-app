// src/screens/Library.jsx
// Sown App — My Garden Library screen
// Paste this file into src/screens/Library.jsx

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'
import SownIcon from '../components/SownIcon'

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

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'want to grow') {
    return (
      <span className="text-[10px] bg-clay/15 text-clay px-2 py-0.5
                       rounded-full tracking-wide flex-shrink-0 whitespace-nowrap">
        Wishlist
      </span>
    )
  }
  const dot = {
    growing: 'bg-fern',
    dormant: 'bg-clay',
    lost:    'bg-subtle/40',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1
      ${dot[status] || 'bg-moss'}`} />
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
      {/* Photo or botanical thumbnail */}
      <div className="w-12 h-12 bg-leaf rounded-lg flex-shrink-0
                      flex items-center justify-center overflow-hidden">
        {plant.photo_url
          ? <img
              src={plant.photo_url}
              alt={plant.common_name}
              className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }}
            />
          : null}
        <div className={`w-full h-full items-center justify-center ${plant.photo_url ? 'hidden' : 'flex'}`}>
          <BotanicalThumb name={plant.common_name} />
        </div>
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

      {/* Status badge */}
      <StatusBadge status={plant.status} />
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
        <SownIcon size={32} fill="#44593b" />
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
function PlantDetailSheet({ plant: initialPlant, onClose, onUpdate }) {
  const [plant, setPlant]         = useState(initialPlant)
  const [editingZone, setEditingZone] = useState(false)
  const [zones, setZones]         = useState([])
  const [savingZone, setSavingZone]   = useState(false)

  // Swipe-down-to-close — handle bar only, so it doesn't fight page scroll
  const touchStartY = useRef(null)
  const [dragY, setDragY] = useState(0)
  const handleTouchStart = (e) => { touchStartY.current = e.touches[0].clientY }
  const handleTouchMove  = (e) => {
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setDragY(dy)
  }
  const handleTouchEnd = () => {
    if (dragY > 60) { onClose(); return }
    setDragY(0)
  }

  // Delete from library (user_plants only — shared plants row is kept)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await supabase.from('user_plants').delete().eq('id', plant.id)
      onUpdate()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  const openZoneEdit = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('garden_zones')
      .select('id, name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setZones(data || [])
    setEditingZone(true)
  }

  const handleZoneSelect = async (zoneName) => {
    setSavingZone(true)
    try {
      await supabase
        .from('user_plants')
        .update({ location: zoneName })
        .eq('id', plant.id)
      setPlant(prev => ({ ...prev, location: zoneName }))
      setEditingZone(false)
      onUpdate()
    } finally {
      setSavingZone(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-dark/40 z-40" onClick={onClose} />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                   bg-parchment rounded-t-2xl z-50 max-h-[85vh]
                   overflow-y-auto overflow-x-hidden w-full"
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY > 0 ? 'none' : 'transform 0.25s ease',
        }}
      >

        {/* Handle — touch events here only so swipe doesn't fight scroll */}
        <div
          className="flex justify-center pt-3 pb-1 sticky top-0
                     bg-parchment z-10 cursor-pointer"
          onClick={onClose}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-moss rounded-full" />
        </div>

        {/* Header */}
        <div className="mx-3 mb-4 rounded-xl overflow-hidden">
          {plant.photo_url ? (
            <div className="relative">
              <img
                src={plant.photo_url}
                alt={plant.common_name}
                className="w-full h-36 object-cover"
                onError={e => { e.currentTarget.parentElement.classList.add('hidden') }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-dark/70 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
                <p className="font-serif text-sage text-base leading-tight">
                  {plant.common_name}
                </p>
                {plant.latin_name && (
                  <p className="text-xs text-sage/70 italic mt-0.5">{plant.latin_name}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-fern px-5 py-4">
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
                    <p className="text-xs text-moss italic mt-0.5">{plant.latin_name}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="px-4 pb-24 flex flex-col gap-3">

          {/* Location row — editable */}
          <div className="bg-leaf rounded-xl px-4 py-3">
            <div className="flex items-center justify-between mb-0.5">
              <p className="text-[10px] text-subtle uppercase tracking-widest">Zone</p>
              {!editingZone && (
                <button
                  onClick={openZoneEdit}
                  className="text-[10px] text-fern font-medium underline underline-offset-2
                             active:opacity-60 transition-opacity"
                >
                  Edit
                </button>
              )}
            </div>

            {editingZone ? (
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  {zones.map(z => (
                    <button
                      key={z.id}
                      disabled={savingZone}
                      onClick={() => handleZoneSelect(z.name)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-medium
                                  transition-colors disabled:opacity-50
                                  ${plant.location === z.name
                                    ? 'bg-fern text-sage border-fern'
                                    : 'bg-white border-moss/40 text-dark'}`}
                    >
                      {z.name}
                    </button>
                  ))}
                  <button
                    disabled={savingZone}
                    onClick={() => handleZoneSelect(null)}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium
                                transition-colors disabled:opacity-50
                                ${!plant.location
                                  ? 'bg-fern text-sage border-fern'
                                  : 'bg-white border-moss/40 text-subtle'}`}
                  >
                    No zone
                  </button>
                </div>
                <button
                  onClick={() => setEditingZone(false)}
                  className="text-xs text-subtle underline underline-offset-2 mt-1
                             active:opacity-60 transition-opacity self-start"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <p className="text-sm text-dark font-medium">
                {plant.location || <span className="text-subtle italic font-normal">No zone</span>}
              </p>
            )}
          </div>

          {/* Key facts grid */}
          {(() => {
            const facts = [
              { label: 'Status',  value: plant.status },
              { label: 'Added',   value: plant.date_added ? formatDate(plant.date_added) : null },
              { label: 'Sun',     value: plant.sun_requirements },
              { label: 'Soil',    value: plant.soil_type },
              { label: 'Aspect',  value: plant.aspect },
              { label: 'Height',  value: plant.height },
              { label: 'Season',  value: plant.flowering_season },
              { label: 'Frost',   value: plant.frost_hardiness },
            ].filter(f => f.value)
            return facts.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {facts.map(({ label, value }) => (
                  <div key={label} className="bg-leaf rounded-lg px-3 py-2">
                    <p className="text-[10px] text-subtle uppercase tracking-widest mb-0.5">
                      {label}
                    </p>
                    <p className="text-sm text-dark font-medium capitalize">{value}</p>
                  </div>
                ))}
              </div>
            ) : null
          })()}

          {/* Watering */}
          {plant.watering && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Watering
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.watering}</p>
            </div>
          )}

          {/* Pruning */}
          {(plant.pruning_when || plant.pruning_how) && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Pruning
              </p>
              {plant.pruning_when && (
                <p className="text-sm text-muted leading-relaxed">
                  <span className="font-medium text-dark">When: </span>
                  {plant.pruning_when}
                </p>
              )}
              {plant.pruning_how && (
                <p className="text-sm text-muted leading-relaxed mt-0.5">
                  <span className="font-medium text-dark">How: </span>
                  {plant.pruning_how}
                </p>
              )}
            </div>
          )}

          {/* Winter care */}
          {plant.winter_care && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Winter care
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.winter_care}</p>
            </div>
          )}

          {/* Care note */}
          {plant.care_notes && (
            <div className="bg-white border-l-2 border-l-fern border border-moss/40
                            rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-fern mb-1 tracking-wide uppercase">
                Care note
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.care_notes}</p>
            </div>
          )}

          {/* Wildlife value */}
          {plant.wildlife_value && (
            <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-subtle mb-1 tracking-wide uppercase">
                Wildlife value
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.wildlife_value}</p>
            </div>
          )}

          {/* Toxicity */}
          {plant.toxic && (
            <div className="bg-clay/10 border border-clay/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-clay mb-1 tracking-wide">
                ⚠ Toxicity
              </p>
              <p className="text-sm text-muted leading-relaxed">{plant.toxic}</p>
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
                       py-3 rounded-xl tracking-wide
                       active:bg-moss/30 transition-colors"
          >
            Close
          </button>

          {/* Remove from library */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full text-sm py-2 text-center disabled:opacity-40
                       transition-colors"
          >
            {deleting
              ? <span className="text-subtle">Removing…</span>
              : confirmDelete
              ? <span className="text-clay font-medium">Tap again to confirm removal</span>
              : <span className="text-subtle/70">Remove from library</span>
            }
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
  const [plants, setPlants]         = useState([])
  const [loading, setLoading]       = useState(true)

  // ── Lock body scroll when detail sheet is open ─────────────────────────────
  useEffect(() => {
    if (selectedPlant) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [selectedPlant])

  // ── Fetch from Supabase ─────────────────────────────────────────────────────
  const fetchPlants = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_plants')
        .select(`
          id, plant_id, location, personal_notes, date_added, status,
          plants (
            common_name, latin_name, photo_url,
            sun_requirements, soil_type, aspect, height, spread,
            flowering_season, growth_rate, frost_hardiness,
            watering, pruning_when, pruning_how,
            winter_care, care_notes, wildlife_value, toxic
          )
        `)
        .eq('user_id', user.id)
        .order('date_added', { ascending: false })
      if (data) {
        setPlants(data.map(row => ({
          id:               row.id,
          plant_id:         row.plant_id,
          location:         row.location,
          personal_notes:   row.personal_notes,
          date_added:       row.date_added,
          status:           row.status,
          common_name:      row.plants?.common_name,
          latin_name:       row.plants?.latin_name,
          photo_url:        row.plants?.photo_url,
          sun_requirements: row.plants?.sun_requirements,
          soil_type:        row.plants?.soil_type,
          aspect:           row.plants?.aspect,
          height:           row.plants?.height,
          spread:           row.plants?.spread,
          flowering_season: row.plants?.flowering_season,
          growth_rate:      row.plants?.growth_rate,
          frost_hardiness:  row.plants?.frost_hardiness,
          watering:         row.plants?.watering,
          pruning_when:     row.plants?.pruning_when,
          pruning_how:      row.plants?.pruning_how,
          winter_care:      row.plants?.winter_care,
          care_notes:       row.plants?.care_notes,
          wildlife_value:   row.plants?.wildlife_value,
          toxic:            row.plants?.toxic,
        })))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlants()
  }, [])

  // ── Filters: zone locations + Wishlist pill ───────────────────────────────
  const hasWishlist = plants.some(p => p.status === 'want to grow')
  const locations   = [
    'All',
    ...(hasWishlist ? ['Wishlist'] : []),
    ...new Set(plants.filter(p => p.status !== 'want to grow').map(p => p.location).filter(Boolean)),
  ]

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = plants.filter(p => {
    const matchesSearch =
      (p.common_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.latin_name || '').toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      activeFilter === 'All'      ? true :
      activeFilter === 'Wishlist' ? p.status === 'want to grow' :
                                    p.location === activeFilter
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
            {activeFilter === 'Wishlist' ? ' on your wishlist' :
             activeFilter !== 'All'      ? ` in ${activeFilter}` : ''}
          </p>
        )}

        {/* Plant list */}
        <div className="px-4 flex flex-col gap-2 flex-1">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="w-8 h-8 border-2 border-moss/30
                              border-t-fern rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0
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

      {selectedPlant && (
        <PlantDetailSheet
          key={selectedPlant.id}
          plant={selectedPlant}
          onClose={() => setPlant(null)}
          onUpdate={fetchPlants}
        />
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}


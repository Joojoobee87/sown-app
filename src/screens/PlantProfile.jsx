//
// What this does:
//   1. Shows full plant details after a scan or library tap
//   2. Photo header for visual recognition
//   3. Botanical illustration tab alongside photo
//   4. Full facts grid — sun, soil, aspect, height, season, growth rate
//   5. Care notes, companion plants, wildlife value, toxicity
//   6. Seasonal care timeline — what to do each month
//   7. Save to library button with location picker
//   8. Share plant button
//
// How to navigate here:
//   From Scan:    navigate('/plant/id', { state: { plant } })
//   From Library: navigate('/plant/id', { state: { plant } })
//
// Add this route to App.jsx:
//   <Route path="/plant/:id" element={<PlantProfile />} />

import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import TopBar from '../components/TopBar'

// ─── Constants ────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const GARDEN_LOCATIONS = [
  'Front garden',
  'Back garden',
  'Patio',
  'Greenhouse',
  'Windowsill',
  'Balcony',
  'Allotment',
  'Raised bed',
  'Pot / container',
]

// ─── Seed S mark ────────────────────────────────────────────────────────
function SeedMark({ size = 16, color = '#4A5940' }) {
  const h = size, w = size * 0.75
  const rx = w * 0.45, ry = h * 0.3
  const cy1 = h * 0.28, cy2 = h * 0.72
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <ellipse cx={w/2} cy={cy1} rx={rx} ry={ry} fill={color}/>
      <line x1={w*0.25} y1={h*0.1} x2={w*0.55} y2={h*0.35}
        stroke={color==='#4A5940'?'#D4DCCA':'#4A5940'}
        strokeWidth="0.7" strokeLinecap="round" opacity="0.45"/>
      <ellipse cx={w/2} cy={cy2} rx={rx} ry={ry} fill={color}
        transform={`rotate(180 ${w/2} ${cy2})`}/>
      <line x1={w*0.35} y1={h*0.62} x2={w*0.65} y2={h*0.87}
        stroke={color==='#4A5940'?'#D4DCCA':'#4A5940'}
        strokeWidth="0.7" strokeLinecap="round" opacity="0.45"/>
    </svg>
  )
}

// ─── Botanical illustration ───────────────────────────────────────────
function BotanicalIllustration({ name = '', color = '#4A5940', size = 80 }) {
  const seed = name.charCodeAt(0) % 4
  const s = size
  const variants = [
    // Detailed flower
    <svg key="a" width={s} height={s} viewBox="0 0 80 80" fill="none">
      <line x1="40" y1="75" x2="40" y2="38" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="40" y1="60" x2="28" y2="50" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
      <line x1="40" y1="52" x2="52" y2="44" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
      <ellipse cx="40" cy="26" rx="14" ry="16" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="3 2"/>
      <circle cx="40" cy="26" r="5" fill="none" stroke={color} strokeWidth="1"/>
      <ellipse cx="26" cy="20" rx="8" ry="10" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="2 1.5" transform="rotate(-20 26 20)"/>
      <ellipse cx="54" cy="20" rx="8" ry="10" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="2 1.5" transform="rotate(20 54 20)"/>
      <ellipse cx="30" cy="33" rx="7" ry="9" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="2 1.5" transform="rotate(-35 30 33)"/>
      <ellipse cx="50" cy="33" rx="7" ry="9" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="2 1.5" transform="rotate(35 50 33)"/>
    </svg>,
    // Leafy stem
    <svg key="b" width={s} height={s} viewBox="0 0 80 80" fill="none">
      <line x1="40" y1="75" x2="40" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="26" cy="40" rx="14" ry="9" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2.5 2" transform="rotate(-25 26 40)"/>
      <line x1="33" y1="38" x2="40" y2="42" stroke={color} strokeWidth="0.8" strokeLinecap="round"/>
      <ellipse cx="54" cy="30" rx="14" ry="9" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2.5 2" transform="rotate(25 54 30)"/>
      <line x1="47" y1="30" x2="40" y2="34" stroke={color} strokeWidth="0.8" strokeLinecap="round"/>
      <ellipse cx="26" cy="56" rx="12" ry="7" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="2 1.5" transform="rotate(-20 26 56)"/>
      <ellipse cx="40" cy="16" rx="6" ry="8" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2.5 2"/>
    </svg>,
    // Round bloom detailed
    <svg key="c" width={s} height={s} viewBox="0 0 80 80" fill="none">
      <line x1="40" y1="75" x2="40" y2="42" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="40" y1="62" x2="30" y2="55" stroke={color} strokeWidth="1" strokeLinecap="round"/>
      <circle cx="40" cy="28" r="16" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="3 2"/>
      <circle cx="40" cy="28" r="6" fill="none" stroke={color} strokeWidth="1"/>
      <line x1="40" y1="12" x2="40" y2="18" stroke={color} strokeWidth="1" opacity="0.6"/>
      <line x1="56" y1="28" x2="50" y2="28" stroke={color} strokeWidth="1" opacity="0.6"/>
      <line x1="24" y1="28" x2="30" y2="28" stroke={color} strokeWidth="1" opacity="0.6"/>
      <line x1="51" y1="17" x2="47" y2="21" stroke={color} strokeWidth="0.9" opacity="0.5"/>
      <line x1="29" y1="17" x2="33" y2="21" stroke={color} strokeWidth="0.9" opacity="0.5"/>
      <line x1="51" y1="39" x2="47" y2="35" stroke={color} strokeWidth="0.9" opacity="0.5"/>
      <line x1="29" y1="39" x2="33" y2="35" stroke={color} strokeWidth="0.9" opacity="0.5"/>
    </svg>,
    // Tall spike detailed
    <svg key="d" width={s} height={s} viewBox="0 0 80 80" fill="none">
      <line x1="40" y1="75" x2="40" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <ellipse cx="40" cy="14" rx="7" ry="10" fill="none" stroke={color} strokeWidth="1.2" strokeDasharray="2 1.5"/>
      <ellipse cx="28" cy="34" rx="10" ry="6" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 1.5" transform="rotate(-20 28 34)"/>
      <line x1="35" y1="33" x2="40" y2="36" stroke={color} strokeWidth="0.8" strokeLinecap="round"/>
      <ellipse cx="52" cy="44" rx="10" ry="6" fill="none" stroke={color} strokeWidth="1" strokeDasharray="2 1.5" transform="rotate(20 52 44)"/>
      <line x1="45" y1="44" x2="40" y2="46" stroke={color} strokeWidth="0.8" strokeLinecap="round"/>
      <ellipse cx="28" cy="56" rx="8" ry="5" fill="none" stroke={color} strokeWidth="0.9" strokeDasharray="1.5 1.5" transform="rotate(-15 28 56)"/>
    </svg>,
  ]
  return variants[seed]
}

// ─── Fact tile ────────────────────────────────────────────────────────
function FactTile({ label, value, icon }) {
  if (!value) return null
  return (
    <div className="bg-leaf rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-subtle uppercase tracking-widest mb-1 flex items-center gap-1">
        {icon && <span>{icon}</span>}
        {label}
      </p>
      <p className="text-sm text-dark font-medium leading-tight">{value}</p>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────
function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-3 my-1">
      <p className="text-xs text-subtle uppercase tracking-widest font-medium
                    flex-shrink-0">
        {title}
      </p>
      <div className="flex-1 h-px bg-moss/30" />
    </div>
  )
}

// ─── Seasonal care timeline ───────────────────────────────────────────
function SeasonalTimeline({ calendar }) {
  const now        = new Date()
  const thisMonth  = now.getMonth()

  if (!calendar || Object.keys(calendar).length === 0) return null

  return (
    <div className="flex gap-1 overflow-x-auto pb-1
                    scrollbar-none [-ms-overflow-style:none]
                    [&::-webkit-scrollbar]:hidden">
      {MONTHS.map((m, i) => {
        const hasTasks = calendar[i] && calendar[i].length > 0
        const isCurrent = i === thisMonth
        return (
          <div key={m} className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                             text-[9px] font-medium transition-colors
                             ${isCurrent
                               ? 'bg-fern text-sage'
                               : hasTasks
                                 ? 'bg-moss/40 text-fern'
                                 : 'bg-white border border-moss/30 text-subtle/40'
                             }`}>
              {m}
            </div>
            {hasTasks && (
              <div className={`w-1 h-1 rounded-full
                ${isCurrent ? 'bg-fern' : 'bg-moss'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Companion plant pill ─────────────────────────────────────────────
function CompanionPill({ name }) {
  return (
    <div className="bg-white border border-moss/40 rounded-lg px-3 py-2
                    flex items-center gap-2">
      <SeedMark size={14} color="#BFCAAD" />
      <p className="text-xs text-dark">{name}</p>
    </div>
  )
}

// ─── Save sheet ───────────────────────────────────────────────────────
function SaveSheet({ plant, onSave, onClose, saving }) {
  const [location, setLocation] = useState(GARDEN_LOCATIONS[0])
  const [notes, setNotes]       = useState('')

  return (
    <>
      <div className="fixed inset-0 bg-dark/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                      bg-parchment rounded-t-2xl z-50">

        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-moss rounded-full" />
        </div>

        <div className="px-5 pb-8 flex flex-col gap-4">
          <div>
            <p className="font-serif text-dark text-lg">
              Save to your library
            </p>
            <p className="text-sm text-subtle mt-0.5">
              {plant.common_name}
            </p>
          </div>

          {/* Location picker */}
          <div>
            <p className="text-xs text-subtle uppercase tracking-widest mb-2">
              Where is this plant?
            </p>
            <div className="flex flex-wrap gap-2">
              {GARDEN_LOCATIONS.map(loc => (
                <button
                  key={loc}
                  onClick={() => setLocation(loc)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium
                              tracking-wide transition-colors
                              ${location === loc
                                ? 'bg-fern text-sage'
                                : 'bg-white border border-moss/40 text-subtle'
                              }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Personal notes */}
          <div>
            <p className="text-xs text-subtle uppercase tracking-widest mb-2">
              Notes (optional)
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Planted along the south fence..."
              rows={2}
              className="w-full bg-white border border-moss/40 rounded-xl
                         px-4 py-3 text-sm text-dark placeholder:text-subtle/50
                         focus:outline-none focus:border-fern resize-none
                         transition-colors"
            />
          </div>

          {/* Save button */}
          <button
            onClick={() => onSave({ location, notes })}
            disabled={saving}
            className="w-full bg-fern text-sage font-medium py-4
                       rounded-xl tracking-wide text-sm
                       disabled:opacity-50 active:opacity-80
                       transition-opacity"
          >
            {saving ? 'Saving...' : 'Save to library'}
          </button>

          <button
            onClick={onClose}
            className="text-subtle text-sm text-center"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────
function Toast({ message }) {
  if (!message) return null
  return (
    <div className="fixed top-20 left-4 right-4 max-w-md mx-auto
                    bg-fern text-sage text-sm font-medium
                    px-4 py-3 rounded-xl z-50 text-center shadow-lg">
      {message}
    </div>
  )
}

// ─── Main Plant Profile screen ────────────────────────────────────────────────
export default function PlantProfile() {
  const navigate          = useNavigate()
  const { state }         = useLocation()
  const { id }            = useParams()

  // ── State ──────────────────────────────────────────────────────────
  const [activeTab, setTab]     = useState('photo')   // 'photo' | 'botanical'
  const [showSave, setSave]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [alreadySaved, setSaved] = useState(false)
  const [toast, setToast]       = useState(null)

  // ── Get plant data ─────────────────────────────────────────────────────────
  // Data comes from navigation state (passed by Scan or Library screens).
  // In production also support fetching by ID from Supabase:
  // useEffect(() => {
  //   if (!state?.plant && id) {
  //     supabase.from('plants').select('*').eq('id', id).single()
  //       .then(({ data }) => setPlant(data))
  //   }
  // }, [id])
  const plant = state?.plant || SAMPLE_PLANT

  // ── Save to Supabase ───────────────────────────────────────────────────────
  const handleSave = async ({ location, notes }) => {
    setSaving(true)
    try {
      // 1. Upsert plant record
      const { data: plantRow, error: plantErr } = await supabase
        .from('plants')
        .upsert({
          common_name:      plant.common_name,
          latin_name:       plant.latin_name,
          sun_requirements: plant.sun_requirements,
          soil_type:        plant.soil_type,
          aspect:           plant.aspect,
          care_notes:       plant.care_notes,
          photo_url:        plant.photo_url,
        }, { onConflict: 'latin_name' })
        .select()
        .single()

      if (plantErr) throw plantErr

      // 2. Add to user library
      const { data: { user } } = await supabase.auth.getUser()
      const { error: libErr } = await supabase
        .from('user_plants')
        .insert({
          user_id:        user.id,
          plant_id:       plantRow.id,
          location,
          personal_notes: notes || null,
          status:         'growing',
          date_added:     new Date().toISOString().split('T')[0],
        })

      if (libErr) throw libErr

      setSaved(true)
      showToast('Saved to your library ✓')
      setSave(false)
      setTimeout(() => navigate('/library'), 1400)

    } catch {
      showToast('Could not save — please try again')
    } finally {
      setSaving(false)
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-24">

      {/* ── Header with back button ───────────────────────────────────────── */}
      <header className="bg-fern px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 bg-dark/30 rounded-full flex items-center
                     justify-center flex-shrink-0 active:bg-dark/50
                     transition-colors"
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
            stroke="#D4DCCA" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-sage text-lg leading-tight truncate">
            {plant.common_name}
          </h1>
          {plant.latin_name && (
            <p className="text-xs text-moss italic truncate">
              {plant.latin_name}
            </p>
          )}
        </div>
        {/* Share button */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: plant.common_name,
                text:  `${plant.common_name} (${plant.latin_name}) — identified with Sown`,
              })
            } else {
              showToast('Copy to URL to share this plant')
            }
          }}
          className="w-8 h-8 bg-dark/30 rounded-full flex items-center
                     justify-center flex-shrink-0 active:bg-dark/50"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
            stroke="#D4DCCA" strokeWidth="2">
            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/>
          </svg>
        </button>
      </header>

      {/* ── Photo / Botanical tab switcher ───────────────────────────────── */}
      <div className="relative">

        {/* Photo */}
        {activeTab === 'photo' && (
          <div className="relative h-52 bg-dark overflow-hidden">
            {plant.photo_url ? (
              <img
                src={plant.photo_url}
                alt={plant.common_name}
                className="w-full h-full object-cover"
              />
            ) : (
              /* Placeholder when no photo available */
              <div className="w-full h-full flex flex-col items-center
                              justify-center gap-2 bg-fern">
                <SeedMark size={40} color="#D4DCCA" />
                <p className="text-xs text-moss">No photo available</p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t
                            from-dark/60 via-transparent to-transparent" />
            <span className="absolute top-3 left-3 text-[10px] bg-dark/50
                             text-parchment px-2 py-1 rounded-full">
              photo
            </span>
          </div>
        )}

        {/* Botanical illustration */}
        {activeTab === 'botanical' && (
          <div className="h-52 bg-parchment flex items-center
                          justify-center border-b border-moss/30">
            <BotanicalIllustration
              name={plant.common_name}
              color="#4A5940"
              size={140}
            />
          </div>
        )}

        {/* Tab switcher — sits at bottom of image area */}
        <div className="absolute bottom-3 right-3 flex gap-1 bg-dark/60
                        rounded-full p-1">
          {['photo', 'botanical'].map(tab => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`px-3 py-1 rounded-full text-[10px] font-medium
                          tracking-wide transition-colors
                          ${activeTab === tab
                            ? 'bg-sage text-dark'
                            : 'text-sage/70'
                          }`}
            >
              {tab === 'photo' ? '📷 Photo' : '✏️ Sketch'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 px-4 pt-4">

        {/* Confidence badge (if from a scan) */}
        {state?.probability && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-leaf rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full bg-fern rounded-full transition-all"
                style={{ width: `${Math.round(state.probability * 100)}%` }}
              />
            </div>
            <span className="text-xs text-subtle flex-shrink-0">
              {Math.round(state.probability * 100)}% match
            </span>
          </div>
        )}

        {/* ── Key facts ─────────────────────────────────────────────────── */}
        <SectionHeader title="Growing conditions" />
        <div className="grid grid-cols-2 gap-2">
          <FactTile label="Sun"          value={plant.sun_requirements} icon="☀️" />
          <FactTile label="Aspect"       value={plant.aspect}           icon="🧭" />
          <FactTile label="Soil"         value={plant.soil_type}        icon="🪨" />
          <FactTile label="Height"       value={plant.height}           icon="📏" />
          <FactTile label="Flowers"      value={plant.flowering_season} icon="🌸" />
          <FactTile label="Growth rate"  value={plant.growth_rate}      icon="⏱️" />
          <FactTile label="Spread"       value={plant.spread}           icon="↔️" />
          <FactTile label="Hardiness"    value={plant.hardiness}        icon="🌡️" />
        </div>

        {/* ── Care notes ────────────────────────────────────────────────── */}
        {plant.care_notes && (
          <>
            <SectionHeader title="Care" />
            <div className="bg-white border border-moss/40 rounded-xl
                            px-4 py-3 border-l-2 border-l-fern">
              <p className="text-sm text-muted leading-relaxed">
                {plant.care_notes}
              </p>
            </div>
          </>
        )}

        {/* ── Seasonal care timeline ─────────────────────────────────────── */}
        {plant.care_calendar && (
          <>
            <SectionHeader title="Year at a glance" />
            <div className="bg-white border border-moss/40 rounded-xl px-3 py-3">
              <SeasonalTimeline calendar={plant.care_calendar} />
              <p className="text-xs text-subtle mt-2 text-center">
                Green months have care tasks — check your Calendar screen
              </p>
            </div>
          </>
        )}

        {/* ── Wildlife & environment ─────────────────────────────────────── */}
        {(plant.wildlife_value || plant.soil_ph) && (
          <>
            <SectionHeader title="Environment" />
            {plant.wildlife_value && (
              <div className="bg-white border border-moss/40 rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-subtle uppercase
                              tracking-widest mb-1.5">
                  🐝 Wildlife value
                </p>
                <p className="text-sm text-muted leading-relaxed">
                  {plant.wildlife_value}
                </p>
              </div>
            )}
            {plant.soil_ph && (
              <div className="bg-leaf rounded-xl px-4 py-3">
                <p className="text-xs font-medium text-subtle uppercase
                              tracking-widest mb-1">
                  🧪 Soil pH
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-dark font-medium">{plant.soil_ph}</p>
                  {/* pH visual indicator */}
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r
                                    from-red-300 via-moss to-blue-300" />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Companion plants ───────────────────────────────────────────── */}
        {plant.companions && plant.companions.length > 0 && (
          <>
            <SectionHeader title="Companion plants" />
            <p className="text-xs text-muted -mt-2">
              Plants that grow well alongside {plant.common_name}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {plant.companions.map(c => (
                <CompanionPill key={c} name={c} />
              ))}
            </div>
          </>
        )}

        {/* ── Toxicity warning ───────────────────────────────────────────── */}
        {plant.toxic && (
          <>
            <SectionHeader title="Safety" />
            <div className="bg-clay/10 border border-clay/40 rounded-xl px-4 py-3">
              <p className="text-xs font-medium text-clay mb-1 tracking-wide">
                ⚠️ Toxicity warning
              </p>
              <p className="text-sm text-muted leading-relaxed">
                {plant.toxic}
              </p>
            </div>
          </>
        )}

        {/* ── Sown product suggestion ────────────────────────────────────── */}
        <SectionHeader title="Tools for this plant" />
        <div className="bg-fern/5 border border-fern/20 rounded-xl px-4 py-3
                        flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-fern">The Sown Trowel</p>
            <p className="text-xs text-subtle mt-0.5">
              Depth markings for precise bulb planting
            </p>
          </div>
          <button className="text-xs bg-fern text-sage px-3 py-1.5
                             rounded-full font-medium flex-shrink-0 ml-3
                             active:opacity-80">
            Shop
          </button>
        </div>
      </div>

      {/* ── Fixed bottom save bar ─────────────────────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto
                      px-4 py-3 bg-parchment/95 backdrop-blur-sm
                      border-t border-moss/30">
        {alreadySaved ? (
          <button
            onClick={() => navigate('/library')}
            className="w-full bg-leaf border border-fern text-fern
                       font-medium py-3.5 rounded-xl tracking-wide text-sm
                       active:bg-moss/30 transition-colors"
          >
            View in library →
          </button>
        ) : (
          <button
            onClick={() => setSave(true)}
            className="w-full bg-fern text-sage font-medium py-3.5
                       rounded-xl tracking-wide text-sm
                       active:opacity-80 transition-opacity"
          >
            Save to my library
          </button>
        )}
      </div>

      {/* Save sheet */}
      {showSave && (
        <SaveSheet
          plant={plant}
          onSave={handleSave}
          onClose={() => setSave(false)}
          saving={saving}
        />
      )}

      {/* Toast */}
      <Toast message={toast} />
    </div>
  )
}

// ─── Sample plant data ────────────────────────────────────────────────────────
// Used as fallback when no navigation state is passed.
// In production all data comes from Plant.id + Supabase enrichment.
const SAMPLE_PLANT = {
  id:               's1',
  common_name:      "Dahlia 'Bishop of Llandaff'",
  latin_name:       'Dahlia × hybrida',
  sun_requirements: 'Full sun',
  soil_type:        'Well drained, fertile',
  aspect:           'South or south-west facing',
  height:           '90–120cm',
  spread:           '45–60cm',
  flowering_season: 'July to October',
  growth_rate:      'Fast',
  hardiness:        'Half hardy — not frost tolerant',
  soil_ph:          'pH 6.0–7.0 (slightly acidic to neutral)',
  care_notes:       'Lift tubers before the first frost and store in barely moist compost in a frost-free place over winter. Plant out again in the following May once frost risk has passed. Feed with a high-potash liquid fertiliser every two weeks once buds form.',
  wildlife_value:   'Excellent for bees and butterflies. The open-centred varieties in particular provide easy access to pollen and nectar throughout late summer and autumn when other sources are declining.',
  toxic:            null,
  photo_url:        null,
  companions: [
    'Cosmos bipinnatus',
    'Verbena bonariensis',
    'Salvia nemorosa',
    'Rudbeckia fulgida',
    'Penstemon digitalis',
  ],
  care_calendar: {
    2:  [{ action: 'Check stored tubers' }],
    3:  [{ action: 'Start tubers indoors' }],
    4:  [{ action: 'Pot on and harden off' }],
    5:  [{ action: 'Plant out after last frost' }, { action: 'Stake tall varieties' }],
    6:  [{ action: 'Feed fortnightly' }, { action: 'Pinch out tip' }],
    7:  [{ action: 'Deadhead regularly' }],
    8:  [{ action: 'Deadhead and feed' }],
    9:  [{ action: 'Peak season — enjoy' }],
    10: [{ action: 'Lift tubers after frost' }],
    11: [{ action: 'Store tubers for winter' }],
  },
}

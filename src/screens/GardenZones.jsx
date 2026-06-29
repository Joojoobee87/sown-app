import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TopBar from '../components/TopBar'

// ─── Option sets ──────────────────────────────────────────────────────────────
const ASPECTS  = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const SUN      = ['Full sun', 'Partial shade', 'Full shade']
const SOILS    = ['Clay', 'Sandy', 'Loam', 'Chalk', 'Peat', 'Silty']
const DRAINAGE = ['Well drained', 'Moist but well drained', 'Poorly drained']
const SHELTER  = ['Exposed', 'Sheltered', 'Coastal']

const BLANK_ZONE = {
  name: '', aspect: '', sun_exposure: '', soil_type: '',
  soil_drainage: '', shelter: '', frost_pocket: false, notes: '',
}

// ─── Contextual help content for each zone attribute ─────────────────────────
const HELP = {
  aspect: {
    title: 'Which direction does it face?',
    body: 'Use the compass on your phone and stand in the middle of your plot. The direction you face when looking away from your house (or any wall/fence behind the bed) is your aspect.\n\nThe sun rises in the East and sets in the West — at midday it\'s due South. South and south-west facing spots get the most sun; north-facing spots get the least.',
  },
  sun_exposure: {
    title: 'How much sun does it get?',
    body: 'Observe on a clear summer\'s day:\n\n• Full sun — 6+ hours of direct sunlight\n• Partial shade — 3 to 6 hours, or dappled light under trees\n• Full shade — fewer than 3 hours of direct sun\n\nIf in doubt, partial shade is the safe middle ground.',
  },
  soil_type: {
    title: 'Not sure what soil you have?',
    body: 'Take a handful of moist soil and squeeze it:\n\n• Clay — smooth, ribbons when rolled between palms, sticky when wet, cracks when dry\n• Sandy — gritty, falls apart, won\'t hold a shape, drains fast\n• Loam — crumbly and dark, holds shape briefly then breaks — the ideal garden soil\n• Chalk — pale and stony with white chunks, fizzes with vinegar\n• Peat — dark brown, spongy and light, smells earthy, stays wet\n• Silty — silky and smooth, holds shape but feels floury not sticky',
  },
  soil_drainage: {
    title: 'How to check drainage',
    body: 'Dig a hole about 30 cm deep and fill it with water. Then check back:\n\n• Drains in under 1 hour → Well drained\n• Drains in 1–3 hours → Moist but well drained\n• Still wet after 3 hours → Poorly drained\n\nClay soils are usually poorly drained; sandy soils drain fast. Heavy rainfall can temporarily affect the result.',
  },
  shelter: {
    title: 'How sheltered is this spot?',
    body: '• Exposed — open to wind from most directions; no surrounding trees, fences, or buildings to break the gusts\n• Sheltered — protected by a wall, fence, hedge, or building on the windward side\n• Coastal — within a mile or so of the sea; expect salt-laden winds but often mild winters with fewer hard frosts',
  },
  frost_pocket: {
    title: 'What is a frost pocket?',
    body: 'Cold air is heavier than warm air, so on still nights it drains downhill and collects in low-lying hollows, dips, and at the base of slopes or solid walls.\n\nThese spots can be 3–5 °C colder than the surrounding garden and suffer later spring frosts. Signs: you\'re at the bottom of a slope, water pools after rain, or you notice your plants frosted when neighbours\' aren\'t.',
  },
}

// ─── Help tip — button only ───────────────────────────────────────────────────
function HelpBtn({ field, openField, onToggle }) {
  const isOpen = openField === field
  return (
    <button
      type="button"
      onClick={() => onToggle(field)}
      aria-label={`Help for ${field}`}
      className={`w-4 h-4 rounded-full border text-[9px] font-bold
                  flex items-center justify-center flex-shrink-0
                  transition-colors leading-none
                  ${isOpen
                    ? 'bg-fern border-fern text-sage'
                    : 'bg-white border-moss/60 text-subtle'}`}
    >
      ?
    </button>
  )
}

// ─── Help panel — inline below label row ─────────────────────────────────────
function HelpPanel({ field, openField }) {
  if (openField !== field) return null
  const help = HELP[field]
  return (
    <div className="bg-leaf border border-moss/30 rounded-xl px-3 py-3">
      <p className="text-xs font-semibold text-fern mb-1">{help.title}</p>
      {help.body.split('\n\n').map((para, i) => (
        <p key={i} className={`text-xs text-muted leading-relaxed whitespace-pre-line${i > 0 ? ' mt-2' : ''}`}>
          {para}
        </p>
      ))}
    </div>
  )
}

// ─── Pill selector ────────────────────────────────────────────────────────────
function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(value === opt ? '' : opt)}
          className={`text-xs px-3 py-1.5 rounded-full border font-medium
                      transition-colors
                      ${value === opt
                        ? 'bg-fern text-sage border-fern'
                        : 'bg-white border-moss/40 text-subtle'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

// ─── Zone attribute chips (compact display on card) ───────────────────────────
function Chip({ label }) {
  if (!label) return null
  return (
    <span className="text-[10px] bg-leaf text-fern px-2 py-0.5
                     rounded-full whitespace-nowrap">
      {label}
    </span>
  )
}

// ─── Zone card ────────────────────────────────────────────────────────────────
function ZoneCard({ zone, onEdit, onDelete }) {
  const chips = [
    zone.aspect       && `Faces ${zone.aspect}`,
    zone.sun_exposure,
    zone.soil_type    && `${zone.soil_type} soil`,
    zone.shelter,
    zone.frost_pocket && 'Frost pocket',
  ].filter(Boolean)

  return (
    <div className="bg-white border border-moss/40 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-serif text-dark text-base leading-tight">{zone.name}</p>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => onEdit(zone)}
            className="text-xs text-fern font-medium underline underline-offset-2
                       active:opacity-60 transition-opacity"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(zone)}
            className="text-xs text-clay font-medium underline underline-offset-2
                       active:opacity-60 transition-opacity"
          >
            Delete
          </button>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {chips.map(c => <Chip key={c} label={c} />)}
        </div>
      )}

      {zone.notes && (
        <p className="text-xs text-subtle mt-2 leading-relaxed italic">
          {zone.notes}
        </p>
      )}

      {chips.length === 0 && !zone.notes && (
        <p className="text-xs text-subtle/60 mt-1">No details added yet — tap Edit to add</p>
      )}
    </div>
  )
}

// ─── Zone form — full-screen overlay ─────────────────────────────────────────
// Using a full-screen approach avoids keyboard-hiding and width issues
// that plague bottom sheets on mobile
function ZoneSheet({ zone, onSave, onClose }) {
  // Normalise null DB values to empty strings so .trim() never crashes
  const [form, setForm] = useState(zone ? {
    name:          zone.name          || '',
    aspect:        zone.aspect        || '',
    sun_exposure:  zone.sun_exposure  || '',
    soil_type:     zone.soil_type     || '',
    soil_drainage: zone.soil_drainage || '',
    shelter:       zone.shelter       || '',
    frost_pocket:  zone.frost_pocket  ?? false,
    notes:         zone.notes         || '',
  } : BLANK_ZONE)

  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)
  const [helpOpen, setHelpOpen] = useState(null)

  const set        = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const toggleHelp = (field)    => setHelpOpen(h => h === field ? null : field)

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Please give this zone a name.'); return }
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Save null for cleared optional fields so edits properly clear values
      const payload = {
        user_id:       user.id,
        name:          form.name.trim(),
        aspect:        form.aspect        || null,
        sun_exposure:  form.sun_exposure  || null,
        soil_type:     form.soil_type     || null,
        soil_drainage: form.soil_drainage || null,
        shelter:       form.shelter       || null,
        frost_pocket:  form.frost_pocket  || false,
        notes:         form.notes.trim()  || null,
      }

      if (zone?.id) {
        const { error } = await supabase.from('garden_zones')
          .update(payload).eq('id', zone.id)
        if (error) throw error
        // Cascade rename to any plants that reference the old zone name
        if (payload.name !== zone.name) {
          await supabase
            .from('user_plants')
            .update({ location: payload.name })
            .eq('user_id', user.id)
            .eq('location', zone.name)
        }
      } else {
        const { error } = await supabase.from('garden_zones').insert(payload)
        if (error) throw error
      }
      onSave()
    } catch (err) {
      setError(err.message || 'Could not save zone — please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 left-0 right-0 max-w-md mx-auto
                    bg-parchment z-[70] flex flex-col overflow-hidden">

      {/* Header — matches app TopBar style */}
      <div className="bg-fern px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onClose}
          className="text-sage/80 active:text-sage transition-colors p-1 flex-shrink-0"
          aria-label="Close"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <span className="font-serif text-sage text-lg leading-tight">
          {zone?.id ? 'Edit zone' : 'New garden zone'}
        </span>
      </div>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
            Zone name
          </label>
          <input
            type="text"
            placeholder="e.g. Front garden, Raised bed, Greenhouse"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            className="w-full bg-white border border-moss/40 rounded-xl
                       px-4 py-3 text-sm text-dark placeholder:text-subtle/50
                       focus:outline-none focus:border-fern transition-colors"
          />
        </div>

        {/* Aspect */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Aspect — which direction does it face?
            </label>
            <HelpBtn field="aspect" openField={helpOpen} onToggle={toggleHelp} />
          </div>
          <HelpPanel field="aspect" openField={helpOpen} />
          <PillGroup options={ASPECTS} value={form.aspect}
            onChange={v => set('aspect', v)} />
        </div>

        {/* Sun exposure */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Sun exposure
            </label>
            <HelpBtn field="sun_exposure" openField={helpOpen} onToggle={toggleHelp} />
          </div>
          <HelpPanel field="sun_exposure" openField={helpOpen} />
          <PillGroup options={SUN} value={form.sun_exposure}
            onChange={v => set('sun_exposure', v)} />
        </div>

        {/* Soil type */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Soil type
            </label>
            <HelpBtn field="soil_type" openField={helpOpen} onToggle={toggleHelp} />
          </div>
          <HelpPanel field="soil_type" openField={helpOpen} />
          <PillGroup options={SOILS} value={form.soil_type}
            onChange={v => set('soil_type', v)} />
        </div>

        {/* Soil drainage */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Soil drainage
            </label>
            <HelpBtn field="soil_drainage" openField={helpOpen} onToggle={toggleHelp} />
          </div>
          <HelpPanel field="soil_drainage" openField={helpOpen} />
          <PillGroup options={DRAINAGE} value={form.soil_drainage}
            onChange={v => set('soil_drainage', v)} />
        </div>

        {/* Shelter */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Shelter
            </label>
            <HelpBtn field="shelter" openField={helpOpen} onToggle={toggleHelp} />
          </div>
          <HelpPanel field="shelter" openField={helpOpen} />
          <PillGroup options={SHELTER} value={form.shelter}
            onChange={v => set('shelter', v)} />
        </div>

        {/* Frost pocket toggle */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between bg-white border
                          border-moss/40 rounded-xl px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-dark font-medium">Frost pocket</p>
                <HelpBtn field="frost_pocket" openField={helpOpen} onToggle={toggleHelp} />
              </div>
              <p className="text-xs text-subtle mt-0.5">
                Low-lying spots where cold air settles
              </p>
            </div>
            <button
              type="button"
              onClick={() => set('frost_pocket', !form.frost_pocket)}
              className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                          ${form.frost_pocket ? 'bg-fern' : 'bg-moss/30'}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow
                                transition-transform
                                ${form.frost_pocket ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>
          <HelpPanel field="frost_pocket" openField={helpOpen} />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
            Notes
          </label>
          <textarea
            placeholder="Anything else worth knowing about this spot…"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
            className="w-full bg-white border border-moss/40 rounded-xl
                       px-4 py-3 text-sm text-dark placeholder:text-subtle/50
                       focus:outline-none focus:border-fern transition-colors
                       resize-none"
          />
        </div>

        {error && (
          <p className="text-sm text-clay">{error}</p>
        )}
      </div>

      {/* Sticky save button */}
      <div className="flex-shrink-0 px-4 py-4 border-t border-moss/20 bg-parchment">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-fern text-sage text-sm font-medium
                     py-3.5 rounded-xl disabled:opacity-50
                     active:opacity-80 transition-opacity"
        >
          {saving ? 'Saving…' : zone?.id ? 'Save changes' : 'Create zone'}
        </button>
      </div>
    </div>
  )
}

// ─── Delete confirmation ───────────────────────────────────────────────────────
function DeleteConfirm({ zone, plantCount, onConfirm, onCancel, deleting }) {
  const hasPlants = plantCount > 0
  const plantWord = plantCount === 1 ? 'plant' : 'plants'

  return (
    <>
      <div className="fixed inset-0 bg-dark/40 z-[60]" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                      bg-parchment rounded-t-2xl z-[70] px-5 pt-4 pb-10">

        {/* Handle */}
        <div
          className="flex justify-center pb-4 cursor-pointer"
          onClick={onCancel}
        >
          <div className="w-10 h-1 bg-moss rounded-full" />
        </div>

        <p className="font-serif text-dark text-lg mb-2">Delete "{zone.name}"?</p>

        {hasPlants ? (
          <>
            <div className="bg-clay/10 border border-clay/30 rounded-xl px-4 py-3 mb-4">
              <p className="text-sm text-clay font-medium mb-1">
                {plantCount} {plantWord} assigned to this zone
              </p>
              <p className="text-sm text-subtle leading-relaxed">
                They won't be deleted — they'll be moved back to unallocated so you
                can reassign them to another zone.
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-subtle mb-5 leading-relaxed">
            This zone will be permanently removed.
          </p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 bg-leaf text-fern text-sm font-medium
                       py-3 rounded-xl active:opacity-70 transition-opacity"
          >
            Keep zone
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-clay text-white text-sm font-medium
                       py-3 rounded-xl disabled:opacity-50
                       active:opacity-80 transition-opacity"
          >
            {deleting
              ? 'Deleting…'
              : hasPlants
                ? `Delete & unallocate ${plantCount} ${plantWord}`
                : 'Delete zone'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GardenZones() {
  const { user }          = useAuth()
  const [zones, setZones] = useState([])
  const [loading, setLoading]         = useState(true)
  const [editZone, setEditZone]       = useState(null)  // zone object | 'new'
  const [deleteZone, setDeleteZone]   = useState(null)
  const [deletePlantCount, setDeletePlantCount] = useState(0)
  const [deleting, setDeleting]       = useState(false)

  const fetchZones = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('garden_zones')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      setZones(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchZones() }, [])

  const handleSaved = () => {
    setEditZone(null)
    fetchZones()
  }

  // Fetch how many plants belong to this zone before showing the confirm dialog
  const handleDeleteClick = async (zone) => {
    const { count } = await supabase
      .from('user_plants')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('location', zone.name)
    setDeletePlantCount(count || 0)
    setDeleteZone(zone)
  }

  const handleDelete = async () => {
    if (!deleteZone) return
    setDeleting(true)
    try {
      // Orphan plants first — set their location to null
      if (deletePlantCount > 0) {
        await supabase
          .from('user_plants')
          .update({ location: null })
          .eq('user_id', user.id)
          .eq('location', deleteZone.name)
      }
      // Then delete the zone
      await supabase.from('garden_zones').delete().eq('id', deleteZone.id)
      setDeleteZone(null)
      setDeletePlantCount(0)
      fetchZones()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />

      <main className="flex-1 p-4 flex flex-col gap-3">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-dark text-xl">My Garden Zones</h1>
            <p className="text-xs text-subtle mt-0.5">
              {zones.length === 0
                ? 'Create zones to organise your garden'
                : `${zones.length} ${zones.length === 1 ? 'zone' : 'zones'}`}
            </p>
          </div>
          <button
            onClick={() => setEditZone('new')}
            className="bg-fern text-sage text-sm font-medium px-4 py-2
                       rounded-xl active:opacity-80 transition-opacity flex-shrink-0"
          >
            + Add zone
          </button>
        </div>

        {/* Zone list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-moss/30 border-t-fern
                            rounded-full animate-spin" />
          </div>
        ) : zones.length === 0 ? (
          <div className="flex flex-col items-center text-center py-16 gap-4 px-6">
            <div className="w-16 h-16 bg-leaf rounded-full flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="12" stroke="#44593b" strokeWidth="1.5"/>
                <line x1="16" y1="6"  x2="16" y2="10" stroke="#44593b" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="16" y1="22" x2="16" y2="26" stroke="#44593b" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="6"  y1="16" x2="10" y2="16" stroke="#44593b" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="22" y1="16" x2="26" y2="16" stroke="#44593b" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="16" cy="16" r="2" fill="#44593b"/>
              </svg>
            </div>
            <div>
              <p className="font-serif text-dark text-lg mb-1">No zones yet</p>
              <p className="text-sm text-muted leading-relaxed">
                Zones help you organise your garden and will help Sown suggest
                the right plants for each spot.
              </p>
            </div>
            <button
              onClick={() => setEditZone('new')}
              className="bg-fern text-sage text-sm font-medium
                         px-6 py-3 rounded-xl active:opacity-80 transition-opacity"
            >
              Create your first zone
            </button>
          </div>
        ) : (
          <>
            {zones.map(zone => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                onEdit={z => setEditZone(z)}
                onDelete={handleDeleteClick}
              />
            ))}
            <p className="text-xs text-subtle text-center pt-1 pb-2 leading-relaxed px-4">
              Zone attributes will be used to match plants to your garden in a future update.
            </p>
          </>
        )}
      </main>

      {/* Add / edit sheet */}
      {editZone && (
        <ZoneSheet
          zone={editZone === 'new' ? null : editZone}
          onSave={handleSaved}
          onClose={() => setEditZone(null)}
        />
      )}

      {/* Delete confirmation */}
      {deleteZone && (
        <DeleteConfirm
          zone={deleteZone}
          plantCount={deletePlantCount}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteZone(null); setDeletePlantCount(0) }}
          deleting={deleting}
        />
      )}
    </div>
  )
}

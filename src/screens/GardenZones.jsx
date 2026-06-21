import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import TopBar from '../components/TopBar'

// ─── Option sets ──────────────────────────────────────────────────────────────
const ASPECTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const SUN      = ['Full sun', 'Partial shade', 'Full shade']
const SOILS    = ['Clay', 'Sandy', 'Loam', 'Chalk', 'Peat', 'Silty']
const DRAINAGE = ['Well drained', 'Moist but well drained', 'Poorly drained']
const SHELTER  = ['Exposed', 'Sheltered', 'Coastal']

const BLANK_ZONE = {
  name: '', aspect: '', sun_exposure: '', soil_type: '',
  soil_drainage: '', shelter: '', frost_pocket: false, notes: '',
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
        <div className="flex gap-2 flex-shrink-0">
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
        <p className="text-xs text-subtle/60 mt-1">No details added yet</p>
      )}
    </div>
  )
}

// ─── Zone form sheet ──────────────────────────────────────────────────────────
function ZoneSheet({ zone, onSave, onClose }) {
  const [form, setForm]     = useState(zone || BLANK_ZONE)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Please give this zone a name.'); return }
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
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
    <>
      <div className="fixed inset-0 bg-dark/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                      bg-parchment rounded-t-2xl z-[70] max-h-[92vh]
                      flex flex-col">

        {/* Handle — tap to dismiss */}
        <div
          className="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer"
          onClick={onClose}
        >
          <div className="w-10 h-1 bg-moss rounded-full" />
        </div>

        <div className="overflow-y-auto px-5 pb-12 flex flex-col gap-5">
          <h2 className="font-serif text-dark text-xl pt-2">
            {zone?.id ? 'Edit zone' : 'New garden zone'}
          </h2>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Zone name
            </label>
            <input
              autoFocus
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
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Aspect — which direction does it face?
            </label>
            <PillGroup options={ASPECTS} value={form.aspect} onChange={v => set('aspect', v)} />
          </div>

          {/* Sun exposure */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Sun exposure
            </label>
            <PillGroup options={SUN} value={form.sun_exposure} onChange={v => set('sun_exposure', v)} />
          </div>

          {/* Soil type */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Soil type
            </label>
            <PillGroup options={SOILS} value={form.soil_type} onChange={v => set('soil_type', v)} />
          </div>

          {/* Soil drainage */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Soil drainage
            </label>
            <PillGroup options={DRAINAGE} value={form.soil_drainage} onChange={v => set('soil_drainage', v)} />
          </div>

          {/* Shelter */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] text-subtle uppercase tracking-widest font-medium">
              Shelter
            </label>
            <PillGroup options={SHELTER} value={form.shelter} onChange={v => set('shelter', v)} />
          </div>

          {/* Frost pocket */}
          <div className="flex items-center justify-between bg-white border
                          border-moss/40 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm text-dark font-medium">Frost pocket</p>
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

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-leaf text-fern text-sm font-medium
                         py-3 rounded-xl active:opacity-70 transition-opacity"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-fern text-sage text-sm font-medium
                         py-3 rounded-xl disabled:opacity-50
                         active:opacity-80 transition-opacity"
            >
              {saving ? 'Saving…' : zone?.id ? 'Save changes' : 'Create zone'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Delete confirmation ───────────────────────────────────────────────────────
function DeleteConfirm({ zone, onConfirm, onCancel, deleting }) {
  return (
    <>
      <div className="fixed inset-0 bg-dark/40 z-[60]" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto
                      bg-parchment rounded-t-2xl z-[70] px-5 pt-5 pb-10">
        <div className="w-10 h-1 bg-moss rounded-full mx-auto mb-5" />
        <p className="font-serif text-dark text-lg mb-1">Delete "{zone.name}"?</p>
        <p className="text-sm text-subtle mb-5 leading-relaxed">
          This zone will be removed. Plants saved to this zone won't be deleted —
          they'll just lose their zone label.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 bg-leaf text-fern text-sm font-medium
                       py-3 rounded-xl active:opacity-70 transition-opacity"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 bg-clay text-white text-sm font-medium
                       py-3 rounded-xl disabled:opacity-50
                       active:opacity-80 transition-opacity"
          >
            {deleting ? 'Deleting…' : 'Delete zone'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GardenZones() {
  const navigate          = useNavigate()
  const { user }          = useAuth()
  const [zones, setZones] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editZone, setEditZone] = useState(null)   // zone object | 'new'
  const [deleteZone, setDeleteZone] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  const handleDelete = async () => {
    if (!deleteZone) return
    setDeleting(true)
    try {
      await supabase.from('garden_zones').delete().eq('id', deleteZone.id)
      setDeleteZone(null)
      fetchZones()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-20">
      <TopBar />

      <main className="flex-1 p-4 flex flex-col gap-3">

        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
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
            <div className="w-16 h-16 bg-leaf rounded-full flex items-center
                            justify-center">
              {/* Simple compass/garden icon */}
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="12" stroke="#44593b" strokeWidth="1.5"/>
                <line x1="16" y1="6" x2="16" y2="10" stroke="#44593b" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="16" y1="22" x2="16" y2="26" stroke="#44593b" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="6" y1="16" x2="10" y2="16" stroke="#44593b" strokeWidth="1.5" strokeLinecap="round"/>
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
          <div className="flex flex-col gap-3 w-full">
            {zones.map(zone => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                onEdit={z => setEditZone(z)}
                onDelete={z => setDeleteZone(z)}
              />
            ))}
            <p className="text-xs text-subtle text-center pt-2 pb-4 leading-relaxed px-4">
              Zone attributes like aspect and soil type will be used to match
              plants to your garden in a future update.
            </p>
          </div>
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
          onConfirm={handleDelete}
          onCancel={() => setDeleteZone(null)}
          deleting={deleting}
        />
      )}
    </div>
  )
}

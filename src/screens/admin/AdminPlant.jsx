// src/screens/admin/AdminPlant.jsx
// Admin plant editor: every catalogue field, care tasks, label photos,
// HTA safety and verification for one profile.
//
// Species/variety aware: on a variety, an empty field inherits the species'
// value (shown under the field), so only what differs is stored. Safety is
// set on the species. Fields changed here are marked 'jo' in field_sources.

import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import TopBar from '../../components/TopBar'
import { LABELS, label, formatMonths, formatRange, botanicalName, safetyWording } from '../../lib/catalogue'
import { CareSections, FactsGrid, profileFacts } from '../../components/PlantCareDetails'
import HtaLookup from './HtaLookup'
import {
  Field, TextInput, TextArea, ListInput, Choice, MultiChoice, YesNo,
  MonthsPicker, RangeInput, ProblemsInput, Section,
} from './adminFields'

// ─── Field definitions ────────────────────────────────────────────────────────
const opts = (group, keys) => (keys || Object.keys(LABELS[group])).map(v => ({ value: v, label: LABELS[group][v] }))
const HARDINESS = ['H1a', 'H1b', 'H1c', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'].map(v => ({ value: v, label: v }))
const YNU = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Unknown' }]

const GROUPS = [
  { title: 'Identity', fields: [
    { key: 'genus', label: 'Genus', type: 'text', speciesOnly: true },
    { key: 'species', label: 'Species', type: 'text', speciesOnly: true,
      hint: 'Leave empty for a genus record, e.g. Rosa for Rosa ‘Peace’.' },
    { key: 'cultivar', label: 'Cultivar', type: 'text', varietyOnly: true },
    { key: 'common_names', label: 'Common names', type: 'list', hint: 'One per line. The first is shown by default.' },
    { key: 'synonyms', label: 'Synonyms', type: 'list' },
    { key: 'label_aliases', label: 'Label aliases', type: 'list', hint: 'Names as growers print them. Helps the scanner match.' },
    { key: 'family', label: 'Family', type: 'text' },
    { key: 'plant_type', label: 'Plant type', type: 'choice', options: opts('plant_type') },
  ] },
  { title: 'Growing conditions', fields: [
    { key: 'rhs_hardiness', label: 'RHS hardiness', type: 'choice', options: HARDINESS },
    { key: 'sun', label: 'Sun', type: 'multi', options: opts('sun') },
    { key: 'aspect', label: 'Aspect', type: 'multi', options: ['N', 'E', 'S', 'W'].map(v => ({ value: v, label: v })) },
    { key: 'exposure', label: 'Exposure', type: 'multi', options: opts('exposure') },
    { key: 'soil_type', label: 'Soil type', type: 'multi', options: opts('soil_type') },
    { key: 'soil_moisture', label: 'Soil moisture', type: 'choice', options: opts('soil_moisture') },
    { key: 'soil_ph', label: 'Soil pH', type: 'multi', options: opts('soil_ph') },
    { key: 'height', label: 'Height', type: 'range', min: 'height_cm_min', max: 'height_cm_max', unit: 'cm' },
    { key: 'spread', label: 'Spread', type: 'range', min: 'spread_cm_min', max: 'spread_cm_max', unit: 'cm' },
    { key: 'years', label: 'Years to full size', type: 'range', min: 'years_to_full_size_min', max: 'years_to_full_size_max', unit: 'years' },
    { key: 'suits_containers', label: 'Suits containers', type: 'yesno' },
    { key: 'difficulty', label: 'Difficulty', type: 'choice', options: opts('difficulty') },
    { key: 'water_need', label: 'Water need', type: 'choice', options: opts('water_need') },
    { key: 'water_notes', label: 'Water notes', type: 'textarea', rows: 2 },
    { key: 'flowering_months', label: 'Flowering months', type: 'months' },
    { key: 'flower_colours', label: 'Flower colours', type: 'list', hint: 'One per line, e.g. deep purple. Usually a variety fact.' },
  ] },
  { title: 'Content', fields: [
    { key: 'summary', label: 'Summary', type: 'textarea', rows: 2, hint: 'One or two sentences for the top of the plant page.' },
    { key: 'care_planting', label: 'Care guide: planting', type: 'textarea' },
    { key: 'care_ongoing', label: 'Care guide: ongoing care', type: 'textarea' },
    { key: 'care_through_year', label: 'Care guide: through the year', type: 'textarea' },
    { key: 'common_problems', label: 'Common problems', type: 'problems' },
    { key: 'beginner_tips', label: 'Beginner tips', type: 'list', hint: 'One per line.' },
    { key: 'good_for_pollinators', label: 'Good for pollinators', type: 'choice', options: YNU },
  ] },
  { title: 'Sown kit', fields: [
    { key: 'in_sown_kit', label: 'In a Sown kit', type: 'yesno', notNull: true },
    { key: 'kit_ids', label: 'Kit IDs', type: 'list', notNull: true },
    { key: 'kit_guide', label: 'Kit guide', type: 'textarea', rows: 4 },
  ] },
]

const columnsOf = f => (f.type === 'range' ? [f.min, f.max] : [f.key])
const ALL_FIELDS = GROUPS.flatMap(g => g.fields)

// ─── Normalising values for comparison and saving ────────────────────────────
function normalise(f, value) {
  switch (f.type) {
    case 'text': case 'textarea': case 'choice': {
      const v = typeof value === 'string' ? value.trim() : value
      return v === '' || v == null ? null : v
    }
    case 'list': {
      const items = (value || []).map(s => s.trim()).filter(Boolean)
      return items.length ? items : (f.notNull ? [] : null)
    }
    case 'multi': return value?.length ? value : null
    case 'months': return value?.length ? [...value].sort((a, b) => a - b) : null
    case 'yesno': return value == null ? (f.notNull ? false : null) : value
    case 'problems': {
      const items = (value || []).map(p => ({ problem: p.problem.trim(), what_to_do: (p.what_to_do || '').trim() }))
                                 .filter(p => p.problem)
      return items.length ? items : null
    }
    case 'range': return value === '' || value == null ? null : Number(value)
    default: return value ?? null
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

// What a variety would inherit, as text
function describe(f, row) {
  if (!row) return null
  if (f.type === 'range') return formatRange(row[f.min], row[f.max], f.unit)
  const v = row[f.key]
  if (v == null || (Array.isArray(v) && v.length === 0)) return null
  switch (f.type) {
    case 'list': return v.join(', ')
    case 'multi': return v.map(x => f.options.find(o => o.value === x)?.label || x).join(', ')
    case 'choice': return f.options.find(o => o.value === v)?.label || v
    case 'months': return formatMonths(v)
    case 'yesno': return v ? 'Yes' : 'No'
    case 'problems': return v.map(p => p.problem).join(', ')
    default: return String(v)
  }
}

// Same rule as public.make_plant_slug
function makeSlug(genus, species, cultivar) {
  return [genus, species, cultivar].filter(Boolean).join(' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// ─── Care task editor ─────────────────────────────────────────────────────────
const TASK_TYPES = opts('task_type')
const APPLIES = [
  { value: 'grown_from_seed', label: 'From seed' }, { value: 'grown_from_bulb', label: 'From bulb' },
  { value: 'bought_as_plant', label: 'Bought as a plant' }, { value: 'in_pot', label: 'In a pot' },
  { value: 'in_ground', label: 'In the ground' },
]

function TaskEditor({ task, plantId, onChanged, onCancelNew }) {
  const [t, setT] = useState(task)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setT(prev => ({ ...prev, [k]: v }))
  const isNew = !task.id
  const dirty = !same(t, task)

  const save = async () => {
    if (!t.task_type || !t.months?.length || !t.instructions?.trim()) {
      setError('Choose a task type, at least one month and write the instructions.'); return
    }
    setSaving(true); setError(null)
    const row = {
      plant_id: plantId, task_type: t.task_type, months: [...t.months].sort((a, b) => a - b),
      repeat: t.repeat, task_trigger: t.task_trigger,
      applies_to: t.applies_to?.length ? t.applies_to : APPLIES.map(a => a.value),
      instructions: t.instructions.trim(),
    }
    const { error: err } = isNew
      ? await supabase.from('plant_care_tasks').insert(row)
      : await supabase.from('plant_care_tasks').update(row).eq('id', t.id)
    setSaving(false)
    if (err) setError(err.message); else onChanged()
  }

  const remove = async () => {
    if (isNew) { onCancelNew(); return }
    setSaving(true)
    const { error: err } = await supabase.from('plant_care_tasks').delete().eq('id', t.id)
    setSaving(false)
    if (err) setError(err.message); else onChanged()
  }

  return (
    <div className="border border-moss/40 rounded-xl p-3 flex flex-col gap-3 bg-parchment/50" data-testid="task-editor">
      <Field label="Task"><Choice options={TASK_TYPES} value={t.task_type} onChange={v => set('task_type', v)} /></Field>
      <Field label="Months"><MonthsPicker value={t.months} onChange={v => set('months', v)} /></Field>
      <Field label="Repeat" hint="Once: ticked off once a year. Ongoing: a reminder through its months, no tick.">
        <Choice options={[{ value: 'once', label: 'Once a year' }, { value: 'ongoing', label: 'Ongoing reminder' }]}
                value={t.repeat} onChange={v => set('repeat', v || 'once')} />
      </Field>
      <Field label="Starts">
        <Choice options={[{ value: 'none', label: 'Any time in its months' }, { value: 'after_last_frost', label: 'After the last frost' }]}
                value={t.task_trigger} onChange={v => set('task_trigger', v || 'none')} />
      </Field>
      <Field label="Applies to" hint="Leave all off to apply to every plant.">
        <MultiChoice options={APPLIES} value={t.applies_to?.length === APPLIES.length ? [] : t.applies_to}
                     onChange={v => set('applies_to', v)} />
      </Field>
      <Field label="Instructions"><TextArea rows={2} value={t.instructions} onChange={v => set('instructions', v)} /></Field>
      {error && <p className="text-sm text-clay">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving || (!dirty && !isNew)}
          className="bg-fern text-sage text-xs font-medium px-4 py-2 rounded-lg disabled:opacity-40">
          {saving ? 'Saving…' : isNew ? 'Add task' : 'Save task'}
        </button>
        <button type="button" onClick={remove} disabled={saving}
          className="text-xs text-clay font-medium underline underline-offset-2">
          {isNew ? 'Cancel' : 'Delete task'}
        </button>
      </div>
    </div>
  )
}

// ─── Main editor ──────────────────────────────────────────────────────────────
export default function AdminPlant() {
  const { id } = useParams()
  const navigate = useNavigate()
  const fromLabel = useLocation().state?.fromLabel   // set by "Add from a label"
  const [profile, setProfile] = useState(null)
  const [parent, setParent] = useState(null)
  const [varieties, setVarieties] = useState([])
  const [form, setForm] = useState(null)
  const [tasks, setTasks] = useState([])
  const [parentTasks, setParentTasks] = useState([])
  const [newTask, setNewTask] = useState(null)
  const [labelPhotos, setLabelPhotos] = useState([])
  const [plantPhotos, setPlantPhotos] = useState([])
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)   // { type: 'error' | 'ok', text }
  const [partsDraft, setPartsDraft] = useState('')
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(async () => {
    const { data: p, error } = await supabase.from('plant_profiles').select('*').eq('id', id).single()
    if (error || !p) { setLoadError(error?.message || 'Plant not found'); return }
    const [{ data: par }, { data: vars }, { data: own }, { data: photos }] = await Promise.all([
      p.parent_id ? supabase.from('plant_profiles').select('*').eq('id', p.parent_id).single() : Promise.resolve({ data: null }),
      supabase.from('plant_profiles').select('id, cultivar, status').eq('parent_id', id).order('cultivar'),
      supabase.from('plant_care_tasks').select('*').eq('plant_id', id).order('created_at'),
      supabase.from('plant_label_photos').select('*').eq('plant_id', id).order('created_at'),
    ])
    const { data: pTasks } = p.parent_id
      ? await supabase.from('plant_care_tasks').select('*').eq('plant_id', p.parent_id).order('created_at')
      : { data: [] }
    let signed = []
    if (photos?.length) {
      const { data: urls } = await supabase.storage.from('catalogue-label-photos')
        .createSignedUrls(photos.map(ph => ph.storage_path), 3600)
      signed = photos.map((ph, i) => ({ ...ph, url: urls?.[i]?.signedUrl }))
    }
    setProfile(p); setParent(par); setVarieties(vars || []); setTasks(own || []); setParentTasks(pTasks || [])
    setLabelPhotos(signed)
    if (p.photo_paths?.length) {
      const { data: urls } = await supabase.storage.from('catalogue-photos').createSignedUrls(p.photo_paths, 3600)
      setPlantPhotos(p.photo_paths.map((path, i) => ({ path, url: urls?.[i]?.signedUrl })))
    } else setPlantPhotos([])
    setPartsDraft((par && p.safety_status == null ? par : p).harmful_parts || '')
    const f = { slug: p.slug }
    for (const field of ALL_FIELDS) for (const col of columnsOf(field)) f[col] = p[col] ?? (field.type === 'range' ? '' : null)
    setForm(f)
    setPreview(null)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loadError) return <div className="p-6 text-sm text-clay">{loadError}</div>
  if (!profile || !form) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-2 border-moss/30 border-t-fern rounded-full animate-spin" />
      </div>
    )
  }

  const isVariety = !!profile.parent_id
  const sources = profile.field_sources || {}
  const set = (col, v) => setForm(prev => ({ ...prev, [col]: v }))

  // Changed columns → { col: value }
  const changes = {}
  for (const f of ALL_FIELDS) {
    if ((f.speciesOnly && isVariety) || (f.varietyOnly && !isVariety)) continue
    for (const col of columnsOf(f)) {
      const next = normalise(f, form[col]), before = normalise(f, profile[col])
      if (!same(next, before)) changes[col] = next
    }
  }
  if (form.slug.trim() !== profile.slug) changes.slug = form.slug.trim()
  const dirty = Object.keys(changes).length > 0

  const save = async () => {
    setMessage(null)
    for (const f of ALL_FIELDS.filter(x => x.type === 'range')) {
      const lo = normalise(f, form[f.min]), hi = normalise(f, form[f.max])
      if (lo != null && hi != null && lo > hi) { setMessage({ type: 'error', text: `${f.label}: min is more than max.` }); return }
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug.trim())) {
      setMessage({ type: 'error', text: 'The slug can only use lowercase letters, numbers and single hyphens.' }); return
    }
    setSaving(true)
    const marked = Object.fromEntries(Object.keys(changes).filter(c => c !== 'slug').map(c => [c, 'jo']))
    const { error } = await supabase.from('plant_profiles')
      .update({ ...changes, field_sources: { ...sources, ...marked } })
      .eq('id', id)
    setSaving(false)
    if (error) {
      setMessage({ type: 'error', text: error.code === '23505' ? 'Another profile already uses that slug.' : error.message })
      return
    }
    setMessage({ type: 'ok', text: 'Saved.' })
    load()
  }

  const setVerified = async (verified) => {
    setMessage(null)
    const { error } = await supabase.rpc('set_profile_verified', { p_id: id, p_verified: verified })
    if (error) setMessage({ type: 'error', text: error.message }); else load()
  }

  const saveParts = async () => {
    const target = isVariety ? profile.parent_id : id
    const { error } = await supabase.from('plant_profiles')
      .update({ harmful_parts: partsDraft.trim() || null })
      .eq('id', target)
    if (error) setMessage({ type: 'error', text: error.message }); else load()
  }

  const togglePreview = async () => {
    if (preview) { setPreview(null); return }
    const [{ data: resolved }, { data: rTasks }] = await Promise.all([
      supabase.from('plant_profiles_resolved').select('*').eq('id', id).single(),
      supabase.from('plant_care_tasks_resolved').select('*').eq('for_plant_id', id),
    ])
    setPreview({ profile: resolved, tasks: rTasks || [] })
  }

  // Safety lives on the species
  const safetyRow = isVariety && profile.safety_status == null ? parent : profile
  const safety = safetyWording(safetyRow)
  const htaListed = ['hta_a', 'hta_b', 'hta_c', 'hta_bulb_or_fruit_label'].includes(safetyRow.safety_status)
  const name = botanicalName(isVariety ? { ...profile, genus: parent?.genus, species: parent?.species } : profile)
  const overriddenTypes = new Set(tasks.map(t => t.task_type))

  const verifyBlocked =
    !isVariety && profile.safety_status === 'unknown' ? 'Check safety against the HTA list first.'
    : isVariety && parent?.status !== 'verified' ? 'Verify the species first.'
    : dirty ? 'Save your changes first.'
    : null

  const renderInput = (f) => {
    switch (f.type) {
      case 'text': return <TextInput value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'textarea': return <TextArea rows={f.rows} value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'list': return <ListInput value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'choice': return <Choice options={f.options} value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'multi': return <MultiChoice options={f.options} value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'months': return <MonthsPicker value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'yesno': return <YesNo value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'problems': return <ProblemsInput value={form[f.key]} onChange={v => set(f.key, v)} />
      case 'range': return <RangeInput min={form[f.min]} max={form[f.max]} unit={f.unit}
                                       onChange={(lo, hi) => { set(f.min, lo); set(f.max, hi) }} />
      default: return null
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-parchment pb-28">
      <TopBar />
      <main className="flex-1 p-4 flex flex-col gap-4">

        {/* Header */}
        <div>
          <button onClick={() => navigate('/admin')} className="text-xs text-fern underline underline-offset-2">← Catalogue</button>
          <h1 className="font-serif text-dark text-xl mt-2 italic">{name}</h1>
          <p className="text-xs text-subtle mt-0.5">
            {isVariety
              ? <>Variety of <Link className="text-fern underline" to={`/admin/plant/${profile.parent_id}`}>{botanicalName(parent)}</Link>. Empty fields use the species' value.</>
              : <>Species record{varieties.length > 0 && <> · varieties: {varieties.map((v, i) => (
                  <span key={v.id}>{i > 0 && ', '}<Link className="text-fern underline" to={`/admin/plant/${v.id}`}>{v.cultivar}</Link></span>
                ))}</>}</>}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium
                              ${profile.status === 'verified' ? 'bg-fern text-sage' : 'bg-white text-clay border border-clay/40'}`}>
              {profile.status === 'verified' ? 'Verified by Sown' : 'Draft'}
            </span>
            <button onClick={togglePreview} className="text-xs text-fern underline underline-offset-2">
              {preview ? 'Hide preview' : 'Preview as users see it'}
            </button>
          </div>
        </div>

        {preview?.profile && (
          <div className="flex flex-col gap-3 border-2 border-dashed border-moss rounded-xl p-3">
            <FactsGrid facts={profileFacts(preview.profile)} />
            <CareSections profile={preview.profile} careTasks={preview.tasks} />
          </div>
        )}

        {fromLabel && (
          <div className="bg-leaf border border-fern/30 rounded-xl p-3 text-sm text-dark flex flex-col gap-1" data-testid="from-label">
            <p className="font-medium">Drafted from the label ({fromLabel.read_as}).</p>
            {fromLabel.label?.variety_fields?.length > 0 && (
              <p className="text-xs">On this variety from the label: {fromLabel.label.variety_fields.join(', ')}.</p>
            )}
            {fromLabel.label?.species_fields?.length > 0 && (
              <p className="text-xs">On the species from the label: {fromLabel.label.species_fields.join(', ')}.</p>
            )}
            {fromLabel.filled?.filled?.length > 0 && (
              <p className="text-xs">Claude filled {fromLabel.filled.filled.length} empty species field{fromLabel.filled.filled.length === 1 ? '' : 's'}
                {fromLabel.filled.tasks_added ? ` and ${fromLabel.filled.tasks_added} task${fromLabel.filled.tasks_added === 1 ? '' : 's'}` : ''}.</p>
            )}
            {fromLabel.status === 'verified' && <p className="text-xs">This plant was already verified, so its details weren't changed.</p>}
            <p className="text-xs text-subtle">Check the fields marked Label and Claude, then do the HTA lookup.</p>
          </div>
        )}

        {/* Label photos */}
        <Section title="Label photos">
          {labelPhotos.length === 0
            ? <p className="text-sm text-subtle">No label photos yet. Uploading arrives with "Add from a label".</p>
            : <div className="grid grid-cols-2 gap-2">
                {labelPhotos.map(ph => (
                  <a key={ph.id} href={ph.url} target="_blank" rel="noreferrer">
                    <img src={ph.url} alt="Label" className="w-full h-32 object-cover rounded-lg border border-moss/40" />
                  </a>
                ))}
              </div>}
        </Section>

        <Section title="Plant photos">
          {plantPhotos.length === 0
            ? <p className="text-sm text-subtle">No photos yet. Add your own when you add from a label.</p>
            : <div className="grid grid-cols-2 gap-2">
                {plantPhotos.map(ph => (
                  <a key={ph.path} href={ph.url} target="_blank" rel="noreferrer">
                    <img src={ph.url} alt="Plant" className="w-full h-32 object-cover rounded-lg border border-moss/40" />
                  </a>
                ))}
              </div>}
        </Section>

        {/* Fields */}
        <Section title="Slug">
          <Field label="Slug" hint="Matches the folder name in the photo archive.">
            <TextInput value={form.slug} onChange={v => set('slug', v)} />
          </Field>
          <button type="button" className="self-start text-xs text-fern underline underline-offset-2"
            onClick={() => set('slug', isVariety
              ? makeSlug(parent?.genus, parent?.species, normalise({ type: 'text' }, form.cultivar))
              : makeSlug(normalise({ type: 'text' }, form.genus), normalise({ type: 'text' }, form.species)))}>
            Make from the botanical name
          </button>
        </Section>

        {GROUPS.map(g => (
          <Section key={g.title} title={g.title}>
            {g.fields.filter(f => !(f.speciesOnly && isVariety) && !(f.varietyOnly && !isVariety)).map(f => {
              const cols = columnsOf(f)
              const empty = cols.every(c => normalise(f, form[c]) == null || (Array.isArray(form[c]) && !form[c].length))
              return (
                <Field key={f.key} label={f.label} hint={f.hint} source={sources[cols[0]]}
                       inherited={isVariety && empty ? describe(f, parent) : null}>
                  {renderInput(f)}
                </Field>
              )
            })}
          </Section>
        ))}

        {/* Care tasks */}
        <Section title="Care tasks" right={!newTask && (
          <button type="button" className="text-xs text-fern font-medium underline underline-offset-2"
            onClick={() => setNewTask({ task_type: '', months: [], repeat: 'once', task_trigger: 'none', applies_to: [], instructions: '' })}>
            + Add task
          </button>
        )}>
          {tasks.length === 0 && !newTask && <p className="text-sm text-subtle">No tasks{isVariety ? ' of its own' : ''} yet.</p>}
          {tasks.map(t => <TaskEditor key={t.id} task={t} plantId={id} onChanged={load} />)}
          {newTask && <TaskEditor task={newTask} plantId={id}
                                  onChanged={() => { setNewTask(null); load() }} onCancelNew={() => setNewTask(null)} />}
          {isVariety && parentTasks.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-subtle uppercase tracking-widest font-medium">From the species</p>
              {parentTasks.map(t => (
                <p key={t.id} className={`text-xs ${overriddenTypes.has(t.task_type) ? 'text-subtle line-through' : 'text-dark'}`}>
                  {label('task_type', t.task_type)} · {formatMonths(t.months)} · {t.instructions}
                  {overriddenTypes.has(t.task_type) && ' (replaced by this variety’s task)'}
                </p>
              ))}
            </div>
          )}
        </Section>

        {/* Safety */}
        <Section title="Safety (HTA)">
          {isVariety && <p className="text-xs text-subtle">Safety is set on the species and this variety inherits it.</p>}
          <div className="bg-leaf rounded-lg p-3 flex flex-col gap-1" data-testid="admin-safety">
            {safety.lines.map((l, i) => <p key={i} className="text-sm text-dark">{l}</p>)}
            {safetyRow.safety_verified_at && (
              <p className="text-[11px] text-subtle mt-1">
                Checked by {safetyRow.safety_verified_by_name || 'an admin'} on{' '}
                {new Date(safetyRow.safety_verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                {safetyRow.hta_edition && ` · ${safetyRow.hta_edition}`}
                {safetyRow.hta_ref && ` · ${safetyRow.hta_ref}`}
              </p>
            )}
          </div>
          {htaListed && (
            <Field label="Harmful parts" hint="Not in the HTA list: add from the guide, e.g. all parts, seeds, sap.">
              <div className="flex gap-2">
                <TextInput value={partsDraft} onChange={setPartsDraft} />
                <button type="button" onClick={saveParts}
                  disabled={(partsDraft.trim() || null) === (safetyRow.harmful_parts || null)}
                  className="bg-fern text-sage text-xs font-medium px-3 rounded-lg disabled:opacity-40">Save</button>
              </div>
            </Field>
          )}
          <HtaLookup
            key={safetyRow.id}
            profileId={id}
            initialQuery={[isVariety ? parent?.genus : form.genus, isVariety ? parent?.species : form.species].filter(Boolean).join(' ')}
            onApplied={load}
          />
        </Section>

        {/* Verification */}
        <Section title="Verification">
          {profile.status === 'verified' ? (
            <>
              <p className="text-sm text-dark">
                Verified by {profile.verified_by_name || 'an admin'} on{' '}
                {new Date(profile.verified_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
              </p>
              <button type="button" onClick={() => setVerified(false)}
                className="self-start text-xs text-clay font-medium underline underline-offset-2">
                Move back to draft{!isVariety && varieties.some(v => v.status === 'verified') ? ' (and its varieties)' : ''}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-subtle">Verify once the care details and safety are checked.</p>
              <button type="button" onClick={() => setVerified(true)} disabled={!!verifyBlocked}
                className="self-start bg-fern text-sage text-sm font-medium px-5 py-2.5 rounded-xl disabled:opacity-40">
                Verify
              </button>
              {verifyBlocked && <p className="text-xs text-clay">{verifyBlocked}</p>}
            </>
          )}
        </Section>
      </main>

      {/* Sticky save bar */}
      <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 pb-2 z-30">
        {message && (
          <p className={`text-sm mb-2 px-3 py-2 rounded-lg ${message.type === 'error' ? 'bg-clay/20 text-dark' : 'bg-leaf text-fern'}`}>
            {message.text}
          </p>
        )}
        <button type="button" onClick={save} disabled={!dirty || saving}
          className="w-full bg-fern text-sage text-sm font-medium py-3 rounded-xl shadow-lg disabled:opacity-40">
          {saving ? 'Saving…' : dirty ? `Save ${Object.keys(changes).length} change${Object.keys(changes).length === 1 ? '' : 's'}` : 'No changes'}
        </button>
      </div>
    </div>
  )
}

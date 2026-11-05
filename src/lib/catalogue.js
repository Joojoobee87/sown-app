// src/lib/catalogue.js
// Display helpers for the plant catalogue (plant_profiles_resolved rows).
// The database stores short codes (e.g. 'partial_shade'); these turn them
// into the wording shown in the app.

export const LABELS = {
  sun: { full_sun: 'Full sun', partial_shade: 'Partial shade', full_shade: 'Full shade' },
  exposure: { sheltered: 'Sheltered', exposed: 'Exposed' },
  soil_type: { clay: 'Clay', loam: 'Loam', sand: 'Sand', chalk: 'Chalk' },
  soil_moisture: {
    well_drained: 'Well-drained',
    moist_but_well_drained: 'Moist but well-drained',
    poorly_drained: 'Poorly drained',
  },
  soil_ph: { acid: 'Acid', neutral: 'Neutral', alkaline: 'Alkaline' },
  plant_type: {
    annual: 'Annual', biennial: 'Biennial', perennial: 'Perennial', shrub: 'Shrub',
    tree: 'Tree', bulb: 'Bulb', climber: 'Climber', grass: 'Grass', fern: 'Fern',
    herb: 'Herb', vegetable: 'Vegetable', fruit: 'Fruit',
  },
  difficulty: { beginner: 'Beginner', some_experience: 'Some experience', expert: 'Expert' },
  water_need: { low: 'Low', medium: 'Medium', high: 'High' },
  task_type: {
    sow_indoors: 'Sow indoors', sow_outdoors: 'Sow outdoors', plant_out: 'Plant out',
    plant: 'Plant', feed: 'Feed', prune: 'Prune', deadhead: 'Deadhead', divide: 'Divide',
    lift_and_store: 'Lift and store', protect_for_winter: 'Protect for winter', harvest: 'Harvest',
    mulch: 'Mulch', cut_back: 'Cut back', support: 'Support or tie in', pinch_out: 'Pinch out',
    take_cuttings: 'Take cuttings', repot: 'Repot or top-dress', bring_indoors: 'Bring indoors',
  },
  pet_kind: {
    dogs: 'dogs', cats: 'cats', rabbits: 'rabbits', rodents: 'rodents',
    tortoises: 'tortoises', caged_birds: 'caged birds', poultry: 'poultry',
  },
  zone_type: {
    border: 'Border', bed: 'Bed', pots: 'Pots', greenhouse: 'Greenhouse',
    indoors: 'Indoors', lawn: 'Lawn', other: 'Other',
  },
  aspect: { N: 'North', NE: 'North-east', E: 'East', SE: 'South-east', S: 'South', SW: 'South-west', W: 'West', NW: 'North-west' },
}

export const label = (group, code) => (code && LABELS[group]?.[code]) || null
export const labelList = (group, codes) =>
  (codes || []).map(c => label(group, c)).filter(Boolean).join(', ') || null

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// [6,7,8] → "Jun–Aug";  [3,8] → "Mar, Aug";  [11,12,1,2] → "Nov–Feb"
export function formatMonths(months) {
  const set = [...new Set(months || [])].filter(m => m >= 1 && m <= 12).sort((a, b) => a - b)
  if (set.length === 0) return null
  if (set.length === 12) return 'All year'
  // Find runs of consecutive months, joining December to January
  const runs = []
  for (const m of set) {
    const last = runs[runs.length - 1]
    if (last && m === last[last.length - 1] + 1) last.push(m)
    else runs.push([m])
  }
  if (runs.length > 1 && runs[0][0] === 1 && runs[runs.length - 1].at(-1) === 12) {
    runs[0] = [...runs.pop(), ...runs[0]]
  }
  return runs
    .map(r => (r.length === 1 ? MONTHS[r[0] - 1] : `${MONTHS[r[0] - 1]}–${MONTHS[r.at(-1) - 1]}`))
    .join(', ')
}

export function formatRange(min, max, unit = 'cm') {
  if (min == null && max == null) return null
  if (min == null || max == null || min === max) return `${min ?? max} ${unit}`
  return `${min}–${max} ${unit}`
}

// Lavandula angustifolia 'Hidcote'
export function botanicalName(p) {
  if (!p) return ''
  const base = [p.genus, p.species].filter(Boolean).join(' ')
  return p.cultivar ? `${base} '${p.cultivar}'` : base
}

// The name to show first: first common name, else the botanical name
export function displayName(p) {
  return p?.common_names?.[0] || botanicalName(p)
}

export function verificationLabel(p) {
  return p?.status === 'verified' ? 'Verified by Sown' : 'Sown guide (unverified)'
}

// ─── Safety wording (from the spec; never a "safe" badge) ────────────────────
export const SAFETY_DISCLAIMER =
  "Sown's safety information is a guide, not medical or veterinary advice. " +
  "If you're worried, call NHS 111 for people, or your vet for pets."

const HTA_LISTED = ['hta_a', 'hta_b', 'hta_c', 'hta_bulb_or_fruit_label']

// Returns { tone: 'unknown' | 'harmful' | 'not_listed', lines: [..] }
export function safetyWording(p) {
  const status = p?.safety_status || 'unknown'

  if (HTA_LISTED.includes(status)) {
    const who = { people: 'people', pets: 'pets', both: 'people and pets' }[p.harmful_to] || 'people or pets'
    const how = [p.harmful_if_eaten && 'eaten', p.skin_irritant && 'touched'].filter(Boolean).join(' or ')
    const lines = [`Can be harmful to ${who}${how ? ` if ${how}` : ''}.`]
    if (p.harmful_parts) lines.push(`Parts: ${p.harmful_parts}.`)
    if (p.hta_condition) lines.push(`Applies to: ${p.hta_condition}.`)
    if (p.pets_affected?.length) {
      lines.push(`Pets named in the guide: ${labelList('pet_kind', p.pets_affected)}. Other pets may still be affected.`)
    }
    lines.push('Based on the HTA Guide to Potentially Harmful Plants.')
    return { tone: 'harmful', lines }
  }

  if (status === 'not_on_hta_list') {
    return {
      tone: 'not_listed',
      lines: ["Not on the HTA list of potentially harmful plants. That doesn't guarantee it's safe, so take care with children and pets."],
    }
  }

  return {
    tone: 'unknown',
    lines: ["We haven't checked this plant's safety yet. Keep it away from children and pets until you know more."],
  }
}

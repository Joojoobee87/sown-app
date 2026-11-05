// Shared care calendar logic used by Home and Calendar screens.
//
// Tasks come from the catalogue (plant_care_tasks_resolved: a variety's own
// tasks plus its species' tasks of other types), matched to each of the
// user's growing plants (garden_plants). No routine watering tasks: water
// need is shown on the plant's care label instead.

import { supabase } from './supabase'
import { LABELS, displayName } from './catalogue'

// ─── Loading ──────────────────────────────────────────────────────────────────
// Returns { plants, tasksByProfile, zones }:
//   plants: growing garden_plants rows, each with .profile and .zone
//   tasksByProfile: { [plant profile id]: care task rows }
export async function loadGardenCare() {
  const [{ data: rows }, { data: zones }] = await Promise.all([
    supabase
      .from('garden_plants')
      .select('id, plant_id, zone_id, nickname, started_as, in_pot, created_at')
      .eq('status', 'growing')
      .order('created_at', { ascending: true }),
    supabase.from('zones').select('id, name').order('created_at', { ascending: true }),
  ])
  const plantRows = rows || []
  const ids = [...new Set(plantRows.map(r => r.plant_id))]
  if (ids.length === 0) return { plants: [], tasksByProfile: {}, zones: zones || [] }

  const [{ data: profiles }, { data: tasks }] = await Promise.all([
    supabase.from('plant_profiles_resolved')
      .select('id, genus, species, cultivar, common_names').in('id', ids),
    supabase.from('plant_care_tasks_resolved')
      .select('id, for_plant_id, task_type, months, repeat, task_trigger, applies_to, instructions')
      .in('for_plant_id', ids),
  ])
  const profileById = Object.fromEntries((profiles || []).map(p => [p.id, p]))
  const zoneById = Object.fromEntries((zones || []).map(z => [z.id, z]))
  const tasksByProfile = {}
  for (const t of tasks || []) (tasksByProfile[t.for_plant_id] ??= []).push(t)

  return {
    plants: plantRows.map(r => ({
      ...r,
      profile: profileById[r.plant_id] || null,
      zone: zoneById[r.zone_id] || null,
    })),
    tasksByProfile,
    zones: zones || [],
  }
}

// ─── Does a catalogue task apply to this plant? ──────────────────────────────
// applies_to holds how the plant was started (seed / bulb / bought) and where
// it grows (pot / ground). A task with none of one kind isn't limited by it.
// If the user hasn't said how they started it or whether it's in a pot, we
// show the task rather than hide something that may matter.
const ORIGIN = { seed: 'grown_from_seed', bulb: 'grown_from_bulb', bought_as_plant: 'bought_as_plant' }
const ORIGINS = Object.values(ORIGIN)
const PLACES = ['in_pot', 'in_ground']

export function taskAppliesTo(task, plant) {
  const applies = task.applies_to || []
  const origins = applies.filter(a => ORIGINS.includes(a))
  const places = applies.filter(a => PLACES.includes(a))
  const originOk = origins.length === 0 || !plant.started_as || origins.includes(ORIGIN[plant.started_as])
  const placeOk = places.length === 0 || plant.in_pot == null ||
                  places.includes(plant.in_pot ? 'in_pot' : 'in_ground')
  return originOk && placeOk
}

// ─── Categories ───────────────────────────────────────────────────────────────
export const CATEGORIES = {
  sow_indoors: 'Planting & sowing', sow_outdoors: 'Planting & sowing',
  plant_out: 'Planting & sowing', plant: 'Planting & sowing',
  prune: 'Pruning & cutting back', cut_back: 'Pruning & cutting back', pinch_out: 'Pruning & cutting back',
  deadhead: 'Deadheading',
  feed: 'Feeding & mulching', mulch: 'Feeding & mulching',
  support: 'Supporting',
  take_cuttings: 'Propagating',
  repot: 'Pots & containers',
  divide: 'Lifting & dividing', lift_and_store: 'Lifting & dividing',
  protect_for_winter: 'Winter care', bring_indoors: 'Winter care',
  harvest: 'Harvesting',
}
export const categoryFor = (taskType) => CATEGORIES[taskType] || 'Other'

// ─── Tasks for a month ────────────────────────────────────────────────────────
// month: 0–11.  Returns one item per plant and task due that month:
//   { id, garden_plant_id, care_task_id, month, plant_name, location,
//     task_type, action, category, detail, repeat, task_trigger, urgency }
// urgency (current month only): 'urgent' when a once-a-year job's window
// ends this month, otherwise 'soon'. Ongoing jobs are reminders only.
export function getTasksForMonth(month, garden, isCurrentMonth) {
  const calMonth = month + 1
  const items = []

  for (const plant of garden.plants || []) {
    for (const task of garden.tasksByProfile?.[plant.plant_id] || []) {
      if (!task.months.includes(calMonth) || !taskAppliesTo(task, plant)) continue
      const lastMonth = lastMonthOfWindow(task.months, calMonth)
      items.push({
        id:              `${plant.id}:${task.id}`,
        garden_plant_id: plant.id,
        care_task_id:    task.id,
        month:           calMonth,
        plant_name:      plant.nickname || displayName(plant.profile) || 'Your plant',
        location:        plant.zone?.name || null,
        task_type:       task.task_type,
        action:          LABELS.task_type[task.task_type] || task.task_type,
        category:        categoryFor(task.task_type),
        detail:          task.instructions,
        repeat:          task.repeat,
        task_trigger:    task.task_trigger,
        urgency:         !isCurrentMonth ? 'upcoming'
                         : task.repeat === 'once' && lastMonth === calMonth ? 'urgent' : 'soon',
      })
    }
  }

  const order = { urgent: 0, soon: 1, upcoming: 2 }
  return items.sort((a, b) =>
    order[a.urgency] - order[b.urgency] ||
    (a.repeat === 'once' ? 0 : 1) - (b.repeat === 'once' ? 0 : 1) ||
    a.plant_name.localeCompare(b.plant_name))
}

// The last month of the run of consecutive months containing `month`
// (wrapping from December into January), e.g. [3,4,5] with 4 → 5.
function lastMonthOfWindow(months, month) {
  const set = new Set(months)
  let m = month
  for (let i = 0; i < 11; i++) {
    const next = m === 12 ? 1 : m + 1
    if (!set.has(next)) break
    m = next
  }
  return m
}

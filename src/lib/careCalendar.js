// Shared care calendar logic used by Home and Calendar screens

export function parseMonthRefs(text) {
  if (!text) return []
  const lower = text.toLowerCase()
  const found = new Set()
  const named = [
    ['jan', 1], ['feb', 2], ['mar', 3], ['apr', 4], ['may', 5], ['jun', 6],
    ['jul', 7], ['aug', 8], ['sep', 9], ['oct', 10], ['nov', 11], ['dec', 12],
  ]
  for (const [name, num] of named) {
    if (lower.includes(name)) found.add(num)
  }
  if (lower.includes('spring'))  [3, 4, 5].forEach(m => found.add(m))
  if (lower.includes('summer'))  [6, 7, 8].forEach(m => found.add(m))
  if (lower.includes('autumn'))  [9, 10, 11].forEach(m => found.add(m))
  if (lower.includes('winter'))  [12, 1, 2].forEach(m => found.add(m))
  return [...found]
}

export function deriveCareCalendar(plant) {
  const entries = []
  if (plant.pruning_when) {
    const months = parseMonthRefs(plant.pruning_when)
    const detail = [plant.pruning_how, plant.pruning_when].filter(Boolean).join(' — ')
    months.forEach(m => entries.push({ month: m, task: 'Prune', detail }))
  }
  if (plant.watering && !plant.watering.toLowerCase().includes('drought tolerant')) {
    ;[5, 6, 7, 8].forEach(m =>
      entries.push({ month: m, task: 'Water', detail: plant.watering })
    )
  }
  if (plant.winter_care) {
    ;[10, 11].forEach(m =>
      entries.push({ month: m, task: 'Winter prep', detail: plant.winter_care })
    )
  }
  if (plant.flowering_season) {
    const months = parseMonthRefs(plant.flowering_season)
    months.forEach(m =>
      entries.push({ month: m, task: 'Deadhead', detail: `Remove spent blooms to prolong flowering. ${plant.flowering_season}.` })
    )
  }
  return entries
}

export function getTasksForMonth(month, userPlants, isCurrentMonth) {
  const tasks       = []
  const now         = new Date()
  const weekOfMonth = Math.ceil(now.getDate() / 7)
  const calMonth    = month + 1  // 1-indexed

  userPlants.forEach(row => {
    const plant = row.plants
    if (!plant) return

    // Use AI care_calendar if it has entries for this month; otherwise fall back
    // to derivation from text fields (watering, pruning_when, etc.)
    const careCalForMonth = (plant.care_calendar?.length)
      ? plant.care_calendar.filter(e => Number(e.month) === calMonth)
      : []

    const monthEntries = careCalForMonth.length > 0
      ? careCalForMonth
      : deriveCareCalendar(plant).filter(e => e.month === calMonth)
    if (monthEntries.length === 0) return

    monthEntries.forEach((entry, idx) => {
      let urgency = 'upcoming'
      if (isCurrentMonth) {
        urgency = (idx === 0 && weekOfMonth <= 2) ? 'urgent' : 'soon'
      }
      tasks.push({
        id:            `${row.id}-${calMonth}-${idx}`,
        user_plant_id: row.id,
        month:         calMonth,
        plant_name:    plant.common_name,
        photo_url:     plant.photo_url || null,
        location:      row.location || null,
        action:        entry.task,
        detail:        entry.detail,
        urgency,
      })
    })
  })

  const order = { urgent: 0, soon: 1, upcoming: 2 }
  return tasks.sort((a, b) => order[a.urgency] - order[b.urgency])
}

export function normaliseCategory(action = '') {
  const a = action.toLowerCase()
  if (/prun/i.test(a))                    return 'Pruning'
  if (/water/i.test(a))                   return 'Watering'
  if (/deadhead|dead head/i.test(a))      return 'Deadheading'
  if (/feed|fertili/i.test(a))            return 'Feeding'
  if (/mulch/i.test(a))                   return 'Mulching'
  if (/winter|protect/i.test(a))          return 'Winter care'
  if (/plant|sow/i.test(a))              return 'Planting'
  if (/lift|divid/i.test(a))             return 'Lifting & dividing'
  if (/plan/i.test(a))                   return 'Planning'
  return action || 'Other'
}

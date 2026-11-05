// Supabase Edge Function — send-monthly-reminders
// Scheduled to run on the 1st of each month via the Supabase Dashboard cron.
// For each user with a push subscription, finds this month's care tasks for
// their growing plants (garden_plants + the catalogue's care tasks) and sends
// a single bundled push notification. Uses the same task-matching rule as
// src/lib/careCalendar.js.

import webpush from 'npm:web-push'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL       = Deno.env.get('VAPID_EMAIL')!

const API_HEADERS = {
  'apikey':        SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  'Content-Type':  'application/json',
}

async function fetchJson(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: API_HEADERS })
  if (!res.ok) throw new Error(`${path.split('?')[0]}: ${res.status} ${await res.text()}`)
  return res.json()
}

type GardenPlant = { id: string; plant_id: string; nickname: string | null; started_as: string | null; in_pot: boolean | null }
type CareTask = { for_plant_id: string; task_type: string; months: number[]; applies_to: string[] }
type Profile = { id: string; genus: string; species: string | null; cultivar: string | null; common_names: string[] | null }

const TASK_LABEL: Record<string, string> = {
  sow_indoors: 'Sow indoors', sow_outdoors: 'Sow outdoors', plant_out: 'Plant out', plant: 'Plant',
  feed: 'Feed', prune: 'Prune', deadhead: 'Deadhead', divide: 'Divide',
  lift_and_store: 'Lift and store', protect_for_winter: 'Protect for winter', harvest: 'Harvest',
}

// Same rule as taskAppliesTo in src/lib/careCalendar.js
const ORIGIN: Record<string, string> = { seed: 'grown_from_seed', bulb: 'grown_from_bulb', bought_as_plant: 'bought_as_plant' }
function taskApplies(task: CareTask, plant: GardenPlant) {
  const applies = task.applies_to || []
  const origins = applies.filter(a => Object.values(ORIGIN).includes(a))
  const places = applies.filter(a => a === 'in_pot' || a === 'in_ground')
  const originOk = origins.length === 0 || !plant.started_as || origins.includes(ORIGIN[plant.started_as])
  const placeOk = places.length === 0 || plant.in_pot == null || places.includes(plant.in_pot ? 'in_pot' : 'in_ground')
  return originOk && placeOk
}

function plantName(plant: GardenPlant, profile?: Profile) {
  if (plant.nickname) return plant.nickname
  if (profile?.common_names?.length) return profile.common_names[0]
  return [profile?.genus, profile?.species].filter(Boolean).join(' ') || 'Your plant'
}

// This month's tasks for one user, e.g. [{ plant: 'English lavender', task: 'Prune' }]
async function tasksForUser(userId: string, calMonth: number) {
  const plants: GardenPlant[] = await fetchJson(
    `garden_plants?select=id,plant_id,nickname,started_as,in_pot&user_id=eq.${userId}&status=eq.growing`)
  if (plants.length === 0) return []
  const ids = [...new Set(plants.map(p => p.plant_id))].join(',')
  const [careTasks, profiles]: [CareTask[], Profile[]] = await Promise.all([
    fetchJson(`plant_care_tasks_resolved?select=for_plant_id,task_type,months,applies_to&for_plant_id=in.(${ids})`),
    fetchJson(`plant_profiles_resolved?select=id,genus,species,cultivar,common_names&id=in.(${ids})`),
  ])
  const profileById = Object.fromEntries(profiles.map(p => [p.id, p]))
  const tasks: Array<{ plant: string; task: string }> = []
  for (const plant of plants) {
    for (const t of careTasks) {
      if (t.for_plant_id !== plant.plant_id || !t.months.includes(calMonth) || !taskApplies(t, plant)) continue
      tasks.push({ plant: plantName(plant, profileById[plant.plant_id]), task: TASK_LABEL[t.task_type] ?? t.task_type })
    }
  }
  return tasks
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Only the scheduled job may run this: it must send the CRON_SECRET
  // function secret in an x-cron-secret header. With no secret set, every
  // call is refused, so nobody can trigger notifications to all users.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response(JSON.stringify({ error: 'Not allowed' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const now        = new Date()
    const calMonth   = now.getMonth() + 1   // 1-indexed, as in plant_care_tasks.months
    const monthName  = now.toLocaleString('en-GB', { month: 'long' })

    // All push subscriptions
    const subscriptions: Array<{ user_id: string; endpoint: string; subscription: webpush.PushSubscription }> =
      await fetchJson('push_subscriptions?select=user_id,endpoint,subscription')

    let sent = 0, failed = 0, skipped = 0

    for (const sub of subscriptions) {
      const tasks = await tasksForUser(sub.user_id, calMonth)

      if (tasks.length === 0) { skipped++; continue }

      // Build notification body — up to 3 tasks shown, then a count
      const preview = tasks.slice(0, 3).map(t => `${t.plant}: ${t.task}`).join('\n')
      const body    = tasks.length > 3
        ? `${preview}\n+ ${tasks.length - 3} more tasks this month`
        : preview

      try {
        await webpush.sendNotification(
          sub.subscription as webpush.PushSubscription,
          JSON.stringify({
            title: `Your ${monthName} garden tasks`,
            body,
            data: { url: '/calendar' },
          })
        )
        sent++
      } catch (err: any) {
        console.error(`Push failed for user ${sub.user_id}:`, err.message)
        // Remove stale subscriptions (endpoint gone — HTTP 410)
        if (err.statusCode === 410) {
          await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
            { method: 'DELETE', headers: API_HEADERS }
          )
        }
        failed++
      }
    }

    return new Response(
      JSON.stringify({ month: monthName, sent, failed, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Supabase Edge Function — send-monthly-reminders
// Scheduled to run on the 1st of each month via the Supabase Dashboard cron.
// For each user with a push subscription, queries their plants' care_calendar
// for the current month and sends a single bundled push notification.

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
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const now        = new Date()
    const calMonth   = now.getMonth() + 1   // 1-indexed to match care_calendar
    const monthName  = now.toLocaleString('en-GB', { month: 'long' })

    // All push subscriptions
    const subscriptions: Array<{ user_id: string; endpoint: string; subscription: PushSubscriptionJSON }> =
      await fetchJson('push_subscriptions?select=user_id,endpoint,subscription')

    let sent = 0, failed = 0, skipped = 0

    for (const sub of subscriptions) {
      // Plants with care_calendar for this user
      const userPlants: Array<{ plants: { common_name: string; care_calendar: Array<{ month: number; task: string; detail: string }> } }> =
        await fetchJson(
          `user_plants?select=plants(common_name,care_calendar)&user_id=eq.${sub.user_id}`
        )

      // Collect tasks for this month
      const tasks: Array<{ plant: string; task: string }> = []
      for (const row of userPlants) {
        const plant = row.plants
        if (!plant?.care_calendar) continue
        for (const entry of plant.care_calendar) {
          if (entry.month === calMonth) {
            tasks.push({ plant: plant.common_name, task: entry.task })
          }
        }
      }

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

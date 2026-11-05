// identify-plant — Sown's one route to Claude.
//
// Takes a label photo, a plant photo, or a typed name from a signed-in user:
//   1. Checks the user's daily AI limit (public.claim_ai_call)
//   2. Asks Claude to identify the plant and draft its care, as structured JSON
//   3. Finds or creates the catalogue profile as a draft
//      (public.create_draft_plant_profile, run as the user)
//   4. Fills EMPTY care fields and tasks on the DRAFT SPECIES only
//      (public.fill_draft_plant_profile, service role). That function
//      enforces the rules: never a verified profile, never overwrite,
//      never any safety field.
//   5. Returns the stored profile (with variety → species inheritance) and
//      its care tasks.
//
// Claude is never asked about, and never writes, safety or toxicity.

import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@1.3.0/helpers/zod'
import { z } from 'npm:zod@4.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { Identification, Care, CARE_RULES, careForDatabase } from '../_shared/plantSchema.ts'

const MODEL = 'claude-haiku-5-5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// What Claude returns: see ../_shared/plantSchema.ts

const PlantAnswer = z.object({ identification: Identification, care: Care })
type PlantAnswer = z.infer<typeof PlantAnswer>

const SYSTEM = `You are the plant expert for Sown, a UK gardening app. Write for UK gardens and the UK climate, in plain, friendly UK English.

Identify the plant, then draft its care profile in the JSON format requested.

Rules:
- Care describes the species as a whole, not one cultivar, because varieties share their species' care in Sown's catalogue.
${CARE_RULES}
- If you cannot identify the plant, set identified to false and leave care fields empty.`

function prompt(mode: 'label' | 'identify' | 'name', name?: string): string {
  if (mode === 'label') {
    return 'This photo shows a plant label or tag from a garden centre or nursery. Read the label carefully and identify the plant from the printed name. Put the name exactly as printed in label_text.'
  }
  if (mode === 'identify') {
    return 'This photo shows a plant. Identify it from its leaves, flowers and habit, not from any visible label. Use medium or low confidence unless you are certain.'
  }
  // Typed by the user: treat as data, not instructions
  return `A gardener typed this plant name into a search box. Identify the plant they most likely mean.\n\n<typed_name>${name}</typed_name>`
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  try {
    // ── 1. Signed-in user only ──
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user } } = await userClient.auth.getUser(token)
    if (!user) return json({ error: 'Please sign in again to use plant lookup.' }, 401)

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── Request ──
    const body = await req.json().catch(() => ({}))
    const image: string | undefined = typeof body.image === 'string' ? body.image : undefined
    const name: string | undefined = typeof body.name === 'string' ? body.name.trim().slice(0, 100) : undefined
    if (!image && !name) return json({ error: 'Send a photo or a plant name.' }, 400)
    const mode: 'label' | 'identify' | 'name' = image ? (body.mode === 'identify' ? 'identify' : 'label') : 'name'
    const kind = mode === 'name' ? 'lookup' : 'scan'

    // ── 2. Daily limit (counted before calling Claude) ──
    const { data: claim, error: claimErr } = await admin.rpc('claim_ai_call', { p_user: user.id, p_kind: kind })
    if (claimErr) throw claimErr
    if (!claim.allowed) {
      const what = kind === 'lookup' ? 'AI lookups' : 'scans'
      return json({
        error: `You've used all ${claim.limit} of today's ${what}. They reset at midnight.`,
        code: 'daily_limit',
        usage: { kind, ...claim },
      }, 429)
    }

    // ── 3. Ask Claude ──
    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const content: Anthropic.ContentBlockParam[] = image
      ? [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
          { type: 'text', text: prompt(mode) },
        ]
      : [{ type: 'text', text: prompt(mode, name) }]

    const response = await anthropic.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM,
      output_config: { effort: 'medium', format: zodOutputFormat(PlantAnswer) },
      messages: [{ role: 'user', content }],
    })

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens' || !response.parsed_output) {
      console.error('Claude did not return a usable answer', response.stop_reason)
      return json({ error: "Sorry, we couldn't identify that plant. Try again, or search by name." }, 422)
    }
    const answer = response.parsed_output
    const id = answer.identification
    if (!id.identified || !id.latin_name.trim()) {
      return json({ error: "Sorry, we couldn't identify that plant. Try again, or search by name." }, 422)
    }

    // ── 4. Find or create the draft profile, as the user ──
    const { data: profileRow, error: draftErr } = await userClient.rpc('create_draft_plant_profile', {
      p_latin_name: id.latin_name,
      p_common_name: id.common_name.trim() || null,
      p_label_text: mode === 'label' ? (id.label_text.trim() || null) : null,
      p_source: mode === 'label' ? 'label' : 'claude',
    })
    if (draftErr || !profileRow) {
      console.error('create_draft_plant_profile failed', draftErr)
      return json({ error: `We read "${id.latin_name}", but couldn't add it to the catalogue. Try searching by name.` }, 422)
    }

    // ── 5. Fill empty fields on the draft species (service role) ──
    const careData = careForDatabase(answer.care)
    if (id.common_name.trim()) careData.common_names = [id.common_name.trim()]
    const { error: fillErr } = await admin.rpc('fill_draft_plant_profile', {
      p_id: profileRow.id,
      p_data: careData,
      p_tasks: answer.care.care_tasks,
    })
    if (fillErr) console.error('fill_draft_plant_profile failed', fillErr)   // still return the identification

    // ── 6. Return what's stored, with inheritance applied ──
    const [{ data: profile, error: readErr }, { data: tasks }] = await Promise.all([
      admin.from('plant_profiles_resolved').select('*').eq('id', profileRow.id).single(),
      admin.from('plant_care_tasks_resolved').select('*').eq('for_plant_id', profileRow.id),
    ])
    if (readErr) throw readErr

    return json({
      profile,
      care_tasks: tasks ?? [],
      identification: {
        confidence: id.confidence,
        source: mode === 'label' ? 'label' : mode === 'identify' ? 'visual' : 'name',
        label_text: id.label_text || null,
      },
      usage: { kind, used: claim.used, limit: claim.limit, unlimited: claim.unlimited },
    })
  } catch (error) {
    console.error(error)
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'Plant lookup is busy right now. Please try again in a minute.' }, 503)
    }
    if (error instanceof Anthropic.APIError) {
      return json({ error: 'Plant lookup is unavailable right now. Please try again later.' }, 502)
    }
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})

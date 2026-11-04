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

const MODEL = 'claude-haiku-5-5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── What Claude returns ─────────────────────────────────────────────────────
// No optional or nullable fields: unknown values are "", 0, "unknown" or [],
// which the database ignores. The database also re-checks every value.

const Identification = z.object({
  identified: z.boolean().describe('false if this is not a plant, or the name cannot be read or identified'),
  latin_name: z.string().describe("Botanical name: Genus species 'Cultivar' with the cultivar in single quotes, e.g. Lavandula angustifolia 'Hidcote'. Genus and cultivar only if there is no species, e.g. Rosa 'Peace'. Empty string if unknown."),
  common_name: z.string().describe('Common UK name, e.g. English lavender. Empty string if none.'),
  label_text: z.string().describe('Label photos only: the plant name exactly as printed on the label. Otherwise empty string.'),
  confidence: z.enum(['high', 'medium', 'low']),
})

const CareTask = z.object({
  task_type: z.enum(['sow_indoors', 'sow_outdoors', 'plant_out', 'plant', 'feed', 'prune',
    'deadhead', 'divide', 'lift_and_store', 'protect_for_winter', 'harvest']),
  months: z.array(z.number().int()).describe('Standard UK months, 1 = January ... 12 = December'),
  repeat: z.enum(['once', 'ongoing']).describe('once: a single job done once a year. ongoing: repeats through its months, e.g. deadheading or regular feeding'),
  task_trigger: z.enum(['none', 'after_last_frost']),
  applies_to: z.array(z.enum(['grown_from_seed', 'grown_from_bulb', 'bought_as_plant', 'in_pot', 'in_ground']))
    .describe('Which plants this applies to. Empty list means all.'),
  instructions: z.string().describe("One or two short, friendly sentences in plain UK English"),
})

const Care = z.object({
  family: z.string().describe('Botanical family, e.g. Lamiaceae. Empty string if unknown.'),
  plant_type: z.enum(['annual', 'biennial', 'perennial', 'shrub', 'tree', 'bulb', 'climber',
    'grass', 'fern', 'herb', 'vegetable', 'fruit', 'unknown']),
  rhs_hardiness: z.enum(['H1a', 'H1b', 'H1c', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'unknown']),
  sun: z.array(z.enum(['full_sun', 'partial_shade', 'full_shade'])),
  aspect: z.array(z.enum(['N', 'E', 'S', 'W'])).describe('Garden aspects it suits'),
  exposure: z.array(z.enum(['sheltered', 'exposed'])),
  soil_type: z.array(z.enum(['clay', 'loam', 'sand', 'chalk'])),
  soil_moisture: z.enum(['well_drained', 'moist_but_well_drained', 'poorly_drained', 'unknown']),
  soil_ph: z.array(z.enum(['acid', 'neutral', 'alkaline'])),
  height_cm_min: z.number().int().describe('0 if unknown'),
  height_cm_max: z.number().int().describe('0 if unknown'),
  spread_cm_min: z.number().int().describe('0 if unknown'),
  spread_cm_max: z.number().int().describe('0 if unknown'),
  years_to_full_size_min: z.number().int().describe('0 if unknown'),
  years_to_full_size_max: z.number().int().describe('0 if unknown'),
  suits_containers: z.enum(['yes', 'no', 'unknown']),
  difficulty: z.enum(['beginner', 'some_experience', 'expert', 'unknown']),
  water_need: z.enum(['low', 'medium', 'high', 'unknown']).describe('Once established, in a typical UK garden'),
  water_notes: z.string().describe('One short sentence, e.g. "Water well in its first summer, then only in long dry spells."'),
  flowering_months: z.array(z.number().int()).describe('UK months, 1-12. Empty if it is not grown for flowers.'),
  summary: z.string().describe('One or two sentences for the top of the plant page'),
  care_planting: z.string().describe('Short paragraph: planting'),
  care_ongoing: z.string().describe('Short paragraph: ongoing care'),
  care_through_year: z.string().describe('Short paragraph: through the year'),
  common_problems: z.array(z.object({ problem: z.string(), what_to_do: z.string() })).describe('Up to 5 pests or diseases'),
  beginner_tips: z.array(z.string()).describe('Up to 4 short tips'),
  good_for_pollinators: z.enum(['yes', 'no', 'unknown']),
  care_tasks: z.array(CareTask).describe('Real jobs only: no routine watering. Up to 8.'),
})

const PlantAnswer = z.object({ identification: Identification, care: Care })
type PlantAnswer = z.infer<typeof PlantAnswer>

const SYSTEM = `You are the plant expert for Sown, a UK gardening app. Write for UK gardens and the UK climate, in plain, friendly UK English.

Identify the plant, then draft its care profile in the JSON format requested.

Rules:
- Care describes the species as a whole, not one cultivar, because varieties share their species' care in Sown's catalogue.
- Use RHS hardiness ratings (H1a to H7) and standard UK months. Never use US zones.
- Care tasks are real jobs (sow, plant, prune, feed, deadhead, divide, lift, protect, harvest). Never include routine watering as a task; describe watering in water_need and water_notes instead.
- Do not mention toxicity, poisoning, or whether the plant is safe for people or pets anywhere. Sown takes safety information only from the HTA list, checked by a person.
- If you are not sure of a value, use the "unknown" value, 0, an empty string or an empty list. Do not guess.
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

// Turn Claude's "unknown" markers into what fill_draft_plant_profile expects
function careForDatabase(care: PlantAnswer['care']) {
  const { care_tasks: _tasks, suits_containers, good_for_pollinators, ...rest } = care
  return {
    ...rest,
    common_names: [] as string[],   // set from identification below
    suits_containers: suits_containers === 'yes' ? true : suits_containers === 'no' ? false : null,
    // 'unknown' is a real stored value; leave the field empty so a later scan can fill it
    good_for_pollinators: good_for_pollinators === 'unknown' ? null : good_for_pollinators,
  }
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

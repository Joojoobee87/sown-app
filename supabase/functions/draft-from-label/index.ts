// draft-from-label — admin "Add from a label".
//
// The admin screen uploads photos to _incoming/ folders first:
//   label photos → catalogue-label-photos (private, admin only)
//   plant photos → catalogue-photos (Jo's own images)
// then calls this function, which:
//   1. Checks the caller is an admin
//   2. Sends the photos to Claude (Opus 5.5), which returns:
//        identification, facts printed on the label, and its own care draft
//   3. Finds or creates the profile as a draft (create_draft_plant_profile)
//   4. Applies label facts (apply_label_facts): a cultivar's own facts on the
//      variety, general facts on the draft species; replaces Claude guesses,
//      never Jo's values; marked 'label'
//   5. Fills remaining empty care fields and tasks on the draft species
//      (fill_draft_plant_profile; marked 'claude')
//   6. Files the photos under the profile's slug, named like the iCloud
//      archive: label_NN_front / label_NN_back / plant_NN
//
// Never copies label wording into public text, never stores label images
// anywhere public, never sets safety.

import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@1.3.0/helpers/beta/zod'
import { z } from 'npm:zod@4.6.7'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import {
  Identification, Care, LabelFacts, CARE_RULES, careForDatabase, labelFactsForDatabase,
} from '../_shared/plantSchema.ts'

const MODEL = 'claude-opus-5-5'
const LABEL_BUCKET = 'catalogue-label-photos'
const PHOTO_BUCKET = 'catalogue-photos'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Two calls, each with a small enough output format for structured output
// (one combined format compiles to a grammar over the API's size limit):
//   1. read the label (photos): identification + facts printed on it
//   2. draft care (text only): Claude's own care for the species, skipped
//      when the species already has care or is verified
const LabelRead = z.object({
  identification: Identification,
  label_facts: LabelFacts.describe('ONLY facts printed on the label itself. Anything the label does not state: unknown, 0 or empty.'),
})
const CareDraft = z.object({ care: Care })

const READ_SYSTEM = `You read nursery plant labels for Sown, a UK gardening app, to help its editor build a verified plant catalogue.

From the photos:
1. identification: the plant named on the label. Use the label's printed name; put it exactly as printed in label_text.
2. label_facts: only the facts the label itself states (height, spread, sun, hardiness, flowering time, flower colour and so on), converted to the requested codes. If the label doesn't state something, leave it unknown, 0 or empty, even if you know the answer.

Use RHS hardiness ratings (H1a to H7) and UK months. If you cannot read a plant name, set identified to false.`

const CARE_SYSTEM = `You are the plant expert for Sown, a UK gardening app. Write for UK gardens and the UK climate, in plain, friendly UK English.

Draft the care profile for the plant named, in the JSON format requested, from your own knowledge and in your own words.

Rules:
- Care describes the species as a whole, not one cultivar, because varieties share their species' care in Sown's catalogue.
${CARE_RULES}`

type Photo = { path: string, side?: 'front' | 'back' }

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
type ImageType = typeof IMAGE_TYPES[number]

async function download(admin: SupabaseClient, bucket: string, path: string) {
  const { data, error } = await admin.storage.from(bucket).download(path)
  if (error || !data) throw new Error(`Could not read ${path}`)
  const type = (IMAGE_TYPES as readonly string[]).includes(data.type) ? data.type as ImageType : 'image/jpeg'
  return { data: toBase64(await data.arrayBuffer()), type }
}

const incoming = (p: unknown): p is string =>
  typeof p === 'string' && p.startsWith('_incoming/') && !p.includes('..') && p.length < 200

const pad = (n: number) => String(n).padStart(2, '0')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let labelPhotos: Photo[] = [], plantPhotos: string[] = []
  const cleanUp = async () => {
    await admin.storage.from(LABEL_BUCKET).remove(labelPhotos.map(p => p.path)).catch(() => {})
    if (plantPhotos.length) await admin.storage.from(PHOTO_BUCKET).remove(plantPhotos).catch(() => {})
  }

  try {
    // ── 1. Admins only ──
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user } } = await userClient.auth.getUser(token)
    if (!user) return json({ error: 'Please sign in again.' }, 401)
    if (user.app_metadata?.role !== 'admin') return json({ error: 'Admins only.' }, 403)

    const body = await req.json().catch(() => ({}))
    labelPhotos = (Array.isArray(body.label_photos) ? body.label_photos : [])
      .filter((p: Photo) => incoming(p?.path) && (p.side === 'front' || p.side === 'back')).slice(0, 2)
    plantPhotos = (Array.isArray(body.plant_photos) ? body.plant_photos : []).filter(incoming).slice(0, 4)
    if (!labelPhotos.some(p => p.side === 'front')) return json({ error: 'Add a photo of the front of the label.' }, 400)

    // ── 2. Ask Claude ──
    const labels = await Promise.all(labelPhotos.map(p => download(admin, LABEL_BUCKET, p.path)))
    const plants = await Promise.all(plantPhotos.slice(0, 2).map(p => download(admin, PHOTO_BUCKET, p)))
    const content: Anthropic.Beta.BetaContentBlockParam[] = []
    labelPhotos.forEach((p, i) => {
      content.push({ type: 'text', text: `Label, ${p.side}:` })
      content.push({ type: 'image', source: { type: 'base64', media_type: labels[i].type, data: labels[i].data } })
    })
    plants.forEach((img, i) => {
      content.push({ type: 'text', text: `Photo of the plant itself (${i + 1}):` })
      content.push({ type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } })
    })
    content.push({ type: 'text', text: 'Identify the plant on this label and return the facts printed on it.' })

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
    const response = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',            // if Opus declines, Anthropic's recommended model retries
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: betaZodOutputFormat(LabelRead) },
      system: READ_SYSTEM,
      messages: [{ role: 'user', content }],
    })

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens' || !response.parsed_output) {
      console.error('Claude did not return a usable answer', response.stop_reason)
      await cleanUp()
      return json({ error: "Claude couldn't read this label. Try a sharper photo of the front." }, 422)
    }
    const answer = response.parsed_output
    const id = answer.identification
    if (!id.identified || !id.latin_name.trim()) {
      await cleanUp()
      return json({ error: "Claude couldn't read a plant name on this label. Try a sharper photo of the front." }, 422)
    }

    // ── 3. Find or create the draft, as the admin ──
    const { data: profile, error: draftErr } = await userClient.rpc('create_draft_plant_profile', {
      p_latin_name: id.latin_name,
      p_common_name: id.common_name.trim() || null,
      p_label_text: id.label_text.trim() || null,
      p_source: 'label',
    })
    if (draftErr || !profile) {
      console.error('create_draft_plant_profile failed', draftErr)
      await cleanUp()
      return json({ error: `Claude read "${id.latin_name}", but it couldn't be added to the catalogue.` }, 422)
    }

    // ── 4. Label facts ──
    const { data: labelResult, error: labelErr } = await admin.rpc('apply_label_facts', {
      p_id: profile.id, p_data: labelFactsForDatabase(answer.label_facts),
    })
    if (labelErr) throw labelErr

    // ── 5. Claude's care for what's still empty, if the species needs it ──
    const speciesId = profile.parent_id ?? profile.id
    const [{ data: species }, { count: taskCount }] = await Promise.all([
      admin.from('plant_profiles').select('status, genus, species, summary, care_ongoing').eq('id', speciesId).single(),
      admin.from('plant_care_tasks').select('id', { count: 'exact', head: true }).eq('plant_id', speciesId),
    ])
    let fillResult: unknown = { filled: [], tasks_added: 0, skipped: 'species already has care' }
    const needsCare = species && species.status === 'draft' && (!species.summary || !species.care_ongoing || !taskCount)
    if (needsCare) {
      const speciesName = [species.genus, species.species].filter(Boolean).join(' ')
      const careResponse = await anthropic.beta.messages.parse({
        model: MODEL,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: betaZodOutputFormat(CareDraft) },
        system: CARE_SYSTEM,
        messages: [{ role: 'user', content: `Draft the care profile for ${speciesName}${id.common_name ? ` (${id.common_name})` : ''}.` }],
      })
      if (careResponse.stop_reason !== 'refusal' && careResponse.stop_reason !== 'max_tokens' && careResponse.parsed_output) {
        const care = careResponse.parsed_output.care
        const careData = careForDatabase(care)
        if (id.common_name.trim()) careData.common_names = [id.common_name.trim()]
        const { data, error: fillErr } = await admin.rpc('fill_draft_plant_profile', {
          p_id: profile.id, p_data: careData, p_tasks: care.care_tasks,
        })
        if (fillErr) throw fillErr
        fillResult = data
      } else {
        console.error('Care draft not usable', careResponse.stop_reason)
        fillResult = { filled: [], tasks_added: 0, skipped: 'Claude could not draft care this time' }
      }
    }

    // ── 6. File the photos under the profile's slug ──
    const slug = profile.slug as string
    const { count: labelSets } = await admin.from('plant_label_photos')
      .select('id', { count: 'exact', head: true })
      .eq('plant_id', profile.id).like('storage_path', '%_front.%')
    const set = pad((labelSets ?? 0) + 1)
    const stamp = Date.now().toString(36)
    const filedLabels: string[] = []
    for (const p of labelPhotos) {
      let to = `${slug}/label_${set}_${p.side}.jpg`
      let { error } = await admin.storage.from(LABEL_BUCKET).move(p.path, to)
      if (error) {   // name taken: keep both
        to = `${slug}/label_${set}_${p.side}_${stamp}.jpg`
        ;({ error } = await admin.storage.from(LABEL_BUCKET).move(p.path, to))
      }
      if (error) throw error
      filedLabels.push(to)
    }
    if (filedLabels.length) {
      const { error } = await admin.from('plant_label_photos').insert(filedLabels.map(storage_path => ({
        plant_id: profile.id, storage_path, taken_on: new Date().toISOString().slice(0, 10),
      })))
      if (error) throw error
    }

    const existing: string[] = profile.photo_paths ?? []
    const filedPhotos: string[] = []
    for (const [i, p] of plantPhotos.entries()) {
      let to = `${slug}/plant_${pad(existing.length + i + 1)}.jpg`
      let { error } = await admin.storage.from(PHOTO_BUCKET).move(p, to)
      if (error) {
        to = `${slug}/plant_${pad(existing.length + i + 1)}_${stamp}.jpg`
        ;({ error } = await admin.storage.from(PHOTO_BUCKET).move(p, to))
      }
      if (error) throw error
      filedPhotos.push(to)
    }
    if (filedPhotos.length) {
      const { data: cur } = await admin.from('plant_profiles').select('photo_paths, field_sources').eq('id', profile.id).single()
      const { error } = await admin.from('plant_profiles').update({
        photo_paths: [...(cur?.photo_paths ?? []), ...filedPhotos],
        field_sources: { ...(cur?.field_sources ?? {}), photo_paths: 'jo' },
      }).eq('id', profile.id)
      if (error) throw error
    }

    return json({
      profile_id: profile.id,
      slug,
      status: profile.status,
      read_as: id.label_text || id.latin_name,
      label: labelResult,
      filled: fillResult,
      label_photos: filedLabels,
      plant_photos: filedPhotos,
    })
  } catch (error) {
    console.error(error)
    await cleanUp()
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'Claude is busy. Try again in a minute.' }, 503)
    // Admins only, so show Claude's own message to help diagnose problems
    if (error instanceof Anthropic.APIError) return json({ error: `Claude error (${error.status}): ${error.message}` }, 502)
    return json({ error: 'Something went wrong. Please try again.' }, 500)
  }
})

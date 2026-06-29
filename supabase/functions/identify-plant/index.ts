import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLANT_JSON_SCHEMA = `Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "common_name": "string — common name in English",
  "latin_name": "string — full scientific name",
  "confidence": "high|medium|low",
  "source": "label|visual|name",
  "sun_requirements": "Full sun|Partial shade|Full shade|Full sun to partial shade",
  "soil_type": "string e.g. Well drained, Moist well drained, Clay, Sandy",
  "aspect": "string e.g. S, SW, N, E, Any",
  "height": "string e.g. 60–90cm",
  "spread": "string e.g. 45–60cm",
  "flowering_season": "string e.g. June–September",
  "growth_rate": "Slow|Moderate|Fast",
  "frost_hardiness": "string e.g. Fully hardy, Hardy to -10°C, Tender",
  "watering": "string — how much and how often e.g. Water regularly in summer, drought tolerant once established",
  "pruning_when": "string — best month(s) to prune e.g. March, after flowering in August",
  "pruning_how": "string — how much to cut back e.g. Cut back hard to 10cm, Remove dead heads only, Do not prune",
  "winter_care": "string — frost protection and winter tasks e.g. Mulch base in November, lift tubers before first frost",
  "care_notes": "string — 1–2 sentence summary of key care tips",
  "wildlife_value": "string or null — e.g. Attracts bees and butterflies",
  "toxic": "string or null — e.g. Toxic to dogs and cats, if not toxic use null",
  "suitable_for_uk": true,
  "notes_for_buyer": "string or null — 1–2 sentences on what to look for when buying, best time to buy, common pitfalls",
  "care_calendar": [
    { "month": 1, "task": "string — short action verb e.g. Plan, Prune, Feed, Water, Mulch, Plant, Deadhead, Lift, Divide", "detail": "string — one sentence of practical instruction" }
  ]
}

For care_calendar: include one entry per distinct task per month (1=Jan … 12=Dec). Only include months where a specific action is needed — omit months with nothing to do. A plant may have 2–3 entries in a month if multiple tasks are due. Keep tasks concise and UK-specific.`


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { image, name, mode } = body  // mode: 'label' | 'identify'

    if (!image && !name) {
      return new Response(JSON.stringify({ error: 'Provide either image (base64) or name (string)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    })

    let message

    if (image) {
      const isLabelMode = mode !== 'identify'  // default to label mode if not specified

      const imagePrompt = isLabelMode
        ? `You are a plant expert assistant for a UK gardening app called Sown.

This image shows a plant label or tag — typically from a garden centre or nursery.
Read the text on the label carefully to identify the plant name.
Use the label text as your primary source. Set "source" to "label".
All advice should be appropriate for UK gardens and climate.

${PLANT_JSON_SCHEMA}`
        : `You are a plant expert assistant for a UK gardening app called Sown.

This image shows a plant that the user wants to identify visually.
Identify the plant from its physical characteristics — leaf shape, colour, flower form, growth habit.
Do not rely on any visible labels. Set "source" to "visual".
All advice should be appropriate for UK gardens and climate.

${PLANT_JSON_SCHEMA}`

      // ── Vision path: identify plant from photo or label ───────────────────
      message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: image },
            },
            { type: 'text', text: imagePrompt },
          ],
        }],
      })
    } else {
      // ── Name lookup path: research a plant by name ────────────────────────
      message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `You are a plant expert assistant for a UK gardening app called Sown.

The user is researching whether "${name}" would work in their UK garden. They may have seen it online or in a magazine and want to know if it suits their conditions before buying.

Provide accurate, practical horticultural information appropriate for UK gardens and climate.
Set "source" to "name" and "confidence" to "high" if this is a well-known plant, "medium" if it is less common.
For "notes_for_buyer", include the best time of year to buy, what to look for in a healthy specimen, and any common pitfalls (e.g. often confused with a similar-looking tender variety).

${PLANT_JSON_SCHEMA}`,
        }],
      })
    }

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    let plantData
    try {
      plantData = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        plantData = JSON.parse(match[0])
      } else {
        throw new Error('Could not parse plant data from response')
      }
    }

    return new Response(JSON.stringify(plantData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

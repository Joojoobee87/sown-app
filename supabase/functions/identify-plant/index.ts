import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image } = await req.json()
    if (!image) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY'),
    })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: image,
              },
            },
            {
              type: 'text',
              text: `You are a plant expert assistant for a UK gardening app called Sown.

Analyse this image. It may show:
- A plant label/tag from a garden centre (read the text on the label)
- A plant itself (identify it visually)
- Both a plant and its label

Extract the plant name from any visible label first, or identify the plant visually if no label is present.

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "common_name": "string — common name in English",
  "latin_name": "string — full scientific name",
  "confidence": "high|medium|low",
  "source": "label|visual",
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
  "toxic": "string or null — e.g. Toxic to dogs and cats if null not toxic"
}`,
            },
          ],
        },
      ],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''

    let plantData
    try {
      plantData = JSON.parse(text)
    } catch {
      // Try to extract JSON if Claude added any surrounding text
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

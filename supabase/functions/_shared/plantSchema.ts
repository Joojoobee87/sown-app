// Shared by identify-plant (user scans) and draft-from-label (admin).
//
// What Claude returns, as zod schemas for structured output. No optional or
// nullable fields: unknown values are "", 0, "unknown" or [], which the
// database ignores. The database re-checks every value as well.

import { z } from 'npm:zod@4.6.7'

export const Identification = z.object({
  identified: z.boolean().describe('false if this is not a plant, or the name cannot be read or identified'),
  latin_name: z.string().describe("Botanical name: Genus species 'Cultivar' with the cultivar in single quotes, e.g. Lavandula angustifolia 'Hidcote'. Genus and cultivar only if there is no species, e.g. Rosa 'Peace'. Empty string if unknown."),
  common_name: z.string().describe('Common UK name, e.g. English lavender. Empty string if none.'),
  label_text: z.string().describe('Label photos only: the plant name exactly as printed on the label. Otherwise empty string.'),
  confidence: z.enum(['high', 'medium', 'low']),
})

export const CareTask = z.object({
  task_type: z.enum(['sow_indoors', 'sow_outdoors', 'plant_out', 'plant', 'feed', 'mulch', 'prune',
    'cut_back', 'pinch_out', 'deadhead', 'support', 'take_cuttings', 'repot', 'divide', 'lift_and_store',
    'protect_for_winter', 'bring_indoors', 'harvest'])
    .describe('cut_back: herbaceous plants and grasses down to the ground; prune: woody plants. support: stake or tie in. repot: pot on or top-dress containers. bring_indoors: move tender plants under cover'),
  months: z.array(z.number().int()).describe('Standard UK months, 1 = January ... 12 = December'),
  repeat: z.enum(['once', 'ongoing']).describe('once: a single job done once a year. ongoing: repeats through its months, e.g. deadheading or regular feeding'),
  task_trigger: z.enum(['none', 'after_last_frost']),
  applies_to: z.array(z.enum(['grown_from_seed', 'grown_from_bulb', 'bought_as_plant', 'in_pot', 'in_ground']))
    .describe('Which plants this applies to. Empty list means all.'),
  instructions: z.string().describe("One or two short, friendly sentences in plain UK English"),
})

const PLANT_TYPE = z.enum(['annual', 'biennial', 'perennial', 'shrub', 'tree', 'bulb', 'climber',
  'grass', 'fern', 'herb', 'vegetable', 'fruit', 'unknown'])
const HARDINESS = z.enum(['H1a', 'H1b', 'H1c', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'unknown'])
const SUN = z.array(z.enum(['full_sun', 'partial_shade', 'full_shade']))
const ASPECT = z.array(z.enum(['N', 'E', 'S', 'W']))
const EXPOSURE = z.array(z.enum(['sheltered', 'exposed']))
const SOIL = z.array(z.enum(['clay', 'loam', 'sand', 'chalk']))
const MOISTURE = z.enum(['well_drained', 'moist_but_well_drained', 'poorly_drained', 'unknown'])
const PH = z.array(z.enum(['acid', 'neutral', 'alkaline']))
const YES_NO = z.enum(['yes', 'no', 'unknown'])
const WATER = z.enum(['low', 'medium', 'high', 'unknown'])
const MONTHS = z.array(z.number().int())

// Claude's own care draft for the species
export const Care = z.object({
  family: z.string().describe('Botanical family, e.g. Lamiaceae. Empty string if unknown.'),
  plant_type: PLANT_TYPE,
  rhs_hardiness: HARDINESS,
  sun: SUN,
  aspect: ASPECT.describe('Garden aspects it suits'),
  exposure: EXPOSURE,
  soil_type: SOIL,
  soil_moisture: MOISTURE,
  soil_ph: PH,
  height_cm_min: z.number().int().describe('0 if unknown'),
  height_cm_max: z.number().int().describe('0 if unknown'),
  spread_cm_min: z.number().int().describe('0 if unknown'),
  spread_cm_max: z.number().int().describe('0 if unknown'),
  years_to_full_size_min: z.number().int().describe('0 if unknown'),
  years_to_full_size_max: z.number().int().describe('0 if unknown'),
  suits_containers: YES_NO,
  difficulty: z.enum(['beginner', 'some_experience', 'expert', 'unknown']),
  water_need: WATER.describe('Once established, in a typical UK garden'),
  water_notes: z.string().describe('One short sentence, e.g. "Water well in its first summer, then only in long dry spells."'),
  flowering_months: MONTHS.describe('UK months, 1-12. Empty if it is not grown for flowers.'),
  summary: z.string().describe('One or two sentences for the top of the plant page'),
  care_planting: z.string().describe('Short paragraph: planting'),
  care_ongoing: z.string().describe('Short paragraph: ongoing care'),
  care_through_year: z.string().describe('Short paragraph: through the year'),
  common_problems: z.array(z.object({ problem: z.string(), what_to_do: z.string() })).describe('Up to 5 pests or diseases'),
  beginner_tips: z.array(z.string()).describe('Up to 4 short tips'),
  good_for_pollinators: YES_NO,
  care_tasks: z.array(CareTask).describe('Real jobs only: no routine watering. Up to 8.'),
})
export type CareDraft = z.infer<typeof Care>

// Facts printed on a label (admin "Add from a label"). Only what the label
// itself states; everything else unknown.
export const LabelFacts = z.object({
  plant_type: PLANT_TYPE,
  rhs_hardiness: HARDINESS.describe('Only if the label prints an RHS rating, or a hardiness you can convert reliably'),
  sun: SUN,
  aspect: ASPECT,
  exposure: EXPOSURE,
  soil_type: SOIL,
  soil_moisture: MOISTURE,
  soil_ph: PH,
  height_cm_min: z.number().int().describe('Height printed on the label, in cm. 0 if not printed'),
  height_cm_max: z.number().int().describe('0 if not printed'),
  spread_cm_min: z.number().int().describe('0 if not printed'),
  spread_cm_max: z.number().int().describe('0 if not printed'),
  suits_containers: YES_NO,
  water_need: WATER,
  flowering_months: MONTHS.describe('Flowering months printed on the label, 1-12'),
  flower_colours: z.array(z.string()).describe('Flower colour(s) as printed or shown on the label, short, e.g. "deep purple"'),
})
export type LabelFactsDraft = z.infer<typeof LabelFacts>

// Rules every prompt shares
export const CARE_RULES = `- Use RHS hardiness ratings (H1a to H7) and standard UK months. Never use US zones.
- Care tasks are real jobs (sow, plant, feed, mulch, prune, cut back, pinch out, deadhead, support, take cuttings, repot, divide, lift, protect, bring indoors, harvest). Never include routine watering as a task; describe watering in water_need and water_notes instead.
- Do not mention toxicity, poisoning, or whether the plant is safe for people or pets anywhere. Sown takes safety information only from the HTA list, checked by a person.
- If you are not sure of a value, use the "unknown" value, 0, an empty string or an empty list. Do not guess.`

// Claude's "unknown" markers → what fill_draft_plant_profile expects
export function careForDatabase(care: CareDraft) {
  const { care_tasks: _tasks, suits_containers, good_for_pollinators, ...rest } = care
  return {
    ...rest,
    common_names: [] as string[],   // set from the identification by the caller
    suits_containers: suits_containers === 'yes' ? true : suits_containers === 'no' ? false : null,
    // 'unknown' is a real stored value; leave the field empty so a later scan can fill it
    good_for_pollinators: good_for_pollinators === 'unknown' ? null : good_for_pollinators,
  }
}

// Label facts → what apply_label_facts expects
export function labelFactsForDatabase(facts: LabelFactsDraft) {
  return {
    ...facts,
    suits_containers: facts.suits_containers === 'yes' ? true : facts.suits_containers === 'no' ? false : null,
  }
}

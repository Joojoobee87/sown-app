-- ════════════════════════════════════════════════════════════════════════════
-- Add from a label (needs the catalogue, scan and HTA migrations first)
--
--   1. flower_colours on plant_profiles (a variety fact), shown through the
--      plant_profiles_resolved view
--   2. apply_label_facts(): puts facts read from a label photo on the right
--      record, for the draft-from-label edge function (service role only):
--        • a cultivar's own facts (height, spread, flowering months, flower
--          colours) go on the VARIETY, and are skipped if they match the
--          species anyway
--        • general facts (sun, aspect, soil, hardiness, exposure, water need,
--          containers, plant type) go on the SPECIES
--        • only draft records are changed
--        • a label fact replaces an empty field or one Claude guessed; never
--          one Jo set, or one already read from a label
--        • every field written is marked 'label' in field_sources
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Flower colours ──────────────────────────────────────────────────────
alter table public.plant_profiles
  add column flower_colours text[];   -- e.g. {lavender-blue}, as the label or grower describes

create or replace view public.plant_profiles_resolved
with (security_invoker = true) as
select
  p.id,
  p.parent_id,
  p.slug,
  coalesce(p.genus, s.genus)                                  as genus,
  coalesce(p.species, s.species)                              as species,
  p.cultivar,
  coalesce(nullif(p.common_names, '{}'), s.common_names)      as common_names,
  coalesce(nullif(p.synonyms, '{}'), s.synonyms)              as synonyms,
  coalesce(nullif(p.label_aliases, '{}'), s.label_aliases)    as label_aliases,
  coalesce(p.family, s.family)                                as family,
  coalesce(p.plant_type, s.plant_type)                        as plant_type,
  coalesce(nullif(p.photo_paths, '{}'), s.photo_paths)        as photo_paths,

  coalesce(p.rhs_hardiness, s.rhs_hardiness)                  as rhs_hardiness,
  coalesce(nullif(p.sun, '{}'), s.sun)                        as sun,
  coalesce(nullif(p.aspect, '{}'), s.aspect)                  as aspect,
  coalesce(nullif(p.exposure, '{}'), s.exposure)              as exposure,
  coalesce(nullif(p.soil_type, '{}'), s.soil_type)            as soil_type,
  coalesce(p.soil_moisture, s.soil_moisture)                  as soil_moisture,
  coalesce(nullif(p.soil_ph, '{}'), s.soil_ph)                as soil_ph,
  case when p.height_cm_min is not null or p.height_cm_max is not null
       then p.height_cm_min else s.height_cm_min end          as height_cm_min,
  case when p.height_cm_min is not null or p.height_cm_max is not null
       then p.height_cm_max else s.height_cm_max end          as height_cm_max,
  case when p.spread_cm_min is not null or p.spread_cm_max is not null
       then p.spread_cm_min else s.spread_cm_min end          as spread_cm_min,
  case when p.spread_cm_min is not null or p.spread_cm_max is not null
       then p.spread_cm_max else s.spread_cm_max end          as spread_cm_max,
  case when p.years_to_full_size_min is not null or p.years_to_full_size_max is not null
       then p.years_to_full_size_min else s.years_to_full_size_min end as years_to_full_size_min,
  case when p.years_to_full_size_min is not null or p.years_to_full_size_max is not null
       then p.years_to_full_size_max else s.years_to_full_size_max end as years_to_full_size_max,
  coalesce(p.suits_containers, s.suits_containers)            as suits_containers,
  coalesce(p.difficulty, s.difficulty)                        as difficulty,
  coalesce(p.water_need, s.water_need)                        as water_need,
  coalesce(p.water_notes, s.water_notes)                      as water_notes,
  coalesce(p.flowering_months, s.flowering_months)            as flowering_months,

  -- Safety: the variety's own block if it has a status, otherwise the species'.
  -- If the species can't be read either, this falls back to 'unknown'.
  coalesce(p.safety_status, s.safety_status, 'unknown')       as safety_status,
  case when p.safety_status is not null then p.harmful_to         else s.harmful_to         end as harmful_to,
  case when p.safety_status is not null then p.harmful_parts      else s.harmful_parts      end as harmful_parts,
  case when p.safety_status is not null then p.harmful_if_eaten   else s.harmful_if_eaten   end as harmful_if_eaten,
  case when p.safety_status is not null then p.skin_irritant      else s.skin_irritant      end as skin_irritant,
  case when p.safety_status is not null then p.hta_edition        else s.hta_edition        end as hta_edition,
  case when p.safety_status is not null then p.pets_affected      else s.pets_affected      end as pets_affected,
  case when p.safety_status is not null then p.hta_condition      else s.hta_condition      end as hta_condition,
  case when p.safety_status is not null then p.safety_verified_at else s.safety_verified_at end as safety_verified_at,

  coalesce(p.summary, s.summary)                              as summary,
  coalesce(p.care_planting, s.care_planting)                  as care_planting,
  coalesce(p.care_ongoing, s.care_ongoing)                    as care_ongoing,
  coalesce(p.care_through_year, s.care_through_year)          as care_through_year,
  coalesce(p.common_problems, s.common_problems)              as common_problems,
  coalesce(nullif(p.beginner_tips, '{}'), s.beginner_tips)    as beginner_tips,
  coalesce(p.good_for_pollinators, s.good_for_pollinators)    as good_for_pollinators,

  p.in_sown_kit,
  p.kit_ids,
  coalesce(p.kit_guide, s.kit_guide)                          as kit_guide,

  p.status,
  s.status                                                    as species_status,
  coalesce(s.field_sources, '{}') || p.field_sources          as field_sources,
  p.verified_at,
  p.last_reviewed,
  -- added 5 Nov 2026 (must stay last: columns can only be appended)
  coalesce(nullif(p.flower_colours, '{}'), s.flower_colours) as flower_colours
from public.plant_profiles p
left join public.plant_profiles s on s.id = p.parent_id;

-- ─── 2. Apply label facts ───────────────────────────────────────────────────

-- Writes the allowed facts (p_facts, already validated JSON) to one record.
-- p_keys: which fact keys may go on this record.
-- p_species: the species row (as JSON) when writing to a variety, so facts
--            that match the species are skipped. Null for a species.
-- Returns the keys written.
create function sown_private.apply_facts_to_profile(p_row uuid, p_facts jsonb, p_keys text[], p_species jsonb)
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  r       public.plant_profiles;
  cur     jsonb;
  src     jsonb;
  changes jsonb := '{}';
  k       text;
  pair    text[];
  nr      public.plant_profiles;
begin
  select * into r from public.plant_profiles where id = p_row for update;
  if not found or r.status <> 'draft' then
    return '{}';
  end if;
  cur := to_jsonb(r);
  src := coalesce(r.field_sources, '{}');

  foreach k in array p_keys loop
    continue when not (p_facts ? k) or jsonb_typeof(p_facts -> k) = 'null';
    -- only replace an empty field or one Claude guessed
    continue when not (jsonb_typeof(cur -> k) = 'null' or src ->> k = 'claude');
    -- on a variety, skip facts that match the species anyway
    continue when p_species is not null and (p_species -> k) = (p_facts -> k);
    changes := changes || jsonb_build_object(k, p_facts -> k);
  end loop;

  -- Ranges are written as pairs or not at all (min/max must stay in order)
  foreach k in array array['height_cm', 'spread_cm'] loop
    pair := array[k || '_min', k || '_max'];
    if (changes ? pair[1]) <> (changes ? pair[2]) then
      changes := changes - pair[1] - pair[2];
    end if;
  end loop;

  if changes = '{}' then
    return '{}';
  end if;

  nr := jsonb_populate_record(r, changes);
  update public.plant_profiles set
    plant_type = nr.plant_type, rhs_hardiness = nr.rhs_hardiness,
    sun = nr.sun, aspect = nr.aspect, exposure = nr.exposure,
    soil_type = nr.soil_type, soil_moisture = nr.soil_moisture, soil_ph = nr.soil_ph,
    height_cm_min = nr.height_cm_min, height_cm_max = nr.height_cm_max,
    spread_cm_min = nr.spread_cm_min, spread_cm_max = nr.spread_cm_max,
    suits_containers = nr.suits_containers, water_need = nr.water_need,
    flowering_months = nr.flowering_months, flower_colours = nr.flower_colours,
    field_sources = src || (select jsonb_object_agg(key, 'label') from jsonb_object_keys(changes) key)
  where id = p_row;

  return array(select jsonb_object_keys(changes) order by 1);
end;
$$;

-- p_id: the profile the label names (a variety if it names a cultivar).
-- p_data: facts read from the label, in the catalogue's codes. Anything
-- unknown or not in the allowed lists is ignored.
-- Returns {"variety_fields": [...], "species_fields": [...]}.
create function public.apply_label_facts(p_id uuid, p_data jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  p          public.plant_profiles;
  species    public.plant_profiles;
  facts      jsonb;
  h_lo int; h_hi int; s_lo int; s_hi int;
  own_keys   constant text[] := array['height_cm_min','height_cm_max','spread_cm_min','spread_cm_max',
                                      'flowering_months','flower_colours'];
  general    constant text[] := array['plant_type','rhs_hardiness','sun','aspect','exposure','soil_type',
                                      'soil_moisture','soil_ph','suits_containers','water_need'];
  v_fields   text[] := '{}';
  s_fields   text[] := '{}';
begin
  select * into p from public.plant_profiles where id = p_id;
  if not found then
    raise exception 'No plant profile with id %', p_id;
  end if;
  if p.parent_id is not null then
    select * into species from public.plant_profiles where id = p.parent_id;
  end if;

  p_data := coalesce(p_data, '{}'::jsonb);
  h_lo := sown_private.pick_int(p_data, 'height_cm_min', 1, 5000);
  h_hi := sown_private.pick_int(p_data, 'height_cm_max', 1, 5000);
  s_lo := sown_private.pick_int(p_data, 'spread_cm_min', 1, 5000);
  s_hi := sown_private.pick_int(p_data, 'spread_cm_max', 1, 5000);

  facts := jsonb_strip_nulls(jsonb_build_object(
    'plant_type',       sown_private.pick_text(p_data, 'plant_type', enum_range(null::public.plant_type)::text[]),
    'rhs_hardiness',    sown_private.pick_text(p_data, 'rhs_hardiness', enum_range(null::public.rhs_hardiness)::text[]),
    'sun',              sown_private.pick_text_array(p_data, 'sun', enum_range(null::public.sun_level)::text[]),
    'aspect',           sown_private.pick_text_array(p_data, 'aspect', array['N','E','S','W']),
    'exposure',         sown_private.pick_text_array(p_data, 'exposure', enum_range(null::public.exposure)::text[]),
    'soil_type',        sown_private.pick_text_array(p_data, 'soil_type', enum_range(null::public.soil_type)::text[]),
    'soil_moisture',    sown_private.pick_text(p_data, 'soil_moisture', enum_range(null::public.soil_moisture)::text[]),
    'soil_ph',          sown_private.pick_text_array(p_data, 'soil_ph', enum_range(null::public.soil_ph)::text[]),
    'height_cm_min',    least(coalesce(h_lo, h_hi), coalesce(h_hi, h_lo)),
    'height_cm_max',    greatest(coalesce(h_lo, h_hi), coalesce(h_hi, h_lo)),
    'spread_cm_min',    least(coalesce(s_lo, s_hi), coalesce(s_hi, s_lo)),
    'spread_cm_max',    greatest(coalesce(s_lo, s_hi), coalesce(s_hi, s_lo)),
    'suits_containers', sown_private.pick_bool(p_data, 'suits_containers'),
    'water_need',       sown_private.pick_text(p_data, 'water_need', enum_range(null::public.water_need)::text[]),
    'flowering_months', sown_private.pick_months(p_data, 'flowering_months'),
    'flower_colours',   sown_private.pick_text_array(p_data, 'flower_colours', null, 6, 40)
  ));

  if p.parent_id is not null then
    v_fields := sown_private.apply_facts_to_profile(p.id, facts, own_keys, to_jsonb(species));
    s_fields := sown_private.apply_facts_to_profile(species.id, facts, general, null);
  else
    s_fields := sown_private.apply_facts_to_profile(p.id, facts, own_keys || general, null);
  end if;

  return jsonb_build_object('variety_fields', to_jsonb(v_fields), 'species_fields', to_jsonb(s_fields));
end;
$$;

revoke execute on function public.apply_label_facts(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_label_facts(uuid, jsonb) to service_role;

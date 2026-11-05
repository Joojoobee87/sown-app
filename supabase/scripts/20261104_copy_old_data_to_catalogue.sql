-- ════════════════════════════════════════════════════════════════════════════
-- OPTIONAL: copy test data from the old tables into the new catalogue tables
--
-- HISTORY: run on 4 Nov 2026. The old tables were retired on 5 Nov 2026
-- (migrations/20261105_retire_old_tables.sql; copies kept in the archive
-- schema), so this script no longer runs as written. Kept for reference.
--
-- Run by hand in the Supabase SQL editor, AFTER
-- supabase/migrations/20261104_plant_catalogue.sql has been applied.
-- It is not a migration and is not run automatically.
--
-- Old tables are only read, never changed. Safe to run more than once:
-- rows that already exist are skipped.
--
--   plants                → plant_profiles (+ plant_care_tasks from care_calendar)
--   garden_zones          → zones                (same ids)
--   user_plants           → garden_plants        (same ids) + garden_plant_notes
--   user_task_completions → garden_task_completions (best match only)
--
-- Every copied profile is status 'draft' with safety_status 'unknown'.
-- Not copied: plants.toxic (safety comes from the HTA list only),
-- photo_url / illustration_url (profile photos must be Jo's own),
-- frost_hardiness, growth_rate, wildlife_value, notes_for_buyer and the
-- free-text height / spread. flowering_season is turned into
-- flowering_months where it names months or seasons.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Maps the old free-text task names to the new task types.
-- Anything unrecognised (e.g. "Mulch", "Water") returns null and is skipped.
create or replace function pg_temp.map_task_type(t text)
returns task_type
language sql
immutable
as $$
  select case
    when t ~* 'sow.*(indoor|under cover|inside)' then 'sow_indoors'
    when t ~* '\msow'                            then 'sow_outdoors'
    when t ~* 'plant(ing)? out|harden'           then 'plant_out'
    when t ~* '\mplant'                          then 'plant'
    when t ~* 'feed|fertili[sz]'                 then 'feed'
    when t ~* 'dead.?head'                       then 'deadhead'
    when t ~* 'prun|cut back|trim'               then 'prune'
    when t ~* 'divid'                            then 'divide'
    when t ~* '\mlift'                           then 'lift_and_store'
    when t ~* 'protect|fleece|frost|overwinter'  then 'protect_for_winter'
    when t ~* 'harvest|\mpick'                   then 'harvest'
  end::task_type
$$;

-- Turns free text like "June to August", "Late spring" or "Jul, Sep" into
-- month numbers. Seasons: spring 3–5, summer 6–8, autumn 9–11, winter 12–2.
-- Returns null if nothing is recognised.
create or replace function pg_temp.parse_months(t text)
returns int[]
language plpgsql
immutable
as $$
declare
  names  text[] := array['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  -- Whole month words only, full or short ("sep" but not "separate")
  mon    text   := '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  s      text   := lower(coalesce(t, ''));
  result int[]  := '{}';
  r      text[];
  a      int;
  b      int;
begin
  -- Ranges: "june to august", "jun-aug", "may until july"
  for r in select regexp_matches(s,
      '\m(' || mon || ')\M\.?\s*(?:to|-|–|until|through|till)\s*(' || mon || ')\M', 'g')
  loop
    a := array_position(names, left(r[1], 3));
    b := array_position(names, left(r[2], 3));
    for i in 0 .. ((b - a + 12) % 12) loop
      result := result || ((a - 1 + i) % 12 + 1);
    end loop;
  end loop;
  -- Single months
  for r in select regexp_matches(s, '\m(' || mon || ')\M', 'g') loop
    result := result || array_position(names, left(r[1], 3));
  end loop;
  -- Seasons
  if s ~ 'spring'          then result := result || array[3,4,5];   end if;
  if s ~ 'summer'          then result := result || array[6,7,8];   end if;
  if s ~ 'autumn|\mfall\M' then result := result || array[9,10,11]; end if;
  if s ~ 'winter'          then result := result || array[12,1,2];  end if;

  select array_agg(distinct m order by m) into result from unnest(result) m;
  return nullif(result, '{}');
end;
$$;

-- Old plant id → new profile id
create temp table plant_map (old_id uuid primary key, profile_id uuid not null) on commit drop;

do $$
declare
  r          record;
  n          record;
  sp_slug    text;
  target     text;
  species_id uuid;
  target_id  uuid;
  skipped    int := 0;
begin
  for r in select * from public.plants order by created_at loop
    select * into n from public.parse_botanical_name(r.latin_name);
    if n.genus is null or n.genus !~ '^[A-Z][a-z-]+$' then
      skipped := skipped + 1;
      raise notice 'Skipped plant % (%): no usable botanical name', r.id, r.common_name;
      continue;
    end if;

    -- Species record (bare if it only exists as the parent of a variety)
    sp_slug := public.make_plant_slug(n.genus, n.species, null);
    insert into public.plant_profiles (slug, genus, species, status, safety_status)
    values (sp_slug, n.genus, n.species, 'draft', 'unknown')
    on conflict (slug) do nothing;
    select id into species_id from public.plant_profiles where slug = sp_slug;

    if n.cultivar is not null then
      target := public.make_plant_slug(n.genus, n.species, n.cultivar);
      insert into public.plant_profiles (parent_id, slug, cultivar, status)
      values (species_id, target, n.cultivar, 'draft')
      on conflict (slug) do nothing;
    else
      target := sp_slug;
    end if;
    select id into target_id from public.plant_profiles where slug = target;

    -- Fill in what the old row knew, without overwriting anything already set.
    -- Only draft rows are touched, so nothing Jo has verified changes.
    update public.plant_profiles p set
      common_names = coalesce(p.common_names,
                       case when r.common_name is not null then array[r.common_name] end),
      sun = coalesce(p.sun, nullif(array_remove(array[
              case when r.sun_requirements ~* 'full sun'                      then 'full_sun' end,
              case when r.sun_requirements ~* '(part|partial|semi|dappled).?shade' then 'partial_shade' end,
              case when r.sun_requirements ~* '(full|deep) shade'             then 'full_shade' end
            ]::sun_level[], null), '{}')),
      aspect = coalesce(p.aspect, nullif(array_remove(array[
              case when r.aspect ~* '\mnorth|\mN\M' then 'N' end,
              case when r.aspect ~* '\meast|\mE\M'  then 'E' end,
              case when r.aspect ~* '\msouth|\mS\M' then 'S' end,
              case when r.aspect ~* '\mwest|\mW\M'  then 'W' end
            ]::compass_point[], null), '{}')),
      soil_type = coalesce(p.soil_type, nullif(array_remove(array[
              case when r.soil_type ~* 'clay'  then 'clay' end,
              case when r.soil_type ~* 'loam'  then 'loam' end,
              case when r.soil_type ~* 'sand'  then 'sand' end,
              case when r.soil_type ~* 'chalk' then 'chalk' end
            ]::soil_type[], null), '{}')),
      height_cm_min = coalesce(p.height_cm_min, least(r.height_cm_min, coalesce(r.height_cm_max, r.height_cm_min))),
      height_cm_max = coalesce(p.height_cm_max, greatest(r.height_cm_max, coalesce(r.height_cm_min, r.height_cm_max))),
      water_notes = coalesce(p.water_notes, r.watering),
      flowering_months = coalesce(p.flowering_months, pg_temp.parse_months(r.flowering_season)::month_list),
      care_ongoing = coalesce(p.care_ongoing, nullif(concat_ws(E'\n\n',
                       r.care_notes,
                       case when r.pruning_when is not null or r.pruning_how is not null
                            then 'Pruning: ' || concat_ws(' — ', r.pruning_when, r.pruning_how) end
                     ), '')),
      care_through_year = coalesce(p.care_through_year, r.winter_care),
      field_sources = jsonb_strip_nulls(jsonb_build_object(
                        'common_names',      case when r.common_name is not null then 'claude' end,
                        'sun',               case when r.sun_requirements is not null then 'claude' end,
                        'aspect',            case when r.aspect is not null then 'claude' end,
                        'soil_type',         case when r.soil_type is not null then 'claude' end,
                        'height_cm',         case when r.height_cm_min is not null or r.height_cm_max is not null then 'claude' end,
                        'water_notes',       case when r.watering is not null then 'claude' end,
                        'flowering_months',  case when pg_temp.parse_months(r.flowering_season) is not null then 'claude' end,
                        'care_ongoing',      case when r.care_notes is not null or r.pruning_how is not null then 'claude' end,
                        'care_through_year', case when r.winter_care is not null then 'claude' end
                      )) || p.field_sources
    where p.id = target_id and p.status = 'draft';

    insert into plant_map values (r.id, target_id) on conflict do nothing;
  end loop;

  raise notice 'Plants: % mapped to profiles, % skipped', (select count(*) from plant_map), skipped;
end $$;

-- Care tasks from the old care_calendar JSON, for profiles with no tasks yet.
-- One row per profile and task type, with all its months combined.
-- Deadheading, feeding and harvesting become 'ongoing' (reminder only);
-- everything else is 'once' a year. Jo can change this when reviewing.
insert into public.plant_care_tasks (plant_id, task_type, repeat, months, instructions)
select m.profile_id,
       pg_temp.map_task_type(e ->> 'task')                         as task_type,
       case when pg_temp.map_task_type(e ->> 'task') in ('deadhead', 'feed', 'harvest')
            then 'ongoing' else 'once' end::task_repeat,
       array_agg(distinct (e ->> 'month')::int order by (e ->> 'month')::int),
       left(string_agg(distinct coalesce(nullif(btrim(e ->> 'detail'), ''), e ->> 'task'), ' '), 500)
from public.plants p
join plant_map m on m.old_id = p.id
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.care_calendar) = 'array' then p.care_calendar else '[]'::jsonb end
) e
where pg_temp.map_task_type(e ->> 'task') is not null
  and (e ->> 'month') ~ '^([1-9]|1[0-2])$'
  and not exists (select 1 from public.plant_care_tasks t where t.plant_id = m.profile_id)
group by m.profile_id, pg_temp.map_task_type(e ->> 'task');


-- Zones: same ids. Values the new lists don't have are kept in the notes.
insert into public.zones (
  id, user_id, name, sun, aspect, soil_type, soil_drainage, shelter, frost_pocket, notes
)
select z.id, z.user_id, btrim(z.name),
  case lower(btrim(z.sun_exposure))
    when 'full sun' then 'full_sun' when 'partial shade' then 'partial_shade'
    when 'full shade' then 'full_shade' end::sun_level,
  case when upper(btrim(z.aspect)) in ('N','NE','E','SE','S','SW','W','NW')
       then upper(btrim(z.aspect)) end::compass_point,
  case lower(btrim(z.soil_type))
    when 'clay' then 'clay' when 'loam' then 'loam' when 'sandy' then 'sand'
    when 'sand' then 'sand' when 'chalk' then 'chalk' end::soil_type,
  case lower(btrim(z.soil_drainage))
    when 'well drained' then 'well_drained'
    when 'moist but well drained' then 'moist_but_well_drained'
    when 'poorly drained' then 'poorly_drained' end::soil_moisture,
  case lower(btrim(z.shelter))
    when 'sheltered' then 'sheltered' when 'exposed' then 'exposed'
    when 'coastal' then 'exposed' end::exposure,
  coalesce(z.frost_pocket, false),
  nullif(concat_ws(E'\n',
    z.notes,
    case when lower(btrim(z.soil_type)) in ('peat', 'silty') then 'Soil: ' || z.soil_type end,
    case when lower(btrim(z.shelter)) = 'coastal' then 'Coastal' end
  ), '')
from public.garden_zones z
where z.user_id is not null and nullif(btrim(z.name), '') is not null
on conflict do nothing;


-- Garden plants: same ids. The zone is matched by name; an unmatched
-- location is kept as a note. Planting details are unknown, so growing
-- plants will show as needing details.
insert into public.garden_plants (id, user_id, plant_id, zone_id, status, created_at)
select u.id, u.user_id, m.profile_id,
  (select z.id from public.zones z
   where z.user_id = u.user_id and z.name = btrim(u.location)),
  case u.status
    when 'lost' then 'gone'
    when 'want to grow' then 'want_to_grow'
    else 'growing'                       -- growing, dormant
  end::garden_plant_status,
  coalesce(u.created_at, now())
from public.user_plants u
join plant_map m on m.old_id = u.plant_id
on conflict do nothing;

insert into public.garden_plant_notes (garden_plant_id, user_id, noted_on, body)
select g.id, g.user_id, coalesce(u.date_added, u.created_at::date, current_date), x.body
from public.user_plants u
join public.garden_plants g on g.id = u.id
cross join lateral (values
  (nullif(btrim(u.personal_notes), '')),
  (case when g.zone_id is null and nullif(btrim(u.location), '') is not null
        then 'Location: ' || btrim(u.location) end),
  (case when u.status = 'dormant' then 'Marked as dormant in the old app' end)
) as x(body)
where x.body is not null
  and not exists (
    select 1 from public.garden_plant_notes n
    where n.garden_plant_id = g.id and n.body = x.body
  );


-- Task completions: matched to a 'once' care task of the same type that
-- falls in that month. Completions with no matching task are skipped, and
-- only the first completion per task and year is kept.
insert into public.garden_task_completions (
  garden_plant_id, user_id, care_task_id, year, month, completed_at
)
select g.id, g.user_id, t.id, c.year, c.month, c.completed_at
from public.user_task_completions c
join public.garden_plants g on g.id = c.user_plant_id
cross join lateral (
  select r.id from public.plant_care_tasks_resolved r
  where r.for_plant_id = g.plant_id
    and r.task_type = pg_temp.map_task_type(c.task)
    and c.month = any (r.months)
    and r.repeat = 'once'
  order by r.inherited
  limit 1
) t
where c.year between 2000 and 2100
on conflict do nothing;


do $$
begin
  raise notice 'Now in new tables: % profiles, % care tasks, % zones, % garden plants, % notes, % completions',
    (select count(*) from public.plant_profiles),
    (select count(*) from public.plant_care_tasks),
    (select count(*) from public.zones),
    (select count(*) from public.garden_plants),
    (select count(*) from public.garden_plant_notes),
    (select count(*) from public.garden_task_completions);
  raise notice 'Old rows not copied: % user_plants, % garden_zones, % task completions',
    (select count(*) from public.user_plants u where not exists (select 1 from public.garden_plants g where g.id = u.id)),
    (select count(*) from public.garden_zones z where not exists (select 1 from public.zones n where n.id = z.id)),
    (select count(*) from public.user_task_completions c
       where not exists (select 1 from public.garden_task_completions n
                         where n.garden_plant_id = c.user_plant_id and n.year = c.year and n.month = c.month));
end $$;

commit;

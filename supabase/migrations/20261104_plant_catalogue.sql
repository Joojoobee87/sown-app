-- ════════════════════════════════════════════════════════════════════════════
-- Sown plant catalogue (see docs/plant-catalogue-spec.md)
--
-- DRAFT — not yet applied. Review before running.
--
-- Creates the new catalogue and garden tables ALONGSIDE the old ones.
-- The old tables (plants, user_plants, garden_zones, user_task_completions)
-- are not touched; the app keeps using them until its screens are moved over.
-- An optional script to copy old test data across lives in
-- supabase/scripts/20261104_copy_old_data_to_catalogue.sql.
--
-- Needs Postgres 15+ (uses ON DELETE SET NULL (column)). Supabase projects
-- are on 15 or later.
--
-- Contents
--   1. Fixed value lists (enums)
--   2. Helper functions (admin check, updated_at, name parsing, slugs)
--   3. Catalogue: plant_profiles, plant_label_photos, plant_care_tasks
--   4. Garden: zones, garden_plants, garden_plant_photos, garden_plant_notes,
--      garden_task_completions
--   5. Views that apply species → variety inheritance
--   6. Row Level Security
--   7. create_draft_plant_profile() — the only way the app creates profiles
--   8. Storage buckets and policies
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. Fixed value lists ───────────────────────────────────────────────────
-- Stored as lowercase snake_case; the app maps them to display wording
-- (e.g. 'partial_shade' → "Partial shade", 'hta_a' → "HTA category A").
-- RHS hardiness and compass points keep their standard notation.

create type plant_type as enum (
  'annual', 'biennial', 'perennial', 'shrub', 'tree', 'bulb', 'climber',
  'grass', 'fern', 'herb', 'vegetable', 'fruit'
);

create type rhs_hardiness as enum (
  'H1a', 'H1b', 'H1c', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7'
);

create type sun_level as enum ('full_sun', 'partial_shade', 'full_shade');

-- Eight points so zones keep the detail the old garden_zones table had.
-- Plant profiles are limited to N/E/S/W by a check constraint.
create type compass_point as enum ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW');

create type exposure as enum ('sheltered', 'exposed');

create type soil_type as enum ('clay', 'loam', 'sand', 'chalk');

create type soil_moisture as enum (
  'well_drained', 'moist_but_well_drained', 'poorly_drained'
);

create type soil_ph as enum ('acid', 'neutral', 'alkaline');

create type difficulty as enum ('beginner', 'some_experience', 'expert');

create type water_need as enum ('low', 'medium', 'high');

create type safety_status as enum (
  'unknown',
  'hta_a',
  'hta_b',
  'hta_c',
  'hta_bulb_or_fruit_label',   -- HTA bulb or ornamental fruit label
  'not_on_hta_list'
);

create type harmful_to as enum ('people', 'pets', 'both');

-- As named in the HTA guide; other pets may still be affected.
create type pet_kind as enum (
  'dogs', 'cats', 'rabbits', 'rodents', 'tortoises', 'caged_birds', 'poultry'
);

create type yes_no_unknown as enum ('yes', 'no', 'unknown');

create type catalogue_status as enum ('draft', 'verified');

create type task_type as enum (
  'sow_indoors', 'sow_outdoors', 'plant_out', 'plant', 'feed', 'prune',
  'deadhead', 'divide', 'lift_and_store', 'protect_for_winter', 'harvest'
);

create type task_trigger as enum ('none', 'after_last_frost');

create type task_applies_to as enum (
  'grown_from_seed', 'bought_as_plant', 'in_pot', 'in_ground'
);

create type zone_type as enum (
  'border', 'bed', 'pots', 'greenhouse', 'indoors', 'lawn', 'other'
);

create type started_as as enum ('seed', 'bulb', 'bought_as_plant');

create type added_via as enum ('label_scan', 'search', 'photo_id', 'sown_kit');

create type garden_plant_status as enum ('growing', 'gone', 'want_to_grow');


-- ─── 2. Helper functions ────────────────────────────────────────────────────

-- True when the signed-in user is a catalogue admin.
-- Admin is set in the user's app_metadata, which only the service role or
-- the dashboard can change, e.g. in the SQL editor:
--   update auth.users
--   set raw_app_meta_data = raw_app_meta_data || '{"role":"admin"}'
--   where email = 'you@example.com';
-- The user must sign out and in again to pick up the change.
create function public.is_catalogue_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Splits a botanical name into genus, species and cultivar, e.g.
--   "Lavandula angustifolia 'Hidcote'" → (Lavandula, angustifolia, Hidcote)
--   "Rosa 'Peace'"                     → (Rosa, null, Peace)
-- Best effort only: used for drafts, which Jo checks before verifying.
create function public.parse_botanical_name(p_name text)
returns table (genus text, species text, cultivar text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  n    text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  rest text;
  g    text;
begin
  cultivar := btrim(substring(n from '[''‘’"“”]([^''‘’"“”]+)[''‘’"“”]'));
  rest     := btrim(regexp_replace(n, '[''‘’"“”][^''‘’"“”]*[''‘’"“”]', '', 'g'));
  rest     := btrim(regexp_replace(rest, '\s(cv\.?|var\.?)$', '', 'i'));
  g        := split_part(rest, ' ', 1);
  genus    := nullif(upper(left(g, 1)) || lower(substr(g, 2)), '');
  species  := nullif(lower(btrim(substr(rest, length(g) + 1))), '');
  cultivar := nullif(cultivar, '');
  return next;
end;
$$;

-- Builds a slug from the botanical name, e.g. lavandula-angustifolia-hidcote.
-- Species records pass a null cultivar.
create function public.make_plant_slug(p_genus text, p_species text, p_cultivar text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(
    regexp_replace(
      lower(translate(
        concat_ws(' ', p_genus, p_species, p_cultivar),
        'àáâäãåèéêëìíîïòóôöõøùúûüñçÀÁÂÄÃÅÈÉÊËÌÍÎÏÒÓÔÖÕØÙÚÛÜÑÇ',
        'aaaaaaeeeeiiiioooooouuuuncAAAAAAEEEEIIIIOOOOOOUUUUNC'
      )),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
$$;


-- ─── 3. Catalogue ───────────────────────────────────────────────────────────

-- One row per species (parent_id empty) or variety (parent_id → species).
-- A variety stores only what differs from its species: empty (null) fields
-- are inherited. Use plant_profiles_resolved to read the combined values.
create table public.plant_profiles (
  id                     uuid primary key default gen_random_uuid(),
  parent_id              uuid references public.plant_profiles (id) on delete restrict,

  -- Identity
  slug                   text not null unique
                         check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  genus                  text,
  species                text,
  cultivar               text,
  common_names           text[],          -- first one is shown by default
  synonyms               text[],
  label_aliases          text[],          -- names as growers print them
  family                 text,
  plant_type             plant_type,
  photo_paths            text[],          -- Jo's own images only

  -- Growing conditions
  rhs_hardiness          rhs_hardiness,
  sun                    sun_level[],
  aspect                 compass_point[]
                         check (aspect <@ array['N','E','S','W']::compass_point[]),
  exposure               exposure,
  soil_type              soil_type[],
  soil_moisture          soil_moisture,
  soil_ph                soil_ph[],
  height_cm_min          integer check (height_cm_min >= 0),
  height_cm_max          integer check (height_cm_max >= 0),
  spread_cm_min          integer check (spread_cm_min >= 0),
  spread_cm_max          integer check (spread_cm_max >= 0),
  years_to_full_size_min smallint check (years_to_full_size_min >= 0),
  years_to_full_size_max smallint check (years_to_full_size_max >= 0),
  suits_containers       boolean,
  difficulty             difficulty,
  water_need             water_need,
  water_notes            text,

  -- Safety: HTA list only, never AI. Defaults to 'unknown' on species
  -- (set by trigger); left empty on a variety, which inherits its species.
  safety_status          safety_status,
  harmful_to             harmful_to,
  harmful_parts          text,
  skin_irritant          boolean,
  hta_edition            text,
  pets_affected          pet_kind[],
  hta_condition          text,            -- e.g. "female plants only"
  safety_verified_by     uuid references auth.users (id) on delete set null,
  safety_verified_at     timestamptz,

  -- Content
  summary                text,
  care_planting          text,            -- care guide: planting
  care_ongoing           text,            -- care guide: ongoing care
  care_through_year      text,            -- care guide: through the year
  common_problems        jsonb            -- [{"problem": "...", "what_to_do": "..."}]
                         check (jsonb_typeof(common_problems) = 'array'),
  beginner_tips          text[],
  good_for_pollinators   yes_no_unknown,

  -- Sown kit (reserved, left empty for now)
  in_sown_kit            boolean not null default false,
  kit_ids                text[] not null default '{}',
  kit_guide              text,

  -- Verification
  status                 catalogue_status not null default 'draft',
  field_sources          jsonb not null default '{}'   -- {"sun": "claude", "rhs_hardiness": "label", ...}
                         check (
                           jsonb_typeof(field_sources) = 'object'
                           and not jsonb_path_exists(
                             field_sources,
                             '$.* ? (@ != "claude" && @ != "label" && @ != "api" && @ != "jo")'
                           )
                         ),
  verified_by            uuid references auth.users (id) on delete set null,
  verified_at            timestamptz,
  last_reviewed          date,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- A species has a genus and no cultivar; a variety has a cultivar.
  constraint plant_profiles_identity check (
    (parent_id is null and genus is not null and cultivar is null)
    or (parent_id is not null and cultivar is not null)
  ),
  constraint plant_profiles_not_own_parent check (parent_id <> id),
  constraint plant_profiles_height_range check (height_cm_min <= height_cm_max),
  constraint plant_profiles_spread_range check (spread_cm_min <= spread_cm_max),
  constraint plant_profiles_years_range check (years_to_full_size_min <= years_to_full_size_max),
  -- Every species has a safety status (a variety may inherit).
  constraint plant_profiles_species_safety check (parent_id is not null or safety_status is not null),
  -- Anything other than 'unknown' must record who checked it, when, and
  -- which edition of the HTA guide.
  constraint plant_profiles_safety_checked check (
    safety_status is null or safety_status = 'unknown'
    or (safety_verified_by is not null and safety_verified_at is not null and hta_edition is not null)
  ),
  -- harmful_to only applies to plants on the HTA list.
  constraint plant_profiles_harmful_to_hta check (
    harmful_to is null
    or safety_status in ('hta_a', 'hta_b', 'hta_c', 'hta_bulb_or_fruit_label')
  ),
  -- Named pets only make sense when the plant is harmful to pets.
  constraint plant_profiles_pets_affected check (
    pets_affected is null or cardinality(pets_affected) = 0
    or harmful_to in ('pets', 'both')
  ),
  constraint plant_profiles_verified_by check (
    status = 'draft' or (verified_by is not null and verified_at is not null)
  )
);

create index plant_profiles_parent_id_idx on public.plant_profiles (parent_id);
create index plant_profiles_status_idx on public.plant_profiles (status);

-- Keeps the species → variety structure one level deep, defaults safety to
-- 'unknown' on species, and stops a variety being verified before its species.
create function public.plant_profiles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.plant_profiles%rowtype;
begin
  if new.parent_id is null then
    new.safety_status := coalesce(new.safety_status, 'unknown');
  else
    select * into parent from public.plant_profiles where id = new.parent_id;
    if parent.parent_id is not null then
      raise exception 'A variety''s parent must be a species, not another variety';
    end if;
    if exists (select 1 from public.plant_profiles where parent_id = new.id) then
      raise exception 'This profile has varieties, so it cannot become a variety itself';
    end if;
    if new.status = 'verified' and parent.status <> 'verified' then
      raise exception 'Verify the species (%) before its varieties', parent.slug;
    end if;
  end if;
  return new;
end;
$$;

create trigger plant_profiles_before_write
  before insert or update on public.plant_profiles
  for each row execute function public.plant_profiles_before_write();

create trigger plant_profiles_updated_at
  before update on public.plant_profiles
  for each row execute function public.set_updated_at();


-- Jo's label photos used to cross-check a profile. Admin only, never public.
-- (The spec's label_photo_refs field, kept in its own table so the links
-- stay hidden from users who can read the profile.)
create table public.plant_label_photos (
  id            uuid primary key default gen_random_uuid(),
  plant_id      uuid not null references public.plant_profiles (id) on delete cascade,
  storage_path  text not null unique,   -- path in the catalogue-label-photos bucket
  taken_on      date,
  notes         text,
  created_at    timestamptz not null default now()
);

create index plant_label_photos_plant_id_idx on public.plant_label_photos (plant_id);


-- One row per care task. A variety's task overrides its species' task of
-- the same type; plant_care_tasks_resolved applies that rule.
create table public.plant_care_tasks (
  id            uuid primary key default gen_random_uuid(),
  plant_id      uuid not null references public.plant_profiles (id) on delete cascade,
  task_type     task_type not null,
  months        integer[] not null check (
                  cardinality(months) between 1 and 12
                  and months <@ array[1,2,3,4,5,6,7,8,9,10,11,12]
                  and array_position(months, null) is null
                ),
  task_trigger  task_trigger not null default 'none',
  applies_to    task_applies_to[] not null
                default array['grown_from_seed', 'bought_as_plant', 'in_pot', 'in_ground']::task_applies_to[]
                check (cardinality(applies_to) >= 1),
  instructions  text not null check (length(btrim(instructions)) > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index plant_care_tasks_plant_id_idx on public.plant_care_tasks (plant_id);

create trigger plant_care_tasks_updated_at
  before update on public.plant_care_tasks
  for each row execute function public.set_updated_at();


-- ─── 4. Garden (each user's own records) ────────────────────────────────────

-- Areas the user names themselves. Carries over the extra attributes from
-- the old garden_zones table so zones can later be matched against plants.
create table public.zones (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (length(btrim(name)) > 0),
  zone_type      zone_type,
  sun            sun_level,
  aspect         compass_point,
  soil_type      soil_type,
  soil_drainage  soil_moisture,
  shelter        exposure,
  frost_pocket   boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)     -- lets garden_plants check the zone is the same user's
);

create trigger zones_updated_at
  before update on public.zones
  for each row execute function public.set_updated_at();


-- One group of one plant in one place.
create table public.garden_plants (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plant_id       uuid not null references public.plant_profiles (id) on delete restrict,
  zone_id        uuid,
  nickname       text,
  planted_month  smallint check (planted_month between 1 and 12),
  planted_year   smallint check (planted_year between 1900 and 2100),
  started_as     started_as,
  in_pot         boolean,          -- empty until known (e.g. kit plants, duplicates)
  quantity       integer check (quantity > 0),
  added_via      added_via,        -- empty only for records copied from the old tables
  status         garden_plant_status not null default 'growing',
  -- Worked out automatically: a growing plant missing its zone or planting details.
  needs_details  boolean generated always as (
                   status = 'growing'
                   and (zone_id is null or planted_year is null
                        or started_as is null or in_pot is null)
                 ) stored,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint garden_plants_month_needs_year check (planted_month is null or planted_year is not null),
  -- Deleting a zone leaves its plants in place with no zone.
  constraint garden_plants_zone_fk foreign key (zone_id, user_id)
    references public.zones (id, user_id) on delete set null (zone_id),
  unique (id, user_id)
);

create index garden_plants_user_id_idx on public.garden_plants (user_id);
create index garden_plants_plant_id_idx on public.garden_plants (plant_id);
create index garden_plants_zone_id_idx on public.garden_plants (zone_id);

create trigger garden_plants_updated_at
  before update on public.garden_plants
  for each row execute function public.set_updated_at();


-- Up to two photos per garden plant (positions 1 and 2).
-- Files live in the private plant-photos bucket under {user_id}/...
-- Deleting a row does not delete the file; the app removes both.
create table public.garden_plant_photos (
  id               uuid primary key default gen_random_uuid(),
  garden_plant_id  uuid not null,
  user_id          uuid not null default auth.uid(),
  position         smallint not null check (position in (1, 2)),
  storage_path     text not null,   -- ~1,200 px / 200 KB image
  thumb_path       text not null,   -- ~30 KB thumbnail
  created_at       timestamptz not null default now(),
  unique (garden_plant_id, position),
  check (split_part(storage_path, '/', 1) = user_id::text),
  check (split_part(thumb_path, '/', 1) = user_id::text),
  foreign key (garden_plant_id, user_id)
    references public.garden_plants (id, user_id) on delete cascade
);


-- Dated notes, e.g. "Moved to the sunnier end".
create table public.garden_plant_notes (
  id               uuid primary key default gen_random_uuid(),
  garden_plant_id  uuid not null,
  user_id          uuid not null default auth.uid(),
  noted_on         date not null default current_date,
  body             text not null check (length(btrim(body)) > 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (garden_plant_id, user_id)
    references public.garden_plants (id, user_id) on delete cascade
);

create index garden_plant_notes_plant_idx on public.garden_plant_notes (garden_plant_id, noted_on);

create trigger garden_plant_notes_updated_at
  before update on public.garden_plant_notes
  for each row execute function public.set_updated_at();


-- "Mark as done" for a care task, per month and year, so the task comes
-- back next year (same approach as the old user_task_completions table).
create table public.garden_task_completions (
  id               uuid primary key default gen_random_uuid(),
  garden_plant_id  uuid not null,
  user_id          uuid not null default auth.uid(),
  care_task_id     uuid not null references public.plant_care_tasks (id) on delete cascade,
  year             smallint not null check (year between 2000 and 2100),
  month            smallint not null check (month between 1 and 12),
  completed_at     timestamptz not null default now(),
  unique (garden_plant_id, care_task_id, year, month),
  foreign key (garden_plant_id, user_id)
    references public.garden_plants (id, user_id) on delete cascade
);

create index garden_task_completions_task_idx on public.garden_task_completions (care_task_id);


-- ─── 5. Inheritance views ───────────────────────────────────────────────────
-- security_invoker = true means the reader's own Row Level Security applies.

-- Every profile with its variety fields filled in from its species.
-- Ranges and the safety block are inherited as a whole, never mixed.
create view public.plant_profiles_resolved
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
  coalesce(p.exposure, s.exposure)                            as exposure,
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

  -- Safety: the variety's own block if it has a status, otherwise the species'.
  -- If the species can't be read either, this falls back to 'unknown'.
  coalesce(p.safety_status, s.safety_status, 'unknown')       as safety_status,
  case when p.safety_status is not null then p.harmful_to         else s.harmful_to         end as harmful_to,
  case when p.safety_status is not null then p.harmful_parts      else s.harmful_parts      end as harmful_parts,
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
  p.last_reviewed
from public.plant_profiles p
left join public.plant_profiles s on s.id = p.parent_id;


-- Care tasks that apply to each profile: its own tasks, plus its species'
-- tasks of any type the variety doesn't override. for_plant_id is the
-- profile you're asking about; plant_id is where the task row lives.
create view public.plant_care_tasks_resolved
with (security_invoker = true) as
select p.id as for_plant_id, t.*, false as inherited
from public.plant_profiles p
join public.plant_care_tasks t on t.plant_id = p.id
union all
select p.id as for_plant_id, t.*, true as inherited
from public.plant_profiles p
join public.plant_care_tasks t on t.plant_id = p.parent_id
where not exists (
  select 1 from public.plant_care_tasks o
  where o.plant_id = p.id and o.task_type = t.task_type
);


-- ─── 6. Row Level Security ──────────────────────────────────────────────────

-- Profiles linked to the signed-in user's own garden plants, plus their
-- species. Lets users see drafts they've saved (e.g. from a scan) without
-- opening up every draft. security definer avoids a policy loop on
-- plant_profiles.
create function public.my_linked_plant_profile_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.plant_id
  from public.garden_plants g
  where g.user_id = auth.uid()
  union
  select p.parent_id
  from public.garden_plants g
  join public.plant_profiles p on p.id = g.plant_id
  where g.user_id = auth.uid() and p.parent_id is not null
$$;

revoke execute on function public.my_linked_plant_profile_ids() from public, anon;
grant execute on function public.my_linked_plant_profile_ids() to authenticated;

alter table public.plant_profiles          enable row level security;
alter table public.plant_label_photos      enable row level security;
alter table public.plant_care_tasks        enable row level security;
alter table public.zones                   enable row level security;
alter table public.garden_plants           enable row level security;
alter table public.garden_plant_photos     enable row level security;
alter table public.garden_plant_notes      enable row level security;
alter table public.garden_task_completions enable row level security;

-- Catalogue: signed-in users read verified profiles (and drafts linked to
-- their own plants); only admins see all drafts and make changes.
create policy "Signed-in users read verified or linked profiles"
  on public.plant_profiles for select to authenticated
  using (
    status = 'verified'
    or (select public.is_catalogue_admin())
    or id in (select public.my_linked_plant_profile_ids())
  );

create policy "Admins insert profiles"
  on public.plant_profiles for insert to authenticated
  with check ((select public.is_catalogue_admin()));

create policy "Admins update profiles"
  on public.plant_profiles for update to authenticated
  using ((select public.is_catalogue_admin()))
  with check ((select public.is_catalogue_admin()));

create policy "Admins delete profiles"
  on public.plant_profiles for delete to authenticated
  using ((select public.is_catalogue_admin()));

-- Care tasks are readable whenever their profile is.
create policy "Signed-in users read tasks of readable profiles"
  on public.plant_care_tasks for select to authenticated
  using (exists (select 1 from public.plant_profiles p where p.id = plant_id));

create policy "Admins insert care tasks"
  on public.plant_care_tasks for insert to authenticated
  with check ((select public.is_catalogue_admin()));

create policy "Admins update care tasks"
  on public.plant_care_tasks for update to authenticated
  using ((select public.is_catalogue_admin()))
  with check ((select public.is_catalogue_admin()));

create policy "Admins delete care tasks"
  on public.plant_care_tasks for delete to authenticated
  using ((select public.is_catalogue_admin()));

create policy "Admins only"
  on public.plant_label_photos for all to authenticated
  using ((select public.is_catalogue_admin()))
  with check ((select public.is_catalogue_admin()));

-- Garden: users see and change only their own rows.
create policy "Users manage own zones"
  on public.zones for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage own garden plants"
  on public.garden_plants for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage own garden plant photos"
  on public.garden_plant_photos for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage own garden plant notes"
  on public.garden_plant_notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users manage own task completions"
  on public.garden_task_completions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ─── 7. Draft profiles from the app ─────────────────────────────────────────
-- The scanner (and search, when a plant isn't in the catalogue) calls this
-- instead of writing to plant_profiles directly:
--   supabase.rpc('create_draft_plant_profile', {
--     p_latin_name: "Lavandula angustifolia 'Hidcote'",
--     p_common_name: 'English lavender',
--     p_label_text: 'Lavender Hidcote',
--     p_source: 'label'          // 'label' (label scan) or 'claude' (photo ID / name lookup)
--   })
-- It returns the existing profile if the slug is already in the catalogue,
-- otherwise it creates a draft (species first, then the variety if there's
-- a cultivar). It only ever writes identity fields: no care, no safety
-- (which stays 'unknown'). Existing profiles are never changed.
create function public.create_draft_plant_profile(
  p_latin_name  text,
  p_common_name text default null,
  p_label_text  text default null,
  p_source      text default 'claude'
)
returns public.plant_profiles
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n            record;
  src          text;
  species_slug text;
  variety_slug text;
  species_row  public.plant_profiles;
  variety_row  public.plant_profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_source not in ('label', 'claude', 'api') then
    raise exception 'p_source must be label, claude or api';
  end if;
  src := p_source;

  select * into n from public.parse_botanical_name(p_latin_name);
  -- Genus is one word; species (if any) is an epithet, optionally a hybrid
  -- (× or x) and/or with subsp. / var. / f., e.g. "× intermedia",
  -- "nemorosa subsp. tesquicola".
  if n.genus is null or n.genus !~ '^[A-Z][a-z-]+$'
     or (n.species is not null and n.species !~
         '^((×|x) ?)?[a-z-]+( (subsp\.|ssp\.|var\.|f\.) [a-z-]+)?$') then
    raise exception 'Could not read a botanical name from "%"', p_latin_name;
  end if;

  species_slug := public.make_plant_slug(n.genus, n.species, null);

  insert into public.plant_profiles (
    slug, genus, species, common_names, label_aliases, field_sources
  )
  values (
    species_slug, n.genus, n.species,
    -- The common name and label text go on the variety when there is one.
    case when n.cultivar is null and p_common_name is not null then array[btrim(p_common_name)] end,
    case when n.cultivar is null and p_label_text is not null then array[btrim(p_label_text)] end,
    jsonb_strip_nulls(jsonb_build_object(
      'genus', src, 'species', case when n.species is not null then src end,
      'common_names', case when n.cultivar is null and p_common_name is not null then src end,
      'label_aliases', case when n.cultivar is null and p_label_text is not null then 'label' end
    ))
  )
  on conflict (slug) do nothing;

  select * into species_row from public.plant_profiles where slug = species_slug;

  if n.cultivar is null then
    return species_row;
  end if;

  if species_row.parent_id is not null then
    raise exception 'Slug % belongs to a variety, not a species', species_slug;
  end if;

  variety_slug := public.make_plant_slug(n.genus, n.species, n.cultivar);

  insert into public.plant_profiles (
    parent_id, slug, cultivar, common_names, label_aliases, field_sources
  )
  values (
    species_row.id, variety_slug, n.cultivar,
    case when p_common_name is not null then array[btrim(p_common_name)] end,
    case when p_label_text is not null then array[btrim(p_label_text)] end,
    jsonb_strip_nulls(jsonb_build_object(
      'cultivar', src,
      'common_names', case when p_common_name is not null then src end,
      'label_aliases', case when p_label_text is not null then 'label' end
    ))
  )
  on conflict (slug) do nothing;

  select * into variety_row from public.plant_profiles where slug = variety_slug;
  return variety_row;
end;
$$;

revoke execute on function public.create_draft_plant_profile(text, text, text, text) from public, anon;
grant execute on function public.create_draft_plant_profile(text, text, text, text) to authenticated;


-- ─── 8. Storage ─────────────────────────────────────────────────────────────
-- plant-photos: users' own photos, private, owner-only.
--   Path: {user_id}/{garden_plant_id}/{file}.webp  (and ..._thumb.webp)
--   The app shows them with signed URLs (createSignedUrl), not public links.
-- catalogue-label-photos: Jo's label photos, private, admin-only.
--   Path: {plant_profile_slug}/{file}.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('plant-photos', 'plant-photos', false, 2097152,            -- 2 MB
   array['image/jpeg', 'image/webp']),
  ('catalogue-label-photos', 'catalogue-label-photos', false, 10485760,  -- 10 MB
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "Sown: users read own plant photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'plant-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Sown: users upload own plant photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'plant-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Sown: users replace own plant photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'plant-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'plant-photos'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Sown: users delete own plant photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'plant-photos'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Sown: admins manage label photos"
  on storage.objects for all to authenticated
  using (bucket_id = 'catalogue-label-photos' and (select public.is_catalogue_admin()))
  with check (bucket_id = 'catalogue-label-photos' and (select public.is_catalogue_admin()));

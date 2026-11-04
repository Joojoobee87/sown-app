-- ════════════════════════════════════════════════════════════════════════════
-- Scan screen support (needs 20261104_plant_catalogue.sql first)
--
--   1. search_plant_profiles()       — catalogue search for the app
--   2. fill_draft_plant_profile()    — lets the identify-plant edge function
--                                      fill a DRAFT species from Claude's answer
--   3. ai_daily_limits / ai_usage /  — per-user daily cap on Claude calls
--      claim_ai_call()
--
-- Change a limit at any time in the SQL editor, e.g.:
--   update public.ai_daily_limits set per_user_per_day = 30 where kind = 'lookup';
-- ════════════════════════════════════════════════════════════════════════════


-- ─── Private helpers ────────────────────────────────────────────────────────
-- Kept out of the public schema so the app's API can't call them.
-- Each one reads a value from Claude's JSON and returns null unless it is
-- the right type and (where a list is given) one of the allowed values.

create schema if not exists sown_private;
revoke all on schema sown_private from public, anon, authenticated;

create function sown_private.pick_text(p jsonb, k text, allowed text[] default null, max_len int default 500)
returns text language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p -> k) = 'string'
     and length(btrim(p ->> k)) between 1 and max_len
     and (allowed is null or btrim(p ->> k) = any (allowed))
    then btrim(p ->> k)
  end
$$;

-- Distinct allowed values (or, with no list, short non-empty strings).
create function sown_private.pick_text_array(p jsonb, k text, allowed text[] default null,
                                             max_items int default 12, max_len int default 200)
returns text[] language sql immutable set search_path = '' as $$
  select nullif(array(
    select x from (
      select distinct on (btrim(x)) btrim(x) as x, ord
      from jsonb_array_elements_text(
             case when jsonb_typeof(p -> k) = 'array' then p -> k else '[]'::jsonb end
           ) with ordinality as t(x, ord)
      where length(btrim(x)) between 1 and max_len
        and (allowed is null or btrim(x) = any (allowed))
      order by btrim(x), ord
    ) d
    order by ord
    limit max_items
  ), '{}')
$$;

create function sown_private.pick_int(p jsonb, k text, lo int, hi int)
returns int language sql immutable set search_path = '' as $$
  select case
    when jsonb_typeof(p -> k) = 'number' and (p ->> k)::numeric between lo and hi
    then round((p ->> k)::numeric)::int
  end
$$;

create function sown_private.pick_bool(p jsonb, k text)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p -> k) = 'boolean' then (p ->> k)::boolean end
$$;

create function sown_private.pick_months(p jsonb, k text)
returns int[] language sql immutable set search_path = '' as $$
  select nullif(array(
    select distinct x::int
    from jsonb_array_elements_text(
           case when jsonb_typeof(p -> k) = 'array' then p -> k else '[]'::jsonb end
         ) as t(x)
    where x ~ '^([1-9]|1[0-2])$'
    order by 1
  ), '{}')
$$;


-- ─── 1. Catalogue search ────────────────────────────────────────────────────
-- Matches botanical name, cultivar, common names, synonyms and label
-- aliases. Runs with the caller's permissions, so users only find
-- verified profiles and drafts linked to their own plants.
create function public.search_plant_profiles(p_query text, p_limit int default 8)
returns setof public.plant_profiles_resolved
language sql
stable
set search_path = ''
as $$
  with q as (
    select lower(btrim(p_query)) as raw,
           '%' || replace(replace(replace(lower(btrim(p_query)), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select r.*
  from public.plant_profiles_resolved r, q
  where length(q.raw) >= 2
    and (
      lower(concat_ws(' ', r.genus, r.species, r.cultivar)) like q.pat
      or exists (
        select 1
        from unnest(coalesce(r.common_names, '{}') || coalesce(r.synonyms, '{}')
                    || coalesce(r.label_aliases, '{}')) as n
        where lower(n) like q.pat
      )
    )
  order by
    (r.status = 'verified') desc,
    (lower(coalesce(r.common_names[1], '')) like q.raw || '%'
     or lower(concat_ws(' ', r.genus, r.species, r.cultivar)) like q.raw || '%') desc,
    (r.cultivar is null) desc,
    r.slug
  limit least(greatest(coalesce(p_limit, 8), 1), 25)
$$;

revoke execute on function public.search_plant_profiles(text, int) from public, anon;
grant execute on function public.search_plant_profiles(text, int) to authenticated;


-- ─── 2. Fill a draft from Claude's answer ───────────────────────────────────
-- Called only by the identify-plant edge function (service role).
-- Rules, enforced here rather than in the edge function:
--   • Care goes on the SPECIES. Given a variety, it fills the variety's
--     species instead and never writes to the variety itself.
--   • Does nothing unless that species is a draft.
--   • Only fills fields that are empty; never overwrites anything.
--   • Has no safety fields at all: safety stays as it is ('unknown').
--   • Adds care tasks only if the species has none yet.
--   • Ignores values that aren't in the allowed lists.
-- Returns {"profile_id", "filled": [fields], "tasks_added", "skipped"}.
create function public.fill_draft_plant_profile(p_id uuid, p_data jsonb, p_tasks jsonb default '[]')
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target      public.plant_profiles;
  before_row  jsonb;
  after_row   jsonb;
  filled      text[];
  tasks_added int := 0;
  e           jsonb;
  t_type      text;
  t_months    int[];
  t_text      text;
  h_lo int; h_hi int; s_lo int; s_hi int; y_lo int; y_hi int;
  problems    jsonb;
  fillable    constant text[] := array[
    'common_names','family','plant_type','rhs_hardiness','sun','aspect','exposure',
    'soil_type','soil_moisture','soil_ph','height_cm_min','height_cm_max',
    'spread_cm_min','spread_cm_max','years_to_full_size_min','years_to_full_size_max',
    'suits_containers','difficulty','water_need','water_notes','flowering_months',
    'summary','care_planting','care_ongoing','care_through_year','common_problems',
    'beginner_tips','good_for_pollinators'];
begin
  select * into target from public.plant_profiles where id = p_id;
  if not found then
    raise exception 'No plant profile with id %', p_id;
  end if;
  if target.parent_id is not null then
    p_id := target.parent_id;    -- fill the species, not the variety
  end if;

  -- Lock the species row so two scans can't fill it at the same time
  select * into target from public.plant_profiles where id = p_id for update;
  if target.status <> 'draft' then
    return jsonb_build_object('profile_id', target.id, 'filled', '[]'::jsonb,
                              'tasks_added', 0, 'skipped', 'not a draft');
  end if;

  p_data := coalesce(p_data, '{}'::jsonb);

  -- Ranges: take min/max together, in the right order. 0 means "not known".
  h_lo := sown_private.pick_int(p_data, 'height_cm_min', 1, 5000);
  h_hi := sown_private.pick_int(p_data, 'height_cm_max', 1, 5000);
  s_lo := sown_private.pick_int(p_data, 'spread_cm_min', 1, 5000);
  s_hi := sown_private.pick_int(p_data, 'spread_cm_max', 1, 5000);
  y_lo := sown_private.pick_int(p_data, 'years_to_full_size_min', 1, 100);
  y_hi := sown_private.pick_int(p_data, 'years_to_full_size_max', 1, 100);

  -- Common problems: [{problem, what_to_do}], both short strings
  select nullif(jsonb_agg(jsonb_build_object('problem', btrim(x ->> 'problem'),
                                             'what_to_do', btrim(x ->> 'what_to_do'))), '[]'::jsonb)
  into problems
  from (
    select x from jsonb_array_elements(
      case when jsonb_typeof(p_data -> 'common_problems') = 'array'
           then p_data -> 'common_problems' else '[]'::jsonb end) x
    where jsonb_typeof(x -> 'problem') = 'string' and jsonb_typeof(x -> 'what_to_do') = 'string'
      and length(btrim(x ->> 'problem')) between 1 and 120
      and length(btrim(x ->> 'what_to_do')) between 1 and 400
    limit 8
  ) s;

  before_row := to_jsonb(target);

  update public.plant_profiles p set
    common_names          = coalesce(p.common_names, sown_private.pick_text_array(p_data, 'common_names', null, 5, 80)),
    family                = coalesce(p.family, sown_private.pick_text(p_data, 'family', null, 80)),
    plant_type            = coalesce(p.plant_type,
                              sown_private.pick_text(p_data, 'plant_type', enum_range(null::public.plant_type)::text[])::public.plant_type),
    rhs_hardiness         = coalesce(p.rhs_hardiness,
                              sown_private.pick_text(p_data, 'rhs_hardiness', enum_range(null::public.rhs_hardiness)::text[])::public.rhs_hardiness),
    sun                   = coalesce(p.sun,
                              sown_private.pick_text_array(p_data, 'sun', enum_range(null::public.sun_level)::text[])::public.sun_level[]),
    aspect                = coalesce(p.aspect,
                              sown_private.pick_text_array(p_data, 'aspect', array['N','E','S','W'])::public.compass_point[]),
    exposure              = coalesce(p.exposure,
                              sown_private.pick_text_array(p_data, 'exposure', enum_range(null::public.exposure)::text[])::public.exposure[]),
    soil_type             = coalesce(p.soil_type,
                              sown_private.pick_text_array(p_data, 'soil_type', enum_range(null::public.soil_type)::text[])::public.soil_type[]),
    soil_moisture         = coalesce(p.soil_moisture,
                              sown_private.pick_text(p_data, 'soil_moisture', enum_range(null::public.soil_moisture)::text[])::public.soil_moisture),
    soil_ph               = coalesce(p.soil_ph,
                              sown_private.pick_text_array(p_data, 'soil_ph', enum_range(null::public.soil_ph)::text[])::public.soil_ph[]),
    height_cm_min         = case when p.height_cm_min is null and p.height_cm_max is null
                                 then least(coalesce(h_lo, h_hi), coalesce(h_hi, h_lo)) else p.height_cm_min end,
    height_cm_max         = case when p.height_cm_min is null and p.height_cm_max is null
                                 then greatest(coalesce(h_lo, h_hi), coalesce(h_hi, h_lo)) else p.height_cm_max end,
    spread_cm_min         = case when p.spread_cm_min is null and p.spread_cm_max is null
                                 then least(coalesce(s_lo, s_hi), coalesce(s_hi, s_lo)) else p.spread_cm_min end,
    spread_cm_max         = case when p.spread_cm_min is null and p.spread_cm_max is null
                                 then greatest(coalesce(s_lo, s_hi), coalesce(s_hi, s_lo)) else p.spread_cm_max end,
    years_to_full_size_min = case when p.years_to_full_size_min is null and p.years_to_full_size_max is null
                                 then least(coalesce(y_lo, y_hi), coalesce(y_hi, y_lo)) else p.years_to_full_size_min end,
    years_to_full_size_max = case when p.years_to_full_size_min is null and p.years_to_full_size_max is null
                                 then greatest(coalesce(y_lo, y_hi), coalesce(y_hi, y_lo)) else p.years_to_full_size_max end,
    suits_containers      = coalesce(p.suits_containers, sown_private.pick_bool(p_data, 'suits_containers')),
    difficulty            = coalesce(p.difficulty,
                              sown_private.pick_text(p_data, 'difficulty', enum_range(null::public.difficulty)::text[])::public.difficulty),
    water_need            = coalesce(p.water_need,
                              sown_private.pick_text(p_data, 'water_need', enum_range(null::public.water_need)::text[])::public.water_need),
    water_notes           = coalesce(p.water_notes, sown_private.pick_text(p_data, 'water_notes', null, 300)),
    flowering_months      = coalesce(p.flowering_months, sown_private.pick_months(p_data, 'flowering_months')::public.month_list),
    summary               = coalesce(p.summary, sown_private.pick_text(p_data, 'summary', null, 400)),
    care_planting         = coalesce(p.care_planting, sown_private.pick_text(p_data, 'care_planting', null, 1200)),
    care_ongoing          = coalesce(p.care_ongoing, sown_private.pick_text(p_data, 'care_ongoing', null, 1200)),
    care_through_year     = coalesce(p.care_through_year, sown_private.pick_text(p_data, 'care_through_year', null, 1200)),
    common_problems       = coalesce(p.common_problems, problems),
    beginner_tips         = coalesce(p.beginner_tips, sown_private.pick_text_array(p_data, 'beginner_tips', null, 6, 200)),
    good_for_pollinators  = coalesce(p.good_for_pollinators,
                              sown_private.pick_text(p_data, 'good_for_pollinators', enum_range(null::public.yes_no_unknown)::text[])::public.yes_no_unknown)
  where p.id = target.id
  returning to_jsonb(p) into after_row;

  -- Record which fields Claude filled
  select coalesce(array_agg(k), '{}') into filled
  from unnest(fillable) k
  where (before_row -> k) = 'null'::jsonb and (after_row -> k) <> 'null'::jsonb;

  if cardinality(filled) > 0 then
    update public.plant_profiles p
    set field_sources = p.field_sources
                        || (select jsonb_object_agg(k, 'claude') from unnest(filled) k)
    where p.id = target.id;
  end if;

  -- Care tasks, only if the species has none yet
  if not exists (select 1 from public.plant_care_tasks where plant_id = target.id)
     and jsonb_typeof(p_tasks) = 'array' then
    for e in select x from jsonb_array_elements(p_tasks) x limit 15 loop
      t_type   := sown_private.pick_text(e, 'task_type', enum_range(null::public.task_type)::text[]);
      t_months := sown_private.pick_months(e, 'months');
      t_text   := sown_private.pick_text(e, 'instructions', null, 500);
      continue when t_type is null or t_months is null or t_text is null;

      insert into public.plant_care_tasks (plant_id, task_type, months, repeat, task_trigger, applies_to, instructions)
      values (
        target.id,
        t_type::public.task_type,
        t_months::public.month_list,
        coalesce(sown_private.pick_text(e, 'repeat', enum_range(null::public.task_repeat)::text[]), 'once')::public.task_repeat,
        coalesce(sown_private.pick_text(e, 'task_trigger', enum_range(null::public.task_trigger)::text[]), 'none')::public.task_trigger,
        coalesce(sown_private.pick_text_array(e, 'applies_to', enum_range(null::public.task_applies_to)::text[])::public.task_applies_to[],
                 enum_range(null::public.task_applies_to)),
        t_text
      );
      tasks_added := tasks_added + 1;
    end loop;
  end if;

  return jsonb_build_object('profile_id', target.id, 'filled', to_jsonb(filled),
                            'tasks_added', tasks_added, 'skipped', null);
end;
$$;

revoke execute on function public.fill_draft_plant_profile(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.fill_draft_plant_profile(uuid, jsonb, jsonb) to service_role;


-- ─── 3. Daily AI limits ─────────────────────────────────────────────────────
-- lookup: "Look up with AI" by name.  scan: label scan or photo identify.
-- Admins (Jo) aren't limited, but their calls are still counted.
create table public.ai_daily_limits (
  kind              text primary key check (kind in ('lookup', 'scan')),
  per_user_per_day  integer not null check (per_user_per_day >= 0),
  updated_at        timestamptz not null default now()
);

insert into public.ai_daily_limits (kind, per_user_per_day) values
  ('lookup', 20),
  ('scan', 50);

create trigger ai_daily_limits_updated_at
  before update on public.ai_daily_limits
  for each row execute function public.set_updated_at();

-- One row per user, kind and UK day.
create table public.ai_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  kind     text not null references public.ai_daily_limits (kind),
  used_on  date not null,
  calls    integer not null default 0 check (calls >= 0),
  primary key (user_id, kind, used_on)
);

alter table public.ai_daily_limits enable row level security;
alter table public.ai_usage        enable row level security;

create policy "Signed-in users read the limits"
  on public.ai_daily_limits for select to authenticated using (true);

create policy "Users read own AI usage"
  on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Counts one call if the user is under today's limit.
-- Returns {"allowed", "used", "limit", "unlimited"}.
-- Called only by the identify-plant edge function (service role), before
-- it calls Claude, so failed calls count too.
create function public.claim_ai_call(p_user uuid, p_kind text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  day_limit int;
  unlimited boolean;
  today     date := (now() at time zone 'Europe/London')::date;
  used      int;
begin
  select per_user_per_day into day_limit from public.ai_daily_limits where kind = p_kind;
  if day_limit is null then
    raise exception 'Unknown AI call kind %', p_kind;
  end if;

  select coalesce(raw_app_meta_data ->> 'role' = 'admin', false) into unlimited
  from auth.users where id = p_user;
  if unlimited is null then
    raise exception 'Unknown user';
  end if;

  if unlimited or day_limit > 0 then
    insert into public.ai_usage as u (user_id, kind, used_on, calls)
    values (p_user, p_kind, today, 1)
    on conflict (user_id, kind, used_on) do update
      set calls = u.calls + 1
      where unlimited or u.calls < day_limit
    returning calls into used;
  end if;

  if used is null then
    select coalesce(max(calls), 0) into used from public.ai_usage
    where user_id = p_user and kind = p_kind and used_on = today;
    return jsonb_build_object('allowed', false, 'used', used, 'limit', day_limit, 'unlimited', false);
  end if;

  return jsonb_build_object('allowed', true, 'used', used, 'limit', day_limit, 'unlimited', unlimited);
end;
$$;

revoke execute on function public.claim_ai_call(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_ai_call(uuid, text) to service_role;

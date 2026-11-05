-- ════════════════════════════════════════════════════════════════════════════
-- HTA Guide to Potentially Harmful Plants (admin only)
--
--   1. hta_entries: one row per entry in the HTA list (3rd edition, 2022),
--      loaded from Jo's CSV by scripts/hta/build-seed.mjs. The CSV and the
--      generated SQL are HTA copyright and are never committed.
--   2. search_hta_entries(): finds candidate rows for a plant, follows
--      "see" cross-references, and says how well each row matches.
--   3. set_profile_safety(): applies the row Jo picks (or "Not on HTA list")
--      to the SPECIES record, with her name, the date and the edition.
--      Safety is never filled automatically.
--
-- See docs/admin-screen-notes.md for the rules.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── 1. The HTA list ────────────────────────────────────────────────────────
create table public.hta_entries (
  hta_ref                     text primary key,          -- e.g. HTA3-002
  genus                       text not null,
  taxon                       text not null,             -- genus, or genus + species
  hta_condition               text,                      -- e.g. "female plants only"
  synonyms                    text[],
  see_also                    text[],                    -- cross-reference targets
  is_cross_reference          boolean not null,          -- "see …" rows carry no safety data
  common_names                text[],
  safety_status               public.safety_status,      -- null on cross-references
  specialist_list             boolean not null default false,
  standard_label              text,                      -- 'ornamental fruit' / 'ornamental bulbs'
  harmful_to                  public.harmful_to,
  pets_affected               public.pet_kind[],         -- "all pets" = every value
  harmful_if_eaten            boolean,
  skin_irritant               boolean,
  label_wording_growing       text,
  label_wording_bulbs         text,
  affects_as_printed          text,
  more_than_one_label_applies boolean not null default false,
  hta_category_as_printed     text,
  source_page                 smallint,
  scientific_name_as_printed  text,
  hta_edition                 text not null,
  constraint hta_entries_cross_reference check (
    (is_cross_reference and safety_status is null and see_also is not null)
    or (not is_cross_reference and safety_status is not null and harmful_to is not null)
  )
);

create index hta_entries_genus_idx on public.hta_entries (lower(genus));

alter table public.hta_entries enable row level security;

create policy "Admins only"
  on public.hta_entries for all to authenticated
  using ((select public.is_catalogue_admin()))
  with check ((select public.is_catalogue_admin()));


-- ─── Profile columns: which HTA row was used, and who checked it ────────────
alter table public.plant_profiles
  add column hta_ref text references public.hta_entries (hta_ref) on delete set null,
  add column safety_verified_by_name text;


-- ─── 2. Search ──────────────────────────────────────────────────────────────
-- p_query: a botanical name ("Salvia nemorosa 'Caradonna'"), a genus, a
-- synonym or a common name. Returns candidate rows (never cross-reference
-- rows themselves) with:
--   match: 'species'          the row names this species
--          'genus'            the whole genus is listed
--          'synonym'          matched one of the row's synonyms
--          'cross_reference'  reached through a "see …" entry
--          'other_species'    same genus, but the row names a different species
--          'listed_species'   genus searched without a species; the row names one
--          'common_name'      matched a common name only
--   note:  a short explanation for the admin screen
-- Runs with the caller's permissions, so only admins get rows.
create function public.search_hta_entries(p_query text)
returns table (entry public.hta_entries, match text, note text)
language sql
stable
set search_path = ''
as $$
  with q as (
    select lower(btrim(regexp_replace(p_query, '[''‘’"“”][^''‘’"“”]*[''‘’"“”]', '', 'g'))) as raw
  ),
  parts as (
    select raw,
           split_part(raw, ' ', 1) as g,
           -- species: the second word, unless it's a hybrid sign or rank word
           nullif(case when split_part(raw, ' ', 2) in ('x', '×', 'subsp.', 'var.', 'cv.', 'f.')
                       then split_part(raw, ' ', 3) else split_part(raw, ' ', 2) end, '') as sp
    from q
  ),
  direct as (
    select e, p.g, p.sp,
      case
        when lower(e.genus) = p.g and lower(e.taxon) = p.g then 'genus'
        when lower(e.genus) = p.g and p.sp is not null
             and lower(e.taxon) like p.g || ' ' || p.sp || '%' then 'species'
        when lower(e.genus) = p.g and p.sp is not null then 'other_species'
        when lower(e.genus) = p.g then 'listed_species'
        when exists (select 1 from unnest(e.synonyms) s
                     where lower(split_part(s, ' ', 1)) = p.g
                        or lower(s) = p.raw) then 'synonym'
        when length(p.raw) >= 3 and exists (select 1 from unnest(e.common_names) c
                     where lower(c) like '%' || p.raw || '%') then 'common_name'
      end as match
    from public.hta_entries e, parts p
    where length(p.raw) >= 2
  ),
  -- Follow "see …" rows that match the plant (not ones for other species)
  -- to the rows they point at. A target can be:
  --   a species         "Kalanchoe blossfeldiana"     → that species' row
  --   a genus + note    "Solanum, ornamental species" → rows with that condition
  --   a genus           "Colchicum"                   → the whole-genus rows
  -- and if nothing fits that closely, every row of the genus.
  targets as (
    select d.e as xref, tn.tg, tn.tsp, tp.cond
    from direct d
    cross join lateral unnest((d.e).see_also) target
    cross join lateral (
      select btrim(regexp_replace(target, ',.*$', '')) as name,
             nullif(btrim(substring(target from ',(.*)$')), '') as cond
    ) tp
    cross join lateral (
      select lower(split_part(tp.name, ' ', 1)) as tg,
             lower(nullif(split_part(tp.name, ' ', 2), '')) as tsp
    ) tn
    where (d.e).is_cross_reference and d.match in ('species', 'genus', 'synonym')
  ),
  followed as (
    select t as e, 'cross_reference'::text as match,
           format('HTA lists %s under %s', (x.xref).taxon, array_to_string((x.xref).see_also, ' and ')) as note
    from targets x
    join public.hta_entries t
      on not t.is_cross_reference and lower(t.genus) = x.tg
    where
      -- close fit for this target
      (x.tsp is not null and lower(t.taxon) like x.tg || ' ' || x.tsp || '%')
      or (x.cond is not null and lower(coalesce(t.hta_condition, '')) like '%' || lower(x.cond) || '%')
      or (x.tsp is null and x.cond is null and lower(t.taxon) = x.tg)
      -- otherwise the whole genus
      or not exists (
        select 1 from public.hta_entries u
        where not u.is_cross_reference and lower(u.genus) = x.tg
          and ((x.tsp is not null and lower(u.taxon) like x.tg || ' ' || x.tsp || '%')
               or (x.cond is not null and lower(coalesce(u.hta_condition, '')) like '%' || lower(x.cond) || '%')
               or (x.tsp is null and x.cond is null and lower(u.taxon) = x.tg)))
  ),
  candidates as (
    select d.e, d.match,
      case d.match
        when 'species' then 'Names this species'
        when 'genus' then 'The whole genus is listed'
        when 'synonym' then 'Matched a synonym: ' || array_to_string((d.e).synonyms, ', ')
        when 'other_species' then 'A different species in this genus: probably not this plant'
        when 'listed_species' then 'Only this species of the genus is listed'
        when 'common_name' then 'Matched a common name only: check the botanical name'
      end as note
    from direct d
    where d.match is not null and not (d.e).is_cross_reference
    union all
    select e, match, note from followed
  )
  select distinct on ((c.e).hta_ref) c.e, c.match, c.note
  from candidates c
  order by (c.e).hta_ref,
           array_position(array['species','cross_reference','genus','synonym',
                                 'listed_species','other_species','common_name'], c.match)
$$;

revoke execute on function public.search_hta_entries(text) from public, anon;
grant execute on function public.search_hta_entries(text) to authenticated;


-- ─── 3. Apply the chosen row ────────────────────────────────────────────────
-- p_hta_ref: the row Jo picked, or null for "Not on HTA list".
-- Writes to the species record (a variety's parent), never to a variety.
-- harmful_parts isn't in the HTA list, so it's left as it is (typed by hand);
-- "Not on HTA list" clears it along with the other harm fields.
-- Returns {"profile_id", "safety_status"}.
create function public.set_profile_safety(p_profile uuid, p_hta_ref text)
returns jsonb
language plpgsql
volatile
set search_path = ''
as $$
declare
  target_id uuid;
  e         public.hta_entries;
  edition   text;
  who       text;
begin
  if not public.is_catalogue_admin() then
    raise exception 'Only an admin can set safety';
  end if;

  select coalesce(parent_id, id) into target_id from public.plant_profiles where id = p_profile;
  if target_id is null then
    raise exception 'No plant profile with id %', p_profile;
  end if;

  who := coalesce(
    nullif(auth.jwt() -> 'user_metadata' ->> 'full_name', ''),
    nullif(concat_ws(' ', auth.jwt() -> 'user_metadata' ->> 'forename',
                          auth.jwt() -> 'user_metadata' ->> 'surname'), ''),
    auth.jwt() ->> 'email');

  if p_hta_ref is null then
    select max(hta_edition) into edition from public.hta_entries;
    if edition is null then
      raise exception 'The HTA list has not been loaded';
    end if;
    update public.plant_profiles set
      safety_status = 'not_on_hta_list',
      harmful_to = null, pets_affected = null, harmful_if_eaten = null,
      skin_irritant = null, harmful_parts = null, hta_condition = null,
      hta_ref = null, hta_edition = edition,
      safety_verified_by = auth.uid(), safety_verified_by_name = who,
      safety_verified_at = now()
    where id = target_id;
    return jsonb_build_object('profile_id', target_id, 'safety_status', 'not_on_hta_list');
  end if;

  select * into e from public.hta_entries where hta_ref = p_hta_ref;
  if not found then
    raise exception 'No HTA entry %', p_hta_ref;
  end if;
  if e.is_cross_reference then
    raise exception 'HTA entry % is a cross-reference; pick the entry it points to', p_hta_ref;
  end if;

  update public.plant_profiles set
    safety_status = e.safety_status,
    harmful_to = e.harmful_to,
    pets_affected = e.pets_affected,
    harmful_if_eaten = e.harmful_if_eaten,
    skin_irritant = e.skin_irritant,
    hta_condition = e.hta_condition,
    hta_ref = e.hta_ref,
    hta_edition = e.hta_edition,
    safety_verified_by = auth.uid(), safety_verified_by_name = who,
    safety_verified_at = now()
  where id = target_id;

  return jsonb_build_object('profile_id', target_id, 'safety_status', e.safety_status);
end;
$$;

revoke execute on function public.set_profile_safety(uuid, text) from public, anon;
grant execute on function public.set_profile_safety(uuid, text) to authenticated;

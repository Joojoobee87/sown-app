-- ════════════════════════════════════════════════════════════════════════════
-- Retire the pre-catalogue tables
--
-- The app and edge functions now use plant_profiles, garden_plants, zones and
-- garden_task_completions. This keeps a copy of the old data in a private
-- "archive" schema (not reachable through the app's API), then drops the old
-- tables.
--
-- No CASCADE: if anything still depends on an old table, the drop stops with
-- an error instead of silently removing it. Run inside begin; … commit; so an
-- error undoes everything.
--
-- To delete the archive later, once you're sure you don't need it:
--   drop schema archive cascade;
-- ════════════════════════════════════════════════════════════════════════════

create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;

-- 1. Copies of the old data (plain copies: no policies or links)
create table archive.plants_20261105                as table public.plants;
create table archive.user_plants_20261105           as table public.user_plants;
create table archive.garden_zones_20261105          as table public.garden_zones;
create table archive.user_task_completions_20261105 as table public.user_task_completions;

-- 2. Drop the originals, children before parents
--    (user_task_completions → user_plants → plants)
drop table public.user_task_completions;
drop table public.user_plants;
drop table public.garden_zones;
drop table public.plants;

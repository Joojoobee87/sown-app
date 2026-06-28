-- Add detailed care columns and structured care calendar to plants table
alter table plants
  add column if not exists height           text,
  add column if not exists spread           text,
  add column if not exists growth_rate      text,
  add column if not exists frost_hardiness  text,
  add column if not exists watering         text,
  add column if not exists pruning_when     text,
  add column if not exists pruning_how      text,
  add column if not exists winter_care      text,
  add column if not exists wildlife_value   text,
  add column if not exists toxic            text,
  add column if not exists notes_for_buyer  text,
  add column if not exists care_calendar    jsonb;

-- care_calendar stores an array of monthly tasks, e.g.:
-- [{"month":3,"task":"Prune","detail":"Cut back hard to 10cm"},
--  {"month":11,"task":"Mulch","detail":"Apply thick mulch around the base"}]
-- month is 1–12 (January = 1)

-- Add rich attribute columns to garden_zones so zones can inform
-- plant suitability matching in future app functionality.

ALTER TABLE garden_zones
  ADD COLUMN IF NOT EXISTS aspect        text,        -- N, NE, E, SE, S, SW, W, NW
  ADD COLUMN IF NOT EXISTS sun_exposure  text,        -- Full sun | Partial shade | Full shade
  ADD COLUMN IF NOT EXISTS soil_type     text,        -- Clay | Sandy | Loam | Chalk | Peat | Silty
  ADD COLUMN IF NOT EXISTS soil_drainage text,        -- Well drained | Moist but well drained | Poorly drained
  ADD COLUMN IF NOT EXISTS shelter       text,        -- Exposed | Sheltered | Coastal
  ADD COLUMN IF NOT EXISTS frost_pocket  boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes         text;

-- Run this in the Supabase dashboard SQL editor:
-- https://supabase.com/dashboard/project/mrxdejyqoohstpradhkc/sql

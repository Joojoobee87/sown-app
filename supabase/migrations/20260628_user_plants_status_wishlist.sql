-- Add 'want to grow' as a valid status for wishlist plants.
-- The original check constraint only covered growing / dormant / lost.

-- Drop any existing check constraint on the status column
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'user_plants'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE 'ALTER TABLE user_plants DROP CONSTRAINT ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Re-add with 'want to grow' included
ALTER TABLE user_plants
  ADD CONSTRAINT user_plants_status_check
  CHECK (status IN ('growing', 'dormant', 'lost', 'want to grow'));

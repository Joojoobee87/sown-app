-- Add unique constraint on latin_name so upsert onConflict works correctly.
-- If this fails, there are duplicate latin_name values in the plants table
-- (from earlier inserts before this constraint existed). Run the cleanup
-- query below first to remove duplicates, keeping the most recently created row.

-- Cleanup duplicates (run this first if the ALTER fails):
-- DELETE FROM plants p1 USING plants p2
-- WHERE p1.latin_name = p2.latin_name AND p1.created_at < p2.created_at;

alter table plants add constraint plants_latin_name_unique unique (latin_name);

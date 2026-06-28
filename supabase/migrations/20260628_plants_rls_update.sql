-- Allow authenticated users to update existing plant rows.
-- INSERT was already permitted; UPDATE was blocked, causing upserts
-- to fail when a plant with the same latin_name already existed.

CREATE POLICY "Authenticated users can update plants"
  ON plants FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

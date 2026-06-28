-- Track which monthly care tasks the user has completed, per year.
-- Completions are year-scoped so tasks automatically reappear each January.

CREATE TABLE IF NOT EXISTS user_task_completions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid REFERENCES auth.users NOT NULL,
  user_plant_id  uuid REFERENCES user_plants(id) ON DELETE CASCADE NOT NULL,
  month          int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           int  NOT NULL,
  task           text NOT NULL,
  completed_at   timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_plant_id, month, year, task)
);

ALTER TABLE user_task_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own task completions"
  ON user_task_completions FOR ALL
  TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

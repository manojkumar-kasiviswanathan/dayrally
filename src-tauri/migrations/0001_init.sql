CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'done')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_target_date ON tasks(target_date);

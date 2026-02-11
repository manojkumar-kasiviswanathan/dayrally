PRAGMA foreign_keys=off;

ALTER TABLE tasks RENAME TO tasks_old;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  notes TEXT,
  target_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done', 'skipped')) DEFAULT 'todo',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  deadline_at TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_type TEXT,
  recurrence_interval INTEGER DEFAULT 1,
  recurrence_weekdays TEXT,
  timer_enabled INTEGER NOT NULL DEFAULT 0,
  timer_minutes INTEGER,
  timer_state TEXT,
  timer_ends_at TEXT,
  rolled_over INTEGER NOT NULL DEFAULT 0,
  rolled_from_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO tasks (
  id,
  title,
  notes,
  target_date,
  status,
  progress_percent,
  deadline_at,
  is_recurring,
  recurrence_type,
  recurrence_interval,
  recurrence_weekdays,
  timer_enabled,
  timer_minutes,
  timer_state,
  timer_ends_at,
  rolled_over,
  rolled_from_date,
  created_at,
  updated_at
)
SELECT
  id,
  title,
  description,
  target_date,
  status,
  progress_percent,
  deadline_at,
  is_recurring,
  NULL,
  1,
  NULL,
  0,
  NULL,
  NULL,
  NULL,
  rolled_over,
  rolled_from_date,
  created_at,
  updated_at
FROM tasks_old;

DROP TABLE tasks_old;

CREATE INDEX idx_tasks_target_date ON tasks(target_date);
CREATE INDEX idx_tasks_status ON tasks(status);

PRAGMA foreign_keys=on;

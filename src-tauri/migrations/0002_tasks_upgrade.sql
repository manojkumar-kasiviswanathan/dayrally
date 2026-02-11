PRAGMA foreign_keys=off;

ALTER TABLE tasks RENAME TO tasks_old;

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  target_date TEXT NOT NULL,
  deadline_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('todo', 'in_progress', 'done', 'skipped')),
  progress_percent INTEGER NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurrence_rule TEXT,
  rolled_over INTEGER NOT NULL DEFAULT 0,
  rolled_from_date TEXT,
  parent_task_id TEXT,
  occurrence_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(parent_task_id) REFERENCES tasks(id)
);

INSERT INTO tasks (id, title, description, target_date, deadline_at, status, progress_percent, is_recurring, recurrence_rule, rolled_over, rolled_from_date, parent_task_id, occurrence_date, created_at, updated_at)
SELECT id, title, NULL, target_date, NULL, status, 0, 0, NULL, 0, NULL, NULL, target_date, created_at, updated_at
FROM tasks_old;

DROP TABLE tasks_old;

CREATE INDEX idx_tasks_target_date ON tasks(target_date);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX idx_tasks_occurrence ON tasks(occurrence_date);

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE task_tags (
  task_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_tags_task ON task_tags(task_id);
CREATE INDEX idx_task_tags_tag ON task_tags(tag_id);

PRAGMA foreign_keys=on;

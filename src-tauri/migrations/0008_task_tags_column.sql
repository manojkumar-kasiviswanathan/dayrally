ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_tags (
  task_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (task_id, tag_id),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);

UPDATE tasks
SET tags = COALESCE((
  SELECT GROUP_CONCAT(name, ',')
  FROM (
    SELECT t.name AS name
    FROM task_tags tt
    JOIN tags t ON t.id = tt.tag_id
    WHERE tt.task_id = tasks.id
    ORDER BY t.name
  )
), '');

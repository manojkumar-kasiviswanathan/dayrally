CREATE TABLE IF NOT EXISTS note_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE notes ADD COLUMN folder_id TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);

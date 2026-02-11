CREATE TABLE IF NOT EXISTS checkin_people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK(relationship IN ('manager', 'report', 'peer')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL,
  checkin_date TEXT NOT NULL,
  discussion TEXT NULL,
  notes TEXT NULL,
  action_items TEXT NULL,
  next_checkin_date TEXT NULL,
  reminder_enabled INTEGER NOT NULL DEFAULT 0,
  reminder_time TEXT NULL,
  reminder_state TEXT NULL CHECK(reminder_state IN ('idle', 'scheduled', 'sent')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(person_id) REFERENCES checkin_people(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_checkins_person_date
ON checkins(person_id, checkin_date DESC);

CREATE INDEX IF NOT EXISTS idx_checkins_reminder_due
ON checkins(reminder_enabled, next_checkin_date, reminder_time);

use chrono::Utc;
use rusqlite::{params, Connection};
use std::{fs, path::Path};

const MIGRATIONS: &[(i32, &str)] = &[
    (1, include_str!("../migrations/0001_init.sql")),
    (2, include_str!("../migrations/0002_tasks_upgrade.sql")),
    (3, include_str!("../migrations/0003_tasks_schema.sql")),
    (4, include_str!("../migrations/0004_task_sort_order.sql")),
    (5, include_str!("../migrations/0005_notes_module.sql")),
    (6, include_str!("../migrations/0006_note_folders.sql")),
    (7, include_str!("../migrations/0007_checkins.sql")),
    (8, include_str!("../migrations/0008_task_tags_column.sql")),
];

pub fn ensure_workspace(path: &Path) -> Result<(), String> {
    if !path.exists() {
        fs::create_dir_all(path).map_err(|err| err.to_string())?;
    }
    let attachments = path.join("attachments");
    if !attachments.exists() {
        fs::create_dir_all(&attachments).map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn open_db(path: &Path) -> Result<Connection, String> {
    ensure_workspace(path)?;
    let db_path = path.join("dayrally.sqlite");
    let conn = Connection::open(db_path).map_err(|err| err.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|err| err.to_string())?;
    run_migrations(&conn)?;
    ensure_task_tags_schema(&conn)?;
    Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn
    .execute(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
      [],
    )
    .map_err(|err| err.to_string())?;

    let mut stmt = conn
        .prepare("SELECT version FROM schema_migrations")
        .map_err(|err| err.to_string())?;
    let applied: Vec<i32> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();

    for (version, sql) in MIGRATIONS {
        if applied.contains(version) {
            continue;
        }

        // Recovery path for partial migration on version 8:
        // older builds could add tasks.tags but fail before recording schema_migrations row.
        if *version == 8 && tasks_has_tags_column(conn)? {
            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
                params![version, Utc::now().to_rfc3339()],
            )
            .map_err(|err| err.to_string())?;
            continue;
        }

        conn.execute_batch(sql).map_err(|err| err.to_string())?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            params![version, Utc::now().to_rfc3339()],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn tasks_has_tags_column(conn: &Connection) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("PRAGMA table_info(tasks)")
        .map_err(|err| err.to_string())?;
    let columns: Vec<String> = stmt
        .query_map([], |row| row.get(1))
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(columns.iter().any(|name| name == "tags"))
}

fn ensure_task_tags_schema(conn: &Connection) -> Result<(), String> {
    if !tasks_has_tags_column(conn)? {
        conn.execute(
            "ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT ''",
            [],
        )
        .map_err(|err| err.to_string())?;
    }

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS tags (
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
        CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);",
    )
    .map_err(|err| err.to_string())?;

    if task_tags_references_old_tasks(conn)? {
        rebuild_task_tags_table(conn)?;
    }

    Ok(())
}

fn task_tags_references_old_tasks(conn: &Connection) -> Result<bool, String> {
    let mut stmt = conn
        .prepare("PRAGMA foreign_key_list(task_tags)")
        .map_err(|err| err.to_string())?;
    let referenced_tables: Vec<String> = stmt
        .query_map([], |row| row.get(2))
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(referenced_tables.iter().any(|table| table == "tasks_old"))
}

fn rebuild_task_tags_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch("PRAGMA foreign_keys = OFF;")
        .map_err(|err| err.to_string())?;

    let rebuild = conn.execute_batch(
        "ALTER TABLE task_tags RENAME TO task_tags_old;
         CREATE TABLE task_tags (
           task_id TEXT NOT NULL,
           tag_id TEXT NOT NULL,
           PRIMARY KEY (task_id, tag_id),
           FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
           FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
         );
         INSERT INTO task_tags (task_id, tag_id)
         SELECT old.task_id, old.tag_id
         FROM task_tags_old old
         INNER JOIN tasks t ON t.id = old.task_id
         INNER JOIN tags g ON g.id = old.tag_id;
         DROP TABLE task_tags_old;
         CREATE INDEX IF NOT EXISTS idx_task_tags_task ON task_tags(task_id);
         CREATE INDEX IF NOT EXISTS idx_task_tags_tag ON task_tags(tag_id);",
    );

    let _ = conn.execute_batch("PRAGMA foreign_keys = ON;");
    rebuild.map_err(|err| err.to_string())
}

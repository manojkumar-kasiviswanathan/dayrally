use chrono::{DateTime, Datelike, Duration, Local, NaiveDate, NaiveTime, Utc, Weekday};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub notes: Option<String>,
    pub tags: Vec<String>,
    pub target_date: String,
    pub status: String,
    pub progress_percent: i32,
    pub deadline_at: Option<String>,
    pub is_recurring: bool,
    pub recurrence_type: Option<String>,
    pub recurrence_interval: Option<i32>,
    pub recurrence_weekdays: Option<String>,
    pub timer_enabled: bool,
    pub timer_minutes: Option<i32>,
    pub timer_state: Option<String>,
    pub timer_ends_at: Option<String>,
    pub rolled_over: bool,
    pub rolled_from_date: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskInput {
    pub title: String,
    pub notes: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub target_date: String,
    pub status: String,
    pub progress_percent: i32,
    pub deadline_at: Option<String>,
    pub is_recurring: bool,
    pub recurrence_type: Option<String>,
    pub recurrence_interval: Option<i32>,
    pub recurrence_weekdays: Option<String>,
    pub timer_enabled: bool,
    pub timer_minutes: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskOverview {
    pub today: Vec<Task>,
    pub rolled_over: Vec<Task>,
    pub upcoming: Vec<Task>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub body_markdown: String,
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteInput {
    pub title: String,
    pub body_markdown: String,
    pub tags: Vec<String>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteAttachment {
    pub id: String,
    pub note_id: String,
    pub filename: String,
    pub path_relative: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NoteFolder {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckinPerson {
    pub id: String,
    pub name: String,
    pub relationship: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckinPersonInput {
    pub name: String,
    pub relationship: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Checkin {
    pub id: String,
    pub person_id: String,
    pub checkin_date: String,
    pub discussion: Option<String>,
    pub notes: Option<String>,
    pub action_items: Option<String>,
    pub next_checkin_date: Option<String>,
    pub reminder_enabled: bool,
    pub reminder_time: Option<String>,
    pub reminder_state: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckinInput {
    pub person_id: String,
    pub checkin_date: String,
    pub discussion: Option<String>,
    pub notes: Option<String>,
    pub action_items: Option<String>,
    pub next_checkin_date: Option<String>,
    pub reminder_enabled: bool,
    pub reminder_time: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckinReminder {
    pub checkin_id: String,
    pub person_name: String,
    pub next_checkin_date: String,
    pub reminder_time: String,
}

fn today() -> String {
    let now = Local::now();
    format!("{:04}-{:02}-{:02}", now.year(), now.month(), now.day())
}

fn parse_date(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|err| err.to_string())
}

fn parse_time(value: &str) -> Result<NaiveTime, String> {
    NaiveTime::parse_from_str(value, "%H:%M").map_err(|err| err.to_string())
}

fn normalize_tags(tags: &[String]) -> String {
    tags.iter()
        .map(|tag| tag.trim())
        .filter(|tag| !tag.is_empty())
        .collect::<Vec<_>>()
        .join(",")
}

fn parse_tags(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(|tag| tag.trim())
        .filter(|tag| !tag.is_empty())
        .map(|tag| tag.to_string())
        .collect()
}

fn normalize_task_tags(tags: &[String]) -> Vec<String> {
    let mut seen = HashSet::<String>::new();
    tags.iter()
        .map(|tag| tag.trim())
        .filter(|tag| !tag.is_empty())
        .filter_map(|tag| {
            let key = tag.to_lowercase();
            if seen.insert(key) {
                Some(tag.to_string())
            } else {
                None
            }
        })
        .collect()
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn normalize_relationship(value: &str) -> Result<String, String> {
    match value.trim() {
        "manager" | "report" | "peer" => Ok(value.trim().to_string()),
        _ => Err("Relationship must be one of: manager, report, peer".to_string()),
    }
}

fn normalize_reminder_state(
    reminder_enabled: bool,
    next_checkin_date: Option<&str>,
    reminder_time: Option<&str>,
) -> Option<String> {
    if !reminder_enabled {
        return Some("idle".to_string());
    }
    if next_checkin_date.is_some() && reminder_time.is_some() {
        Some("scheduled".to_string())
    } else {
        Some("idle".to_string())
    }
}

fn map_task_row(row: &rusqlite::Row<'_>) -> Result<Task, rusqlite::Error> {
    let tags_csv: String = row.get("tags")?;
    Ok(Task {
        id: row.get("id")?,
        title: row.get("title")?,
        notes: row.get("notes")?,
        tags: parse_tags(&tags_csv),
        target_date: row.get("target_date")?,
        status: row.get("status")?,
        progress_percent: row.get("progress_percent")?,
        deadline_at: row.get("deadline_at")?,
        is_recurring: row.get::<_, i32>("is_recurring")? == 1,
        recurrence_type: row.get("recurrence_type")?,
        recurrence_interval: row.get("recurrence_interval")?,
        recurrence_weekdays: row.get("recurrence_weekdays")?,
        timer_enabled: row.get::<_, i32>("timer_enabled")? == 1,
        timer_minutes: row.get("timer_minutes")?,
        timer_state: row.get("timer_state")?,
        timer_ends_at: row.get("timer_ends_at")?,
        rolled_over: row.get::<_, i32>("rolled_over")? == 1,
        rolled_from_date: row.get("rolled_from_date")?,
        sort_order: row.get("sort_order")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_note_row(row: &rusqlite::Row<'_>) -> Result<Note, rusqlite::Error> {
    let tags_csv: String = row.get("tags")?;
    Ok(Note {
        id: row.get("id")?,
        title: row.get("title")?,
        body_markdown: row.get("body_markdown")?,
        tags: parse_tags(&tags_csv),
        folder_id: row.get("folder_id")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_note_attachment_row(row: &rusqlite::Row<'_>) -> Result<NoteAttachment, rusqlite::Error> {
    Ok(NoteAttachment {
        id: row.get("id")?,
        note_id: row.get("note_id")?,
        filename: row.get("filename")?,
        path_relative: row.get("path_relative")?,
        created_at: row.get("created_at")?,
    })
}

fn map_note_folder_row(row: &rusqlite::Row<'_>) -> Result<NoteFolder, rusqlite::Error> {
    Ok(NoteFolder {
        id: row.get("id")?,
        name: row.get("name")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_checkin_person_row(row: &rusqlite::Row<'_>) -> Result<CheckinPerson, rusqlite::Error> {
    Ok(CheckinPerson {
        id: row.get("id")?,
        name: row.get("name")?,
        relationship: row.get("relationship")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn map_checkin_row(row: &rusqlite::Row<'_>) -> Result<Checkin, rusqlite::Error> {
    Ok(Checkin {
        id: row.get("id")?,
        person_id: row.get("person_id")?,
        checkin_date: row.get("checkin_date")?,
        discussion: row.get("discussion")?,
        notes: row.get("notes")?,
        action_items: row.get("action_items")?,
        next_checkin_date: row.get("next_checkin_date")?,
        reminder_enabled: row.get::<_, i32>("reminder_enabled")? == 1,
        reminder_time: row.get("reminder_time")?,
        reminder_state: row.get("reminder_state")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn next_sort_order(conn: &Connection, target_date: &str, rolled_over: i32) -> Result<i64, String> {
    conn
    .query_row(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM tasks WHERE target_date = ?1 AND rolled_over = ?2",
      params![target_date, rolled_over],
      |row| row.get(0),
    )
    .map_err(|err| err.to_string())
}

fn list_by_query(conn: &Connection, sql: &str, value: &str) -> Result<Vec<Task>, String> {
    let mut stmt = conn.prepare(sql).map_err(|err| err.to_string())?;
    let tasks = stmt
        .query_map(params![value], map_task_row)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(tasks)
}

fn sync_task_tags(conn: &Connection, task_id: &str, tags: &[String]) -> Result<(), String> {
    conn.execute("DELETE FROM task_tags WHERE task_id = ?1", params![task_id])
        .map_err(|err| err.to_string())?;

    if tags.is_empty() {
        return Ok(());
    }

    let now = Utc::now().to_rfc3339();
    for tag in tags {
        let existing_tag_id: Option<String> = conn
            .query_row(
                "SELECT id FROM tags WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                params![tag],
                |row| row.get(0),
            )
            .optional()
            .map_err(|err| err.to_string())?;

        let tag_id = if let Some(id) = existing_tag_id {
            id
        } else {
            let id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO tags (id, name, created_at) VALUES (?1, ?2, ?3)",
                params![id, tag, now],
            )
            .map_err(|err| err.to_string())?;
            id
        };

        conn.execute(
            "INSERT OR IGNORE INTO task_tags (task_id, tag_id) VALUES (?1, ?2)",
            params![task_id, tag_id],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

fn normalize_input(
    input: &TaskInput,
) -> (
    i32,
    Option<String>,
    i32,
    Option<String>,
    i32,
    Option<i32>,
    Option<String>,
) {
    let recurring = if input.is_recurring { 1 } else { 0 };
    let recurrence_type = if input.is_recurring {
        input.recurrence_type.clone()
    } else {
        None
    };
    let recurrence_interval = if input.is_recurring {
        input.recurrence_interval.unwrap_or(1).max(1)
    } else {
        1
    };
    let recurrence_weekdays = if input.is_recurring && recurrence_type.as_deref() == Some("weekly")
    {
        input.recurrence_weekdays.clone()
    } else {
        None
    };

    let timer_enabled = if input.timer_enabled { 1 } else { 0 };
    let timer_minutes = if input.timer_enabled {
        Some(input.timer_minutes.unwrap_or(25).max(1))
    } else {
        None
    };
    let timer_state = if input.timer_enabled {
        Some("idle".to_string())
    } else {
        None
    };

    (
        recurring,
        recurrence_type,
        recurrence_interval,
        recurrence_weekdays,
        timer_enabled,
        timer_minutes,
        timer_state,
    )
}

fn parse_weekdays_csv(value: Option<&str>) -> Vec<Weekday> {
    let mut out = Vec::new();
    if let Some(csv) = value {
        for part in csv.split(',') {
            let item = part.trim();
            let day = match item {
                "Mon" => Some(Weekday::Mon),
                "Tue" => Some(Weekday::Tue),
                "Wed" => Some(Weekday::Wed),
                "Thu" => Some(Weekday::Thu),
                "Fri" => Some(Weekday::Fri),
                "Sat" => Some(Weekday::Sat),
                "Sun" => Some(Weekday::Sun),
                _ => None,
            };
            if let Some(day) = day {
                out.push(day);
            }
        }
    }
    out
}

fn add_months_keep_day(base: NaiveDate, interval: i32) -> NaiveDate {
    let mut year = base.year();
    let mut month = base.month() as i32 + interval;
    while month > 12 {
        month -= 12;
        year += 1;
    }
    while month <= 0 {
        month += 12;
        year -= 1;
    }
    let month_u = month as u32;
    let day = base.day();
    if let Some(date) = NaiveDate::from_ymd_opt(year, month_u, day) {
        return date;
    }
    let mut fallback_day = day;
    while fallback_day > 1 {
        fallback_day -= 1;
        if let Some(date) = NaiveDate::from_ymd_opt(year, month_u, fallback_day) {
            return date;
        }
    }
    base
}

fn next_occurrence_date(task: &Task, from: NaiveDate) -> NaiveDate {
    let interval = task.recurrence_interval.unwrap_or(1).max(1) as i64;
    match task.recurrence_type.as_deref() {
        Some("daily") => from + Duration::days(interval),
        Some("weekly") => {
            let weekdays = parse_weekdays_csv(task.recurrence_weekdays.as_deref());
            if weekdays.is_empty() {
                return from + Duration::days(interval * 7);
            }

            let mut cursor = from + Duration::days(1);
            let origin_week_start =
                from - Duration::days(from.weekday().num_days_from_monday() as i64);
            for _ in 0..500 {
                let cursor_week_start =
                    cursor - Duration::days(cursor.weekday().num_days_from_monday() as i64);
                let week_diff = (cursor_week_start - origin_week_start).num_days() / 7;
                if week_diff % interval == 0 && weekdays.contains(&cursor.weekday()) {
                    return cursor;
                }
                cursor += Duration::days(1);
            }
            from + Duration::days(interval * 7)
        }
        Some("monthly") => add_months_keep_day(from, interval as i32),
        _ => from,
    }
}

fn has_recurring_occurrence(conn: &Connection, task: &Task, date: &str) -> Result<bool, String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM tasks WHERE title = ?1 AND target_date = ?2 AND is_recurring = 1
       AND COALESCE(recurrence_type, '') = COALESCE(?3, '')
       AND COALESCE(recurrence_interval, 1) = COALESCE(?4, 1)
       AND COALESCE(recurrence_weekdays, '') = COALESCE(?5, '')
       LIMIT 1",
            params![
                task.title,
                date,
                task.recurrence_type,
                task.recurrence_interval,
                task.recurrence_weekdays
            ],
            |row| row.get(0),
        )
        .optional()
        .map_err(|err| err.to_string())?;
    Ok(existing.is_some())
}

fn insert_next_occurrence(conn: &Connection, source: &Task, next_date: &str) -> Result<(), String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let sort_order = next_sort_order(conn, next_date, 0)?;
    let normalized_tags = normalize_task_tags(&source.tags);
    let tags_csv = normalize_tags(&normalized_tags);
    let timer_state = if source.timer_enabled {
        Some("idle".to_string())
    } else {
        None
    };
    conn
    .execute(
      "INSERT INTO tasks (id, title, notes, target_date, status, progress_percent, deadline_at, is_recurring,
       recurrence_type, recurrence_interval, recurrence_weekdays, timer_enabled, timer_minutes,
       timer_state, timer_ends_at, rolled_over, rolled_from_date, tags, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, 'todo', 0, ?5, 1, ?6, ?7, ?8, ?9, ?10, ?11, NULL, 0, NULL, ?12, ?13, ?14, ?15)",
      params![
        id,
        source.title,
        source.notes,
        next_date,
        source.deadline_at,
        source.recurrence_type,
        source.recurrence_interval.unwrap_or(1),
        source.recurrence_weekdays,
        if source.timer_enabled { 1 } else { 0 },
        source.timer_minutes,
        timer_state,
        tags_csv,
        sort_order,
        now,
        now
      ],
    )
    .map_err(|err| err.to_string())?;
    sync_task_tags(conn, &id, &normalized_tags)?;
    Ok(())
}

pub fn list_today(conn: &Connection) -> Result<Vec<Task>, String> {
    let today_value = today();
    list_by_query(
        conn,
        "SELECT * FROM tasks WHERE target_date = ?1 ORDER BY sort_order ASC, created_at ASC",
        &today_value,
    )
}

pub fn list_overview(conn: &Connection) -> Result<TaskOverview, String> {
    let today_value = today();
    let today_tasks = list_by_query(
    conn,
    "SELECT * FROM tasks WHERE target_date = ?1 AND rolled_over = 0 ORDER BY sort_order ASC, created_at ASC",
    &today_value,
  )?;
    let rolled_over = list_by_query(
    conn,
    "SELECT * FROM tasks WHERE target_date = ?1 AND rolled_over = 1 ORDER BY sort_order ASC, created_at ASC",
    &today_value,
  )?;

    let mut stmt = conn
    .prepare(
      "SELECT * FROM tasks WHERE target_date > ?1 ORDER BY target_date ASC, sort_order ASC, created_at ASC",
    )
    .map_err(|err| err.to_string())?;
    let upcoming = stmt
        .query_map(params![today_value], map_task_row)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();

    Ok(TaskOverview {
        today: today_tasks,
        rolled_over,
        upcoming,
    })
}

pub fn list_tags(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare("SELECT name FROM tags ORDER BY name")
        .map_err(|err| err.to_string())?;
    let tags = stmt
        .query_map([], |row| row.get(0))
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(tags)
}

pub fn create_task(conn: &Connection, input: TaskInput) -> Result<Task, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let sort_order = next_sort_order(conn, &input.target_date, 0)?;
    let normalized_tags = normalize_task_tags(&input.tags);
    let tags_csv = normalize_tags(&normalized_tags);
    let (
        is_recurring,
        recurrence_type,
        recurrence_interval,
        recurrence_weekdays,
        timer_enabled,
        timer_minutes,
        timer_state,
    ) = normalize_input(&input);

    conn
    .execute(
      "INSERT INTO tasks (id, title, notes, target_date, status, progress_percent, deadline_at, is_recurring,
       recurrence_type, recurrence_interval, recurrence_weekdays, timer_enabled, timer_minutes,
       timer_state, timer_ends_at, rolled_over, rolled_from_date, tags, sort_order, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL, 0, NULL, ?15, ?16, ?17, ?18)",
      params![
        id,
        input.title,
        input.notes,
        input.target_date,
        input.status,
        input.progress_percent.clamp(0, 100),
        input.deadline_at,
        is_recurring,
        recurrence_type,
        recurrence_interval,
        recurrence_weekdays,
        timer_enabled,
        timer_minutes,
        timer_state,
        tags_csv,
        sort_order,
        now,
        now
      ],
    )
    .map_err(|err| err.to_string())?;
    sync_task_tags(conn, &id, &normalized_tags)?;
    get_task(conn, &id)
}

pub fn update_task(conn: &Connection, id: &str, input: TaskInput) -> Result<Task, String> {
    let now = Utc::now().to_rfc3339();
    let existing = get_task(conn, id)?;
    let sort_order = if existing.target_date == input.target_date && !existing.rolled_over {
        existing.sort_order
    } else {
        next_sort_order(conn, &input.target_date, 0)?
    };
    let normalized_tags = normalize_task_tags(&input.tags);
    let tags_csv = normalize_tags(&normalized_tags);
    let (
        is_recurring,
        recurrence_type,
        recurrence_interval,
        recurrence_weekdays,
        timer_enabled,
        timer_minutes,
        timer_state,
    ) = normalize_input(&input);

    conn
    .execute(
      "UPDATE tasks SET title = ?1, notes = ?2, target_date = ?3, status = ?4, progress_percent = ?5,
       deadline_at = ?6, is_recurring = ?7, recurrence_type = ?8, recurrence_interval = ?9,
       recurrence_weekdays = ?10, timer_enabled = ?11, timer_minutes = ?12, timer_state = ?13,
       timer_ends_at = NULL, rolled_over = 0, rolled_from_date = NULL, tags = ?14, sort_order = ?15,
       updated_at = ?16 WHERE id = ?17",
      params![
        input.title,
        input.notes,
        input.target_date,
        input.status,
        input.progress_percent.clamp(0, 100),
        input.deadline_at,
        is_recurring,
        recurrence_type,
        recurrence_interval,
        recurrence_weekdays,
        timer_enabled,
        timer_minutes,
        timer_state,
        tags_csv,
        sort_order,
        now,
        id
      ],
    )
    .map_err(|err| err.to_string())?;
    sync_task_tags(conn, id, &normalized_tags)?;
    get_task(conn, id)
}

pub fn update_status(conn: &Connection, id: &str, status: &str) -> Result<Task, String> {
    let now = Utc::now().to_rfc3339();
    let task = get_task(conn, id)?;
    if status == "done" {
        let bucket = if task.rolled_over { 1 } else { 0 };
        let new_sort_order = next_sort_order(conn, &task.target_date, bucket)?;
        conn.execute(
            "UPDATE tasks SET status = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, new_sort_order, now, id],
        )
        .map_err(|err| err.to_string())?;
    } else {
        conn.execute(
            "UPDATE tasks SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status, now, id],
        )
        .map_err(|err| err.to_string())?;
    }
    get_task(conn, id)
}

pub fn set_status(conn: &Connection, id: &str, status: &str) -> Result<Task, String> {
    update_status(conn, id, status)
}

pub fn mark_done_and_generate_next(conn: &Connection, id: &str) -> Result<Task, String> {
    let task = update_status(conn, id, "done")?;
    if task.is_recurring {
        let base = parse_date(&task.target_date)?;
        let next = next_occurrence_date(&task, base);
        let next_str = next.format("%Y-%m-%d").to_string();
        if !has_recurring_occurrence(conn, &task, &next_str)? {
            insert_next_occurrence(conn, &task, &next_str)?;
        }
    }
    get_task(conn, id)
}

pub fn get_task(conn: &Connection, id: &str) -> Result<Task, String> {
    let mut stmt = conn
        .prepare("SELECT * FROM tasks WHERE id = ?1")
        .map_err(|err| err.to_string())?;
    let task = stmt
        .query_row(params![id], map_task_row)
        .map_err(|err| err.to_string())?;
    Ok(task)
}

pub fn start_timer(conn: &Connection, id: &str, ends_at: &str) -> Result<(), String> {
    conn
    .execute(
      "UPDATE tasks SET timer_state = 'running', timer_ends_at = ?1, updated_at = ?2 WHERE id = ?3",
      params![ends_at, Utc::now().to_rfc3339(), id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn finish_timer(conn: &Connection, id: &str) -> Result<(), String> {
    conn
    .execute(
      "UPDATE tasks SET timer_state = 'finished', timer_ends_at = NULL, updated_at = ?1 WHERE id = ?2",
      params![Utc::now().to_rfc3339(), id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn stop_timer(conn: &Connection, id: &str) -> Result<(), String> {
    conn
    .execute(
      "UPDATE tasks SET timer_state = 'paused', timer_ends_at = NULL, updated_at = ?1 WHERE id = ?2",
      params![Utc::now().to_rfc3339(), id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn delete_task(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn move_task(conn: &Connection, id: &str, direction: &str) -> Result<(), String> {
    let (target_date, rolled_over, sort_order): (String, i32, i64) = conn
        .query_row(
            "SELECT target_date, rolled_over, sort_order FROM tasks WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|err| err.to_string())?;

    let (comparison, sort_direction) = match direction {
        "up" => ("<", "DESC"),
        "down" => (">", "ASC"),
        _ => return Err("Invalid move direction".to_string()),
    };

    let sql = format!(
        "SELECT id, sort_order FROM tasks
     WHERE target_date = ?1 AND rolled_over = ?2 AND id != ?3 AND sort_order {} ?4
     ORDER BY sort_order {} LIMIT 1",
        comparison, sort_direction
    );

    let neighbor: Option<(String, i64)> = conn
        .query_row(
            &sql,
            params![target_date, rolled_over, id, sort_order],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|err| err.to_string())?;

    if let Some((neighbor_id, neighbor_sort_order)) = neighbor {
        let now = Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE tasks SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![neighbor_sort_order, now, id],
        )
        .map_err(|err| err.to_string())?;
        conn.execute(
            "UPDATE tasks SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![sort_order, now, neighbor_id],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

pub fn reorder_tasks(conn: &Connection, task_ids: &[String]) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    for (index, task_id) in task_ids.iter().enumerate() {
        conn.execute(
            "UPDATE tasks SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
            params![(index as i64) + 1, now, task_id],
        )
        .map_err(|err| err.to_string())?;
    }
    Ok(())
}

pub fn rollover_tasks(conn: &Connection) -> Result<usize, String> {
    let today_value = today();
    let mut stmt = conn
        .prepare("SELECT id, target_date FROM tasks WHERE target_date < ?1 AND status != 'done'")
        .map_err(|err| err.to_string())?;
    let rows: Vec<(String, String)> = stmt
        .query_map(params![today_value.clone()], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();

    let mut count = 0;
    for (id, from_date) in rows {
        let position = next_sort_order(conn, &today_value, 1)?;
        conn
      .execute(
        "UPDATE tasks SET target_date = ?1, rolled_over = 1, rolled_from_date = ?2, sort_order = ?3, updated_at = ?4 WHERE id = ?5",
        params![
          today_value.clone(),
          from_date,
          position,
          Utc::now().to_rfc3339(),
          id
        ],
      )
      .map_err(|err| err.to_string())?;
        count += 1;
    }
    Ok(count)
}

pub fn ensure_recurrences(conn: &Connection) -> Result<(), String> {
    let today_value = today();
    let today_date = parse_date(&today_value)?;

    let mut stmt = conn
        .prepare("SELECT * FROM tasks WHERE is_recurring = 1")
        .map_err(|err| err.to_string())?;

    let recurring_tasks: Vec<Task> = stmt
        .query_map([], map_task_row)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();

    for task in recurring_tasks {
        if task.recurrence_type.is_none() {
            continue;
        }

        if task.status == "done" {
            let base = parse_date(&task.target_date)?;
            let next = next_occurrence_date(&task, base);
            let next_str = next.format("%Y-%m-%d").to_string();
            if !has_recurring_occurrence(conn, &task, &next_str)? {
                insert_next_occurrence(conn, &task, &next_str)?;
            }
            continue;
        }

        let mut date = parse_date(&task.target_date)?;
        if date >= today_date {
            continue;
        }

        while date < today_date {
            date = next_occurrence_date(&task, date);
        }

        let date_str = date.format("%Y-%m-%d").to_string();
        conn.execute(
            "UPDATE tasks SET target_date = ?1, sort_order = ?2, updated_at = ?3 WHERE id = ?4",
            params![
                date_str,
                next_sort_order(conn, &date_str, if task.rolled_over { 1 } else { 0 })?,
                Utc::now().to_rfc3339(),
                task.id
            ],
        )
        .map_err(|err| err.to_string())?;
    }

    Ok(())
}

pub fn list_notes(conn: &Connection) -> Result<Vec<Note>, String> {
    let mut stmt = conn
    .prepare("SELECT id, title, body_markdown, tags, folder_id, created_at, updated_at FROM notes ORDER BY updated_at DESC")
    .map_err(|err| err.to_string())?;
    let notes = stmt
        .query_map([], map_note_row)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(notes)
}

pub fn get_note(conn: &Connection, id: &str) -> Result<Note, String> {
    let mut stmt = conn
    .prepare("SELECT id, title, body_markdown, tags, folder_id, created_at, updated_at FROM notes WHERE id = ?1")
    .map_err(|err| err.to_string())?;
    stmt.query_row(params![id], map_note_row)
        .map_err(|err| err.to_string())
}

pub fn create_note(conn: &Connection, input: NoteInput) -> Result<Note, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let title = if input.title.trim().is_empty() {
        "Untitled note".to_string()
    } else {
        input.title.trim().to_string()
    };
    let tags_csv = normalize_tags(&input.tags);

    conn
    .execute(
      "INSERT INTO notes (id, title, body_markdown, tags, folder_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      params![id, title, input.body_markdown, tags_csv, input.folder_id, now, now],
    )
    .map_err(|err| err.to_string())?;
    get_note(conn, &id)
}

pub fn update_note(conn: &Connection, id: &str, input: NoteInput) -> Result<Note, String> {
    let title = if input.title.trim().is_empty() {
        "Untitled note".to_string()
    } else {
        input.title.trim().to_string()
    };
    let tags_csv = normalize_tags(&input.tags);
    let now = Utc::now().to_rfc3339();

    conn
    .execute(
      "UPDATE notes SET title = ?1, body_markdown = ?2, tags = ?3, folder_id = ?4, updated_at = ?5 WHERE id = ?6",
      params![title, input.body_markdown, tags_csv, input.folder_id, now, id],
    )
    .map_err(|err| err.to_string())?;
    get_note(conn, id)
}

pub fn list_note_folders(conn: &Connection) -> Result<Vec<NoteFolder>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, created_at, updated_at FROM note_folders ORDER BY lower(name) ASC",
        )
        .map_err(|err| err.to_string())?;
    let folders = stmt
        .query_map([], map_note_folder_row)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(folders)
}

pub fn create_note_folder(conn: &Connection, name: &str) -> Result<NoteFolder, String> {
    let cleaned = name.trim();
    if cleaned.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO note_folders (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, cleaned, now, now],
    )
    .map_err(|err| err.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, created_at, updated_at FROM note_folders WHERE id = ?1")
        .map_err(|err| err.to_string())?;
    stmt.query_row(params![id], map_note_folder_row)
        .map_err(|err| err.to_string())
}

pub fn delete_note_folder(conn: &Connection, folder_id: &str) -> Result<(), String> {
    let tx = conn
        .unchecked_transaction()
        .map_err(|err| err.to_string())?;

    tx.execute(
        "UPDATE notes SET folder_id = NULL WHERE folder_id = ?1",
        params![folder_id],
    )
    .map_err(|err| err.to_string())?;

    let deleted = tx
        .execute("DELETE FROM note_folders WHERE id = ?1", params![folder_id])
        .map_err(|err| err.to_string())?;

    if deleted == 0 {
        return Err("Folder not found".to_string());
    }

    tx.commit().map_err(|err| err.to_string())?;
    Ok(())
}

pub fn delete_note(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn list_note_attachments(
    conn: &Connection,
    note_id: &str,
) -> Result<Vec<NoteAttachment>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, note_id, filename, path_relative, created_at
       FROM note_attachments
       WHERE note_id = ?1
       ORDER BY created_at DESC",
        )
        .map_err(|err| err.to_string())?;
    let attachments = stmt
        .query_map(params![note_id], map_note_attachment_row)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(attachments)
}

pub fn create_note_attachment(
    conn: &Connection,
    note_id: &str,
    filename: &str,
    path_relative: &str,
) -> Result<NoteAttachment, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO note_attachments (id, note_id, filename, path_relative, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, note_id, filename, path_relative, now],
    )
    .map_err(|err| err.to_string())?;

    let mut stmt = conn
    .prepare("SELECT id, note_id, filename, path_relative, created_at FROM note_attachments WHERE id = ?1")
    .map_err(|err| err.to_string())?;
    stmt.query_row(params![id], map_note_attachment_row)
        .map_err(|err| err.to_string())
}

pub fn list_checkin_people(conn: &Connection) -> Result<Vec<CheckinPerson>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, relationship, created_at, updated_at
       FROM checkin_people
       ORDER BY lower(name) ASC, created_at ASC",
        )
        .map_err(|err| err.to_string())?;
    let people = stmt
        .query_map([], map_checkin_person_row)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();
    Ok(people)
}

pub fn create_checkin_person(
    conn: &Connection,
    input: CheckinPersonInput,
) -> Result<CheckinPerson, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("Name is required".to_string());
    }
    let relationship = normalize_relationship(&input.relationship)?;
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO checkin_people (id, name, relationship, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, relationship, now, now],
    )
    .map_err(|err| err.to_string())?;

    let mut stmt = conn
    .prepare("SELECT id, name, relationship, created_at, updated_at FROM checkin_people WHERE id = ?1")
    .map_err(|err| err.to_string())?;
    stmt.query_row(params![id], map_checkin_person_row)
        .map_err(|err| err.to_string())
}

pub fn delete_checkin_person(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM checkin_people WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn list_checkins(conn: &Connection, person_id: Option<&str>) -> Result<Vec<Checkin>, String> {
    let sql_all =
        "SELECT id, person_id, checkin_date, discussion, notes, action_items, next_checkin_date,
                    reminder_enabled, reminder_time, reminder_state, created_at, updated_at
                 FROM checkins
                 ORDER BY checkin_date DESC, updated_at DESC";
    let sql_by_person =
        "SELECT id, person_id, checkin_date, discussion, notes, action_items, next_checkin_date,
                          reminder_enabled, reminder_time, reminder_state, created_at, updated_at
                       FROM checkins
                       WHERE person_id = ?1
                       ORDER BY checkin_date DESC, updated_at DESC";

    let mut stmt = conn
        .prepare(if person_id.is_some() {
            sql_by_person
        } else {
            sql_all
        })
        .map_err(|err| err.to_string())?;

    let checkins = if let Some(person_id) = person_id {
        stmt.query_map(params![person_id], map_checkin_row)
            .map_err(|err| err.to_string())?
            .filter_map(Result::ok)
            .collect()
    } else {
        stmt.query_map([], map_checkin_row)
            .map_err(|err| err.to_string())?
            .filter_map(Result::ok)
            .collect()
    };
    Ok(checkins)
}

pub fn get_checkin(conn: &Connection, id: &str) -> Result<Checkin, String> {
    let mut stmt = conn
    .prepare(
      "SELECT id, person_id, checkin_date, discussion, notes, action_items, next_checkin_date,
              reminder_enabled, reminder_time, reminder_state, created_at, updated_at
       FROM checkins
       WHERE id = ?1",
    )
    .map_err(|err| err.to_string())?;
    stmt.query_row(params![id], map_checkin_row)
        .map_err(|err| err.to_string())
}

pub fn create_checkin(conn: &Connection, input: CheckinInput) -> Result<Checkin, String> {
    let person_id = input.person_id.trim().to_string();
    let checkin_date = input.checkin_date.trim().to_string();
    let _ = parse_date(&checkin_date)?;
    if let Some(next_date) = input.next_checkin_date.as_deref() {
        let _ = parse_date(next_date.trim())?;
    }
    if let Some(reminder_time) = input.reminder_time.as_deref() {
        let _ = parse_time(reminder_time.trim())?;
    }

    let person_exists = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM checkin_people WHERE id = ?1)",
            params![person_id],
            |row| row.get::<_, i32>(0),
        )
        .map_err(|err| err.to_string())?;
    if person_exists == 0 {
        return Err("Person not found".to_string());
    }

    let discussion = normalize_optional_text(input.discussion);
    let notes = normalize_optional_text(input.notes);
    let action_items = normalize_optional_text(input.action_items);
    let next_checkin_date = normalize_optional_text(input.next_checkin_date);
    let reminder_time = normalize_optional_text(input.reminder_time);
    let reminder_enabled = if input.reminder_enabled { 1 } else { 0 };
    let reminder_state = normalize_reminder_state(
        input.reminder_enabled,
        next_checkin_date.as_deref(),
        reminder_time.as_deref(),
    );

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO checkins (
        id, person_id, checkin_date, discussion, notes, action_items, next_checkin_date,
        reminder_enabled, reminder_time, reminder_state, created_at, updated_at
      )
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            id,
            person_id,
            checkin_date,
            discussion,
            notes,
            action_items,
            next_checkin_date,
            reminder_enabled,
            reminder_time,
            reminder_state,
            now,
            now
        ],
    )
    .map_err(|err| err.to_string())?;

    get_checkin(conn, &id)
}

pub fn update_checkin(conn: &Connection, id: &str, input: CheckinInput) -> Result<Checkin, String> {
    let person_id = input.person_id.trim().to_string();
    let checkin_date = input.checkin_date.trim().to_string();
    let _ = parse_date(&checkin_date)?;
    if let Some(next_date) = input.next_checkin_date.as_deref() {
        let _ = parse_date(next_date.trim())?;
    }
    if let Some(reminder_time) = input.reminder_time.as_deref() {
        let _ = parse_time(reminder_time.trim())?;
    }

    let person_exists = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM checkin_people WHERE id = ?1)",
            params![person_id],
            |row| row.get::<_, i32>(0),
        )
        .map_err(|err| err.to_string())?;
    if person_exists == 0 {
        return Err("Person not found".to_string());
    }

    let discussion = normalize_optional_text(input.discussion);
    let notes = normalize_optional_text(input.notes);
    let action_items = normalize_optional_text(input.action_items);
    let next_checkin_date = normalize_optional_text(input.next_checkin_date);
    let reminder_time = normalize_optional_text(input.reminder_time);
    let reminder_enabled = if input.reminder_enabled { 1 } else { 0 };
    let reminder_state = normalize_reminder_state(
        input.reminder_enabled,
        next_checkin_date.as_deref(),
        reminder_time.as_deref(),
    );

    conn.execute(
        "UPDATE checkins
       SET person_id = ?1,
           checkin_date = ?2,
           discussion = ?3,
           notes = ?4,
           action_items = ?5,
           next_checkin_date = ?6,
           reminder_enabled = ?7,
           reminder_time = ?8,
           reminder_state = ?9,
           updated_at = ?10
       WHERE id = ?11",
        params![
            person_id,
            checkin_date,
            discussion,
            notes,
            action_items,
            next_checkin_date,
            reminder_enabled,
            reminder_time,
            reminder_state,
            Utc::now().to_rfc3339(),
            id
        ],
    )
    .map_err(|err| err.to_string())?;

    get_checkin(conn, id)
}

pub fn delete_checkin(conn: &Connection, id: &str) -> Result<(), String> {
    conn.execute("DELETE FROM checkins WHERE id = ?1", params![id])
        .map_err(|err| err.to_string())?;
    Ok(())
}

pub fn list_due_checkin_reminders(
    conn: &Connection,
    now: DateTime<Local>,
) -> Result<Vec<CheckinReminder>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT c.id, p.name, c.next_checkin_date, c.reminder_time
       FROM checkins c
       INNER JOIN checkin_people p ON p.id = c.person_id
       WHERE c.reminder_enabled = 1
         AND c.next_checkin_date IS NOT NULL
         AND c.reminder_time IS NOT NULL
         AND (c.reminder_state IS NULL OR c.reminder_state != 'sent')",
        )
        .map_err(|err| err.to_string())?;

    let rows: Vec<(String, String, String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .collect();

    let mut due = Vec::new();
    for (checkin_id, person_name, next_checkin_date, reminder_time) in rows {
        let date = parse_date(&next_checkin_date)?;
        let time = parse_time(&reminder_time)?;
        let due_at = date.and_time(time);
        if due_at <= now.naive_local() {
            due.push(CheckinReminder {
                checkin_id,
                person_name,
                next_checkin_date,
                reminder_time,
            });
        }
    }
    Ok(due)
}

pub fn mark_checkin_reminder_sent(conn: &Connection, checkin_id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE checkins SET reminder_state = 'sent', updated_at = ?1 WHERE id = ?2",
        params![Utc::now().to_rfc3339(), checkin_id],
    )
    .map_err(|err| err.to_string())?;
    Ok(())
}

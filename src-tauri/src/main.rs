mod attachments;
mod db;
mod repository;
mod services;
mod settings;

use repository::{
    Checkin, CheckinInput, CheckinPerson, CheckinPersonInput, Note, NoteAttachment, NoteFolder,
    NoteInput, Task, TaskInput, TaskOverview,
};
use services::timer::{TimerEntry, TimerState};
use settings::{load_settings, save_settings, Settings};
use std::{path::PathBuf, process::Command};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::NotificationExt;

fn workspace_from_settings(app: &AppHandle) -> Result<PathBuf, String> {
    let settings = load_settings(app).map_err(|err| err)?;
    if let Some(path) = settings.workspace_path {
        Ok(PathBuf::from(path))
    } else {
        Err("Workspace not set".to_string())
    }
}

#[tauri::command]
fn get_settings(app: AppHandle) -> Result<Settings, String> {
    load_settings(&app)
}

#[tauri::command]
fn set_workspace(app: AppHandle, path: String) -> Result<Settings, String> {
    let workspace = PathBuf::from(path);
    db::ensure_workspace(&workspace)?;
    let _ = db::open_db(&workspace)?;

    let settings = Settings {
        workspace_path: Some(workspace.to_string_lossy().to_string()),
    };
    save_settings(&app, &settings)?;
    Ok(settings)
}

#[tauri::command]
fn open_workspace(path: String) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .status()
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn test_notification(app: AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("DayRally")
        .body("Notifications are working")
        .sound("default")
        .show()
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_notification_settings() -> Result<(), String> {
    Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.notifications")
        .status()
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
fn copy_text_native(text: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::io::Write;
        use std::process::Stdio;

        let mut child = Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .map_err(|err| err.to_string())?;

        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(text.as_bytes())
                .map_err(|err| err.to_string())?;
        }

        let status = child.wait().map_err(|err| err.to_string())?;
        if status.success() {
            Ok(())
        } else {
            Err("pbcopy failed".to_string())
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = text;
        Err("copy_text_native is only supported on macOS".to_string())
    }
}

#[tauri::command]
fn list_task_overview(app: AppHandle) -> Result<TaskOverview, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::rollover_tasks(&conn)?;
    repository::ensure_recurrences(&conn)?;
    repository::list_overview(&conn)
}

#[tauri::command]
fn list_tags(app: AppHandle) -> Result<Vec<String>, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::list_tags(&conn)
}

#[tauri::command]
fn create_task(app: AppHandle, input: TaskInput) -> Result<Task, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::create_task(&conn, input)
}

#[tauri::command]
fn update_task(app: AppHandle, id: String, input: TaskInput) -> Result<Task, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::update_task(&conn, &id, input)
}

#[tauri::command]
fn update_task_status(app: AppHandle, id: String, status: String) -> Result<Task, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::update_status(&conn, &id, &status)
}

#[tauri::command]
fn delete_task(app: AppHandle, state: State<'_, TimerState>, id: String) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::delete_task(&conn, &id)?;
    state.remove(&id);
    Ok(())
}

#[tauri::command]
fn move_task(app: AppHandle, id: String, direction: String) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::move_task(&conn, &id, &direction)
}

#[tauri::command]
fn reorder_tasks(app: AppHandle, task_ids: Vec<String>) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::reorder_tasks(&conn, &task_ids)
}

#[tauri::command]
fn start_task_timer(
    app: AppHandle,
    state: State<'_, TimerState>,
    task_id: String,
) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    let task = repository::get_task(&conn, &task_id)?;
    let minutes = task.timer_minutes.unwrap_or(25).max(1);
    let now = chrono::Local::now();
    let ends_at = now + chrono::Duration::minutes(minutes as i64);
    repository::start_timer(&conn, &task_id, &ends_at.to_rfc3339())?;
    state.upsert(TimerEntry {
        task_id: task_id.clone(),
        title: task.title.clone(),
        ends_at,
    });

    let app_handle = app.clone();
    let title = task.title.clone();
    tauri::async_runtime::spawn(async move {
        let remaining = ends_at - chrono::Local::now();
        if remaining.num_seconds() > 0 {
            tokio::time::sleep(std::time::Duration::from_secs(
                remaining.num_seconds() as u64
            ))
            .await;
        }
        let still_running = app_handle
            .state::<TimerState>()
            .get(&task_id)
            .map(|entry| entry.ends_at.timestamp() == ends_at.timestamp())
            .unwrap_or(false);
        if !still_running {
            return;
        }

        app_handle.state::<TimerState>().remove(&task_id);
        if let Ok(workspace) = workspace_from_settings(&app_handle) {
            if let Ok(conn) = db::open_db(&workspace) {
                let _ = repository::finish_timer(&conn, &task_id);
            }
        }
        if let Err(err) = app_handle
            .notification()
            .builder()
            .title("DayRally")
            .body(&format!("Time finished: {}", title))
            .sound("default")
            .show()
        {
            eprintln!("failed to show timer completion notification: {}", err);
        }
    });

    Ok(())
}

#[tauri::command]
fn stop_task_timer(
    app: AppHandle,
    state: State<'_, TimerState>,
    task_id: String,
) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    let task = repository::get_task(&conn, &task_id)?;
    repository::stop_timer(&conn, &task_id)?;
    state.remove(&task_id);
    if let Err(err) = app
        .notification()
        .builder()
        .title("DayRally")
        .body(&format!("Timer stopped: {}", task.title))
        .sound("default")
        .show()
    {
        eprintln!("failed to show timer stop notification: {}", err);
    }
    Ok(())
}

#[tauri::command]
fn list_timers(state: State<'_, TimerState>) -> Result<Vec<(String, i64)>, String> {
    let now = chrono::Local::now();
    let timers = state
        .list()
        .into_iter()
        .map(|entry| {
            let remaining = entry.ends_at - now;
            (entry.task_id, remaining.num_seconds().max(0))
        })
        .collect();
    Ok(timers)
}

#[tauri::command]
fn list_checkin_people(app: AppHandle) -> Result<Vec<CheckinPerson>, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::list_checkin_people(&conn)
}

#[tauri::command]
fn create_checkin_person(
    app: AppHandle,
    input: CheckinPersonInput,
) -> Result<CheckinPerson, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::create_checkin_person(&conn, input)
}

#[tauri::command]
fn delete_checkin_person(app: AppHandle, id: String) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::delete_checkin_person(&conn, &id)
}

#[tauri::command]
fn list_checkins(app: AppHandle, person_id: Option<String>) -> Result<Vec<Checkin>, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::list_checkins(&conn, person_id.as_deref())
}

#[tauri::command]
fn create_checkin(app: AppHandle, input: CheckinInput) -> Result<Checkin, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::create_checkin(&conn, input)
}

#[tauri::command]
fn update_checkin(app: AppHandle, id: String, input: CheckinInput) -> Result<Checkin, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::update_checkin(&conn, &id, input)
}

#[tauri::command]
fn delete_checkin(app: AppHandle, id: String) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::delete_checkin(&conn, &id)
}

#[tauri::command]
fn list_notes(app: AppHandle) -> Result<Vec<Note>, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::list_notes(&conn)
}

#[tauri::command]
fn list_note_folders(app: AppHandle) -> Result<Vec<NoteFolder>, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::list_note_folders(&conn)
}

#[tauri::command]
fn create_note_folder(app: AppHandle, name: String) -> Result<NoteFolder, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::create_note_folder(&conn, &name)
}

#[tauri::command]
fn delete_note_folder(app: AppHandle, folder_id: String) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::delete_note_folder(&conn, &folder_id)
}

#[tauri::command]
fn create_note(app: AppHandle, input: NoteInput) -> Result<Note, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::create_note(&conn, input)
}

#[tauri::command]
fn update_note(app: AppHandle, id: String, input: NoteInput) -> Result<Note, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::update_note(&conn, &id, input)
}

#[tauri::command]
fn delete_note(app: AppHandle, id: String) -> Result<(), String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::delete_note(&conn, &id)
}

#[tauri::command]
fn list_note_attachments(app: AppHandle, note_id: String) -> Result<Vec<NoteAttachment>, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    repository::list_note_attachments(&conn, &note_id)
}

#[tauri::command]
fn save_note_attachment(
    app: AppHandle,
    note_id: String,
    bytes: Vec<u8>,
) -> Result<NoteAttachment, String> {
    let workspace = workspace_from_settings(&app)?;
    let conn = db::open_db(&workspace)?;
    let _ = repository::get_note(&conn, &note_id)?;
    let saved = attachments::save_note_image(&workspace, &note_id, &bytes)?;
    repository::create_note_attachment(&conn, &note_id, &saved.filename, &saved.path_relative)
}

fn schedule_checkin_reminders(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            if let Ok(workspace) = workspace_from_settings(&app) {
                if let Ok(conn) = db::open_db(&workspace) {
                    let now = chrono::Local::now();
                    if let Ok(reminders) = repository::list_due_checkin_reminders(&conn, now) {
                        for reminder in reminders {
                            if let Err(err) = app
                                .notification()
                                .builder()
                                .title("DayRally")
                                .body(&format!("Check-in reminder: {}", reminder.person_name))
                                .sound("default")
                                .show()
                            {
                                eprintln!("failed to show check-in reminder: {}", err);
                            }
                            let _ =
                                repository::mark_checkin_reminder_sent(&conn, &reminder.checkin_id);
                        }
                    }
                }
            }
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        }
    });
}

fn schedule_midnight(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let now = chrono::Local::now();
            let tomorrow = (now + chrono::Duration::days(1)).date_naive();
            let midnight = tomorrow.and_hms_opt(0, 0, 5).unwrap();
            let wait = (midnight - now.naive_local()).num_seconds();
            if wait > 0 {
                tokio::time::sleep(std::time::Duration::from_secs(wait as u64)).await;
            }
            if let Ok(workspace) = workspace_from_settings(&app) {
                if let Ok(conn) = db::open_db(&workspace) {
                    let _ = repository::rollover_tasks(&conn);
                    let _ = repository::ensure_recurrences(&conn);
                }
            }
        }
    });
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(TimerState::default())
        .setup(|app| {
            schedule_midnight(app.handle().clone());
            schedule_checkin_reminders(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_workspace,
            open_workspace,
            test_notification,
            open_notification_settings,
            copy_text_native,
            list_task_overview,
            list_tags,
            create_task,
            update_task,
            update_task_status,
            delete_task,
            move_task,
            reorder_tasks,
            start_task_timer,
            stop_task_timer,
            list_timers,
            list_checkin_people,
            create_checkin_person,
            delete_checkin_person,
            list_checkins,
            create_checkin,
            update_checkin,
            delete_checkin,
            list_notes,
            list_note_folders,
            create_note_folder,
            delete_note_folder,
            create_note,
            update_note,
            delete_note,
            list_note_attachments,
            save_note_attachment
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

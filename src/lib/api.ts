import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export type Settings = {
  workspace_path: string | null;
};

export type TaskStatus = "todo" | "in_progress" | "done" | "skipped";
export type RecurrenceType = "daily" | "weekly" | "monthly";
export type CheckinRelationship = "manager" | "report" | "peer";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  tags: string[];
  target_date: string;
  status: TaskStatus;
  progress_percent: number;
  deadline_at: string | null;
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  recurrence_interval: number | null;
  recurrence_weekdays: string | null;
  timer_enabled: boolean;
  timer_minutes: number | null;
  timer_state: "idle" | "running" | "paused" | "finished" | null;
  timer_ends_at: string | null;
  rolled_over: boolean;
  rolled_from_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TaskOverview = {
  today: Task[];
  rolled_over: Task[];
  upcoming: Task[];
};

export type TaskInput = {
  title: string;
  notes: string | null;
  tags: string[];
  target_date: string;
  status: TaskStatus;
  progress_percent: number;
  deadline_at: string | null;
  is_recurring: boolean;
  recurrence_type: RecurrenceType | null;
  recurrence_interval: number | null;
  recurrence_weekdays: string | null;
  timer_enabled: boolean;
  timer_minutes: number | null;
};

export type Note = {
  id: string;
  title: string;
  body_markdown: string;
  tags: string[];
  folder_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NoteInput = {
  title: string;
  body_markdown: string;
  tags: string[];
  folder_id: string | null;
};

export type NoteAttachment = {
  id: string;
  note_id: string;
  filename: string;
  path_relative: string;
  created_at: string;
};

export type NoteFolder = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type CheckinPerson = {
  id: string;
  name: string;
  relationship: CheckinRelationship;
  created_at: string;
  updated_at: string;
};

export type CheckinPersonInput = {
  name: string;
  relationship: CheckinRelationship;
};

export type Checkin = {
  id: string;
  person_id: string;
  checkin_date: string;
  discussion: string | null;
  notes: string | null;
  action_items: string | null;
  next_checkin_date: string | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
  reminder_state: "idle" | "scheduled" | "sent" | null;
  created_at: string;
  updated_at: string;
};

export type CheckinInput = {
  person_id: string;
  checkin_date: string;
  discussion: string | null;
  notes: string | null;
  action_items: string | null;
  next_checkin_date: string | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
};

export async function getSettings(): Promise<Settings> {
  return invoke("get_settings");
}

export async function selectWorkspace(): Promise<string | null> {
  const result = await open({
    directory: true,
    multiple: false,
    title: "Select or Create a DayRally Workspace"
  });
  if (Array.isArray(result)) return result[0] ?? null;
  return result ?? null;
}

export async function setWorkspace(path: string): Promise<Settings> {
  return invoke("set_workspace", { path });
}

export async function openWorkspace(path: string): Promise<void> {
  return invoke("open_workspace", { path });
}

export async function testNotification(): Promise<void> {
  return invoke("test_notification");
}

export async function openNotificationSettings(): Promise<void> {
  return invoke("open_notification_settings");
}

export async function copyTextNative(text: string): Promise<void> {
  return invoke("copy_text_native", { text });
}

export async function listTaskOverview(): Promise<TaskOverview> {
  return invoke("list_task_overview");
}

export async function listTags(): Promise<string[]> {
  return invoke("list_tags");
}

export async function createTask(input: TaskInput): Promise<Task> {
  return invoke("create_task", { input });
}

export async function updateTask(id: string, input: TaskInput): Promise<Task> {
  return invoke("update_task", { id, input });
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return invoke("update_task_status", { id, status });
}

export async function deleteTask(id: string): Promise<void> {
  return invoke("delete_task", { id });
}

export async function moveTask(id: string, direction: "up" | "down"): Promise<void> {
  return invoke("move_task", { id, direction });
}

export async function reorderTasks(taskIds: string[]): Promise<void> {
  return invoke("reorder_tasks", { taskIds });
}

export async function startTaskTimer(taskId: string): Promise<void> {
  return invoke("start_task_timer", { taskId });
}

export async function stopTaskTimer(taskId: string): Promise<void> {
  return invoke("stop_task_timer", { taskId });
}

export async function listTimers(): Promise<[string, number][]> {
  return invoke("list_timers");
}

export async function listCheckinPeople(): Promise<CheckinPerson[]> {
  return invoke("list_checkin_people");
}

export async function createCheckinPerson(input: CheckinPersonInput): Promise<CheckinPerson> {
  return invoke("create_checkin_person", { input });
}

export async function deleteCheckinPerson(id: string): Promise<void> {
  return invoke("delete_checkin_person", { id });
}

export async function listCheckins(personId: string | null = null): Promise<Checkin[]> {
  return invoke("list_checkins", { personId });
}

export async function createCheckin(input: CheckinInput): Promise<Checkin> {
  return invoke("create_checkin", { input });
}

export async function updateCheckin(id: string, input: CheckinInput): Promise<Checkin> {
  return invoke("update_checkin", { id, input });
}

export async function deleteCheckin(id: string): Promise<void> {
  return invoke("delete_checkin", { id });
}

export async function listNotes(): Promise<Note[]> {
  return invoke("list_notes");
}

export async function createNote(input: NoteInput): Promise<Note> {
  return invoke("create_note", { input });
}

export async function updateNote(id: string, input: NoteInput): Promise<Note> {
  return invoke("update_note", { id, input });
}

export async function deleteNote(id: string): Promise<void> {
  return invoke("delete_note", { id });
}

export async function listNoteAttachments(noteId: string): Promise<NoteAttachment[]> {
  return invoke("list_note_attachments", { noteId });
}

export async function saveNoteAttachment(noteId: string, bytes: number[]): Promise<NoteAttachment> {
  return invoke("save_note_attachment", { noteId, bytes });
}

export async function listNoteFolders(): Promise<NoteFolder[]> {
  return invoke("list_note_folders");
}

export async function createNoteFolder(name: string): Promise<NoteFolder> {
  return invoke("create_note_folder", { name });
}

export async function deleteNoteFolder(folderId: string): Promise<void> {
  return invoke("delete_note_folder", { folderId });
}

import { Fragment, useEffect, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties, type DragEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { writeHtml, writeText } from "@tauri-apps/plugin-clipboard-manager";
import {
  createCheckin,
  createCheckinPerson,
  copyTextNative,
  createNoteFolder,
  createNote,
  deleteCheckinPerson,
  deleteNoteFolder,
  createTask,
  deleteNote,
  deleteTask,
  getSettings,
  listCheckinPeople,
  listCheckins,
  listNoteAttachments,
  listNoteFolders,
  listNotes,
  listTags,
  listTaskOverview,
  listTimers,
  moveTask,
  openNotificationSettings,
  openWorkspace,
  saveNoteAttachment,
  selectWorkspace,
  setWorkspace,
  startTaskTimer,
  stopTaskTimer,
  testNotification,
  updateCheckin,
  updateNote,
  updateTask,
  updateTaskStatus,
  type Checkin,
  type CheckinInput,
  type CheckinPerson,
  type CheckinRelationship,
  type Note,
  type NoteAttachment,
  type NoteFolder,
  type NoteInput,
  type RecurrenceType,
  type Settings,
  type Task,
  type TaskInput,
  type TaskOverview,
  type TaskStatus
} from "./lib/api";

type View = "today" | "checkins" | "notes" | "settings";
type TimerMap = Record<string, number>;
type TaskBucket = "today" | "rolled" | "upcoming";

type DisplayTask = {
  task: Task;
  bucket: TaskBucket;
};

type TaskFormState = {
  title: string;
  notes: string;
  tags_text: string;
  target_date: string;
  status: TaskStatus;
  deadline_local: string;
  is_recurring: boolean;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_weekdays: string[];
  timer_enabled: boolean;
  timer_minutes: number;
};

type NoteFormState = {
  title: string;
  body_markdown: string;
  tags_text: string;
  folder_id: string | null;
};

type CheckinPersonFormState = {
  name: string;
  relationship: CheckinRelationship;
};

type CheckinTableRow = {
  discussion: string;
  achieved: string;
  action: string;
};

type CheckinFormState = {
  person_id: string;
  checkin_date: string;
  occurrence: "none" | "weekly" | "biweekly" | "monthly";
  next_checkin_date: string;
  rows: CheckinTableRow[];
  reminder_enabled: boolean;
  reminder_time: string;
};

type AppIconName =
  | "today"
  | "checkins"
  | "notes"
  | "settings"
  | "folder"
  | "stack"
  | "plus"
  | "compose"
  | "close"
  | "up"
  | "down"
  | "edit"
  | "trash"
  | "play"
  | "stop"
  | "repeat"
  | "clock"
  | "rollover";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const VIEW_PATHS: Record<View, string> = {
  today: "/today",
  checkins: "/checkins",
  notes: "/notes",
  settings: "/settings"
};

function viewFromPath(pathname: string): View {
  if (pathname.startsWith("/checkins")) return "checkins";
  if (pathname.startsWith("/notes")) return "notes";
  if (pathname.startsWith("/settings")) return "settings";
  return "today";
}

function AppIcon({ name, className }: { name: AppIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className ? `ui-icon ${className}` : "ui-icon"}
      aria-hidden="true"
      focusable="false"
    >
      {name === "today" ? (
        <>
          <rect x="3.2" y="4.3" width="13.6" height="12.5" rx="2.1" />
          <path d="M3.2 8.2h13.6" />
          <path d="M7 2.8v3.6" />
          <path d="M13 2.8v3.6" />
        </>
      ) : null}
      {name === "checkins" ? (
        <>
          <circle cx="7.3" cy="7.3" r="2.4" />
          <circle cx="12.7" cy="7.3" r="2.4" />
          <path d="M3.8 14.9a3.5 3.5 0 0 1 3.5-3h.1a3.5 3.5 0 0 1 3.5 3" />
          <path d="M9.2 14.9a3.5 3.5 0 0 1 3.5-3h.1a3.5 3.5 0 0 1 3.5 3" />
        </>
      ) : null}
      {name === "notes" ? (
        <>
          <path d="M4.2 2.8h7.2l4.3 4.3V16a1.9 1.9 0 0 1-1.9 1.9H4.2A1.9 1.9 0 0 1 2.3 16V4.7a1.9 1.9 0 0 1 1.9-1.9Z" />
          <path d="M11.4 2.8v4.3h4.3" />
          <path d="M6 10.2h8" />
          <path d="M6 13.4h8" />
        </>
      ) : null}
      {name === "settings" ? (
        <>
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 2.8v2.1M10 15.1v2.1M2.8 10h2.1M15.1 10h2.1M4.8 4.8l1.5 1.5M13.7 13.7l1.5 1.5M15.2 4.8l-1.5 1.5M6.3 13.7l-1.5 1.5" />
        </>
      ) : null}
      {name === "folder" ? (
        <path d="M2.7 7a2 2 0 0 1 2-2h3.7l1.5 1.8h5.4a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H4.7a2 2 0 0 1-2-2z" />
      ) : null}
      {name === "stack" ? (
        <>
          <rect x="2.7" y="3" width="11.4" height="3.4" rx="1.1" />
          <rect x="5.2" y="8.3" width="12.1" height="3.4" rx="1.1" />
          <rect x="2.7" y="13.6" width="11.4" height="3.4" rx="1.1" />
        </>
      ) : null}
      {name === "plus" ? (
        <path d="M10 4.2v11.6M4.2 10h11.6" />
      ) : null}
      {name === "compose" ? (
        <>
          <path d="M4.3 14.2V16h1.8l8.3-8.3-1.8-1.8z" />
          <path d="m12.8 4.9 1.8 1.8 1.1-1.1a1.2 1.2 0 0 0 0-1.7l-.1-.1a1.2 1.2 0 0 0-1.7 0z" />
        </>
      ) : null}
      {name === "close" ? (
        <path d="m5.5 5.5 9 9m0-9-9 9" />
      ) : null}
      {name === "up" ? (
        <path d="M10 15V5.5m0 0-3.5 3.6M10 5.5l3.5 3.6" />
      ) : null}
      {name === "down" ? (
        <path d="M10 5v9.5m0 0-3.5-3.6M10 14.5l3.5-3.6" />
      ) : null}
      {name === "edit" ? (
        <>
          <path d="M4.3 14.2V16h1.8l8.3-8.3-1.8-1.8z" />
          <path d="m12.8 4.9 1.8 1.8 1.1-1.1a1.2 1.2 0 0 0 0-1.7l-.1-.1a1.2 1.2 0 0 0-1.7 0z" />
        </>
      ) : null}
      {name === "trash" ? (
        <>
          <path d="M4.5 6.2h11" />
          <path d="M7.6 6.2V4.6a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1v1.6" />
          <path d="M6.4 6.2v9.1a1.2 1.2 0 0 0 1.2 1.2h4.8a1.2 1.2 0 0 0 1.2-1.2V6.2" />
          <path d="M8.7 8.7v5.2M11.3 8.7v5.2" />
        </>
      ) : null}
      {name === "play" ? (
        <path d="M7.4 5.4 14 10l-6.6 4.6z" />
      ) : null}
      {name === "stop" ? (
        <rect x="6.4" y="6.4" width="7.2" height="7.2" rx="1.3" />
      ) : null}
      {name === "repeat" ? (
        <>
          <path d="M14.9 7.3H6.8l1.8-1.9M5.1 12.7h8.1l-1.8 1.9" />
        </>
      ) : null}
      {name === "clock" ? (
        <>
          <circle cx="10" cy="10" r="6.3" />
          <path d="M10 6.7v3.8l2.6 1.6" />
        </>
      ) : null}
      {name === "rollover" ? (
        <>
          <path d="M5.2 12.6V5.7h7.1" />
          <path d="m9.8 4.1 2.5 1.6-1.6 2.5" />
          <path d="M14.8 7.4v6.9H7.7" />
          <path d="m10.2 15.9-2.5-1.6 1.6-2.5" />
        </>
      ) : null}
    </svg>
  );
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function nowTimeString() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function toLocalDatetimeInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (v: number) => v.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shortUpdatedLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function fromTask(task: Task): TaskFormState {
  return {
    title: task.title,
    notes: task.notes ?? "",
    tags_text: task.tags.join(", "),
    target_date: task.target_date,
    status: task.status,
    deadline_local: toLocalDatetimeInput(task.deadline_at),
    is_recurring: task.is_recurring,
    recurrence_type: (task.recurrence_type ?? "daily") as RecurrenceType,
    recurrence_interval: task.recurrence_interval ?? 1,
    recurrence_weekdays: task.recurrence_weekdays ? task.recurrence_weekdays.split(",").map((x) => x.trim()).filter(Boolean) : [],
    timer_enabled: task.timer_enabled,
    timer_minutes: task.timer_minutes ?? 25
  };
}

function emptyForm(): TaskFormState {
  return {
    title: "",
    notes: "",
    tags_text: "",
    target_date: todayString(),
    status: "todo",
    deadline_local: "",
    is_recurring: false,
    recurrence_type: "daily",
    recurrence_interval: 1,
    recurrence_weekdays: [],
    timer_enabled: false,
    timer_minutes: 25
  };
}

function toTaskInput(form: TaskFormState): TaskInput {
  const recurrenceType = form.is_recurring ? form.recurrence_type : null;
  const weekdays = form.is_recurring && form.recurrence_type === "weekly" && form.recurrence_weekdays.length > 0
    ? form.recurrence_weekdays.join(",")
    : null;

  return {
    title: form.title.trim(),
    notes: form.notes.trim() || null,
    tags: parseTagText(form.tags_text),
    target_date: form.target_date,
    status: form.status,
    progress_percent: form.status === "done" ? 100 : 0,
    deadline_at: form.deadline_local ? new Date(form.deadline_local).toISOString() : null,
    is_recurring: form.is_recurring,
    recurrence_type: recurrenceType,
    recurrence_interval: form.is_recurring ? Math.max(1, form.recurrence_interval) : null,
    recurrence_weekdays: weekdays,
    timer_enabled: form.timer_enabled,
    timer_minutes: form.timer_enabled ? Math.max(1, form.timer_minutes) : null
  };
}

function parseTagText(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function hashTagName(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function taskTagBadgeStyle(tag: string, theme: "light" | "dark"): CSSProperties {
  const normalized = tag.trim().toLowerCase();
  const hue = hashTagName(normalized) % 360;
  if (theme === "dark") {
    return {
      borderColor: `hsla(${hue}, 72%, 62%, 0.58)`,
      background: `hsla(${hue}, 70%, 24%, 0.35)`,
      color: `hsl(${hue}, 78%, 78%)`
    };
  }
  return {
    borderColor: `hsla(${hue}, 65%, 45%, 0.55)`,
    background: `hsla(${hue}, 78%, 92%, 0.9)`,
    color: `hsl(${hue}, 62%, 30%)`
  };
}

function taskStatusClassName(status: TaskStatus): string {
  if (status === "todo") return "status-new";
  if (status === "in_progress") return "status-in-progress";
  if (status === "skipped") return "status-blocked";
  return "status-done";
}

function toNoteForm(note: Note): NoteFormState {
  return {
    title: note.title,
    body_markdown: note.body_markdown,
    tags_text: note.tags.join(", "),
    folder_id: note.folder_id ?? null
  };
}

function emptyNoteForm(): NoteFormState {
  return {
    title: "",
    body_markdown: "",
    tags_text: "",
    folder_id: null
  };
}

function toNoteInput(form: NoteFormState): NoteInput {
  return {
    title: form.title.trim(),
    body_markdown: form.body_markdown,
    tags: parseTagText(form.tags_text),
    folder_id: form.folder_id
  };
}

function emptyCheckinPersonForm(): CheckinPersonFormState {
  return {
    name: "",
    relationship: "report"
  };
}

function emptyCheckinForm(personId: string | null): CheckinFormState {
  const checkin_date = todayString();
  const occurrence: CheckinFormState["occurrence"] = "weekly";
  return {
    person_id: personId ?? "",
    checkin_date,
    occurrence,
    next_checkin_date: computeNextCheckinDate(checkin_date, occurrence),
    rows: [{ discussion: "", achieved: "", action: "" }],
    reminder_enabled: false,
    reminder_time: nowTimeString()
  };
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeNextCheckinDate(
  checkinDate: string,
  occurrence: "none" | "weekly" | "biweekly" | "monthly"
): string {
  const date = parseDateOnly(checkinDate);
  if (!date || occurrence === "none") return "";

  if (occurrence === "weekly") {
    date.setDate(date.getDate() + 7);
    return formatDateOnly(date);
  }

  if (occurrence === "biweekly") {
    date.setDate(date.getDate() + 14);
    return formatDateOnly(date);
  }

  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const nextMonthBase = new Date(year, month + 1, 1);
  const lastDay = new Date(nextMonthBase.getFullYear(), nextMonthBase.getMonth() + 1, 0).getDate();
  nextMonthBase.setDate(Math.min(day, lastDay));
  return formatDateOnly(nextMonthBase);
}

function inferCheckinOccurrence(
  checkinDate: string,
  nextCheckinDate: string | null
): "none" | "weekly" | "biweekly" | "monthly" {
  if (!nextCheckinDate) return "none";
  const start = parseDateOnly(checkinDate);
  const end = parseDateOnly(nextCheckinDate);
  if (!start || !end) return "none";

  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 7) return "weekly";
  if (diffDays === 14) return "biweekly";
  if (diffDays >= 28 && diffDays <= 31) return "monthly";
  return "none";
}

function textToItems(value: string | null | undefined): string[] {
  if (!value) return [""];
  const items = value
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter((line) => line.length > 0);
  return items.length > 0 ? items : [""];
}

function itemsToText(items: string[]): string | null {
  const normalized = items.map((item) => item.trim()).filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized.join("\n") : null;
}

function buildCheckinRows(
  discussion: string | null | undefined,
  achieved: string | null | undefined,
  actionItems: string | null | undefined
): CheckinTableRow[] {
  const discussionItems = textToItems(discussion);
  const achievedItems = textToItems(achieved);
  const actionItemsList = textToItems(actionItems);
  const maxRows = Math.max(discussionItems.length, achievedItems.length, actionItemsList.length, 1);

  return Array.from({ length: maxRows }, (_, index) => ({
    discussion: discussionItems[index] ?? "",
    achieved: achievedItems[index] ?? "",
    action: actionItemsList[index] ?? ""
  }));
}

function toCheckinFormFromExisting(checkin: Checkin): CheckinFormState {
  return {
    person_id: checkin.person_id,
    checkin_date: checkin.checkin_date,
    occurrence: inferCheckinOccurrence(checkin.checkin_date, checkin.next_checkin_date),
    next_checkin_date: checkin.next_checkin_date ?? "",
    rows: buildCheckinRows(checkin.discussion, checkin.notes, checkin.action_items),
    reminder_enabled: checkin.reminder_enabled,
    reminder_time: checkin.reminder_time ?? nowTimeString()
  };
}

function toCheckinInput(form: CheckinFormState): CheckinInput {
  const nextCheckinDate = form.next_checkin_date.trim() || computeNextCheckinDate(form.checkin_date, form.occurrence);
  const reminderEnabled = nextCheckinDate ? form.reminder_enabled : false;
  const discussion = itemsToText(form.rows.map((row) => row.discussion));
  const notes = itemsToText(form.rows.map((row) => row.achieved));
  const actionItems = itemsToText(form.rows.map((row) => row.action));
  return {
    person_id: form.person_id,
    checkin_date: form.checkin_date,
    discussion,
    notes,
    action_items: actionItems,
    next_checkin_date: nextCheckinDate || null,
    reminder_enabled: reminderEnabled,
    reminder_time: reminderEnabled ? (form.reminder_time.trim() || null) : null
  };
}

function patchCheckinFormWithAutoNextDate(
  prev: CheckinFormState,
  updates: Partial<CheckinFormState>
): CheckinFormState {
  const next = { ...prev, ...updates };
  if ("next_checkin_date" in updates) return next;

  const previousSuggested = computeNextCheckinDate(prev.checkin_date, prev.occurrence);
  const hasCustomNextDate = prev.next_checkin_date.trim() !== "" && prev.next_checkin_date !== previousSuggested;
  if (hasCustomNextDate) return next;

  return {
    ...next,
    next_checkin_date: computeNextCheckinDate(next.checkin_date, next.occurrence)
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function toEditableHtml(value: string): string {
  if (!value.trim()) return "<p><br></p>";
  if (looksLikeHtml(value)) return value;
  const escaped = escapeHtml(value).replace(/\n/g, "<br>");
  return `<p>${escaped}</p>`;
}

function toStorageHtml(value: string): string {
  const container = document.createElement("div");
  container.innerHTML = value;
  container.querySelectorAll("img").forEach((img) => {
    const rel = img.getAttribute("data-path");
    if (rel) {
      img.removeAttribute("src");
      img.setAttribute("data-path", rel);
      if (!img.getAttribute("alt")) {
        img.setAttribute("alt", "attachment");
      }
    }
  });
  return container.innerHTML;
}

function toPlainTextFromHtml(value: string): string {
  const container = document.createElement("div");
  container.innerHTML = value;
  return container.innerText.replace(/\n{3,}/g, "\n\n").trim();
}

function toTeamsFriendlyFromHtml(value: string): string {
  const container = document.createElement("div");
  container.innerHTML = value;
  const lines: string[] = [];
  const blocks = Array.from(container.children);

  blocks.forEach((block) => {
    const tag = block.tagName.toLowerCase();
    const text = block.textContent?.trim() ?? "";
    if (!text) return;

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
      lines.push(text.toUpperCase());
      lines.push("");
      return;
    }

    if (tag === "ul" || tag === "ol") {
      block.querySelectorAll("li").forEach((li) => {
        const liText = li.textContent?.trim();
        if (liText) lines.push(`- ${liText}`);
      });
      lines.push("");
      return;
    }

    lines.push(text);
    lines.push("");
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function toTeamsClipboardHtml(value: string): Promise<string> {
  const container = document.createElement("div");
  container.innerHTML = value;
  const images = Array.from(container.querySelectorAll("img"));

  for (const image of images) {
    const src = image.getAttribute("src");
    if (!src || src.startsWith("data:")) continue;
    try {
      const response = await fetch(src);
      if (!response.ok) continue;
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      image.setAttribute("src", dataUrl);
    } catch {
      // keep original src if fetch/embed fails
    }
  }

  return container.innerHTML;
}

function resolveAttachmentSrc(workspacePath: string | null, pathRelative: string): string | null {
  if (!workspacePath) return null;
  const base = workspacePath.replace(/\/+$/, "");
  const rel = pathRelative.replace(/^\/+/, "");
  return convertFileSrc(`${base}/${rel}`);
}

function hydrateAttachmentImages(html: string, workspacePath: string | null): string {
  const container = document.createElement("div");
  container.innerHTML = toEditableHtml(html);
  container.querySelectorAll("img").forEach((img) => {
    const rel = img.getAttribute("data-path");
    if (!rel) return;
    const src = resolveAttachmentSrc(workspacePath, rel);
    if (src) img.setAttribute("src", src);
    img.style.maxWidth = "100%";
    img.style.borderRadius = "10px";
  });
  return container.innerHTML;
}

function insertHtmlAtCursor(html: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  sel.deleteFromDocument();
  const range = sel.getRangeAt(0);
  const fragment = range.createContextualFragment(html);
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) {
    range.setStartAfter(lastNode);
    range.setEndAfter(lastNode);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

export default function App() {
  const [view, setView] = useState<View>(() => viewFromPath(window.location.pathname));
  const [settings, setSettings] = useState<Settings>({ workspace_path: null });
  const [overview, setOverview] = useState<TaskOverview>({ today: [], rolled_over: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [needsWorkspace, setNeedsWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationHint, setNotificationHint] = useState<string | null>(null);
  const [taskNotice, setTaskNotice] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [timers, setTimers] = useState<TimerMap>({});
  const [taskTags, setTaskTags] = useState<string[]>([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>(emptyForm());
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteFolders, setNoteFolders] = useState<NoteFolder[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [noteForm, setNoteForm] = useState<NoteFormState>(emptyNoteForm());
  const [, setNoteAttachments] = useState<NoteAttachment[]>([]);
  const [noteNotice, setNoteNotice] = useState<string | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [checkinNotice, setCheckinNotice] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinPeople, setCheckinPeople] = useState<CheckinPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [editingCheckinId, setEditingCheckinId] = useState<string | null>(null);
  const [checkinPersonForm, setCheckinPersonForm] = useState<CheckinPersonFormState>(emptyCheckinPersonForm());
  const [checkinForm, setCheckinForm] = useState<CheckinFormState>(emptyCheckinForm(null));
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ all: true });
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const noteEditorRef = useRef<HTMLDivElement | null>(null);
  const createFolderInputRef = useRef<HTMLInputElement | null>(null);

  const todayLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric"
    });
  }, []);

  const refreshAll = async () => {
    const [overviewData, knownTags] = await Promise.all([
      listTaskOverview(),
      listTags().catch(() => [])
    ]);
    setOverview(overviewData);
    setTaskTags(knownTags);
  };

  const refreshTimers = async () => {
    const data = await listTimers();
    const map: TimerMap = {};
    data.forEach(([taskId, seconds]) => {
      map[taskId] = seconds;
    });
    setTimers(map);
  };

  const refreshNoteFolders = async () => {
    const folders = await listNoteFolders();
    setNoteFolders(folders);
  };

  const refreshCheckinPeople = async (): Promise<CheckinPerson[]> => {
    const people = await listCheckinPeople();
    setCheckinPeople(people);
    return people;
  };

  const refreshCheckins = async (personId: string | null): Promise<Checkin[]> => {
    const items = await listCheckins(personId);
    setCheckins(items);
    return items;
  };

  const navigateToView = (nextView: View) => {
    setView(nextView);
    const path = VIEW_PATHS[nextView];
    if (window.location.pathname !== path) {
      window.history.pushState({ view: nextView }, "", path);
    }
  };

  const applySelectedNote = async (id: string, noteList?: Note[], workspacePathOverride?: string | null) => {
    const source = noteList ?? notes;
    const selected = source.find((note) => note.id === id);
    if (!selected) {
      return;
    }
    setSelectedNoteId(selected.id);
    const attachments = await listNoteAttachments(selected.id);
    setNoteAttachments(attachments);
    const workspacePath = workspacePathOverride ?? settings.workspace_path;
    setNoteForm({
      ...toNoteForm(selected),
      body_markdown: hydrateAttachmentImages(selected.body_markdown, workspacePath)
    });
  };

  const refreshNotes = async (preferredId?: string | null, workspacePathOverride?: string | null) => {
    const noteList = await listNotes();
    setNotes(noteList);

    if (noteList.length === 0) {
      setSelectedNoteId(null);
      setNoteForm(emptyNoteForm());
      setNoteAttachments([]);
      return;
    }

    const existingId = preferredId ?? selectedNoteId;
    const nextId = existingId && noteList.some((note) => note.id === existingId)
      ? existingId
      : noteList[0].id;
    await applySelectedNote(nextId, noteList, workspacePathOverride);
  };

  const bootstrap = async () => {
    try {
      const loaded = await getSettings();
      setSettings(loaded);
      if (!loaded.workspace_path) {
        setNeedsWorkspace(true);
        setLoading(false);
        return;
      }
      await refreshAll();
      await refreshTimers();
      await refreshNoteFolders();
      await refreshNotes(undefined, loaded.workspace_path);
      const people = await refreshCheckinPeople();
      const firstPersonId = people[0]?.id ?? null;
      setSelectedPersonId(firstPersonId);
      await refreshCheckins(firstPersonId);
      setCheckinForm(emptyCheckinForm(firstPersonId));
      setNeedsWorkspace(false);
    } catch (err) {
      console.error(err);
      setNeedsWorkspace(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setView(viewFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    const normalized = VIEW_PATHS[viewFromPath(window.location.pathname)];
    if (window.location.pathname !== normalized) {
      window.history.replaceState({ view: viewFromPath(window.location.pathname) }, "", normalized);
    }
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("dayrally-theme");
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
      return;
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const initial = prefersDark ? "dark" : "light";
    setTheme(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshTimers().catch(() => undefined);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("dayrally-theme", next);
    document.documentElement.setAttribute("data-theme", next);
  };

  const handleSelectWorkspace = async () => {
    setError(null);
    const path = await selectWorkspace();
    if (!path) return;
    try {
      const updated = await setWorkspace(path);
      setSettings(updated);
      await refreshAll();
      await refreshTimers();
      await refreshNoteFolders();
      await refreshNotes(undefined, updated.workspace_path);
      const people = await refreshCheckinPeople();
      const firstPersonId = people[0]?.id ?? null;
      setSelectedPersonId(firstPersonId);
      await refreshCheckins(firstPersonId);
      setCheckinForm(emptyCheckinForm(firstPersonId));
      setNeedsWorkspace(false);
    } catch (err) {
      console.error(err);
      setError("Unable to set workspace. Please try again.");
    }
  };

  const openCreateTaskModal = () => {
    setEditingTask(null);
    setTaskForm(emptyForm());
    setShowTaskModal(true);
  };

  const openEditTaskModal = (task: Task) => {
    setEditingTask(task);
    setTaskForm(fromTask(task));
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) return;
    try {
      setTaskNotice(null);
      const input = toTaskInput(taskForm);
      if (editingTask) {
        await updateTask(editingTask.id, input);
      } else {
        await createTask(input);
      }
      setShowTaskModal(false);
      await refreshAll();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setTaskNotice(`Unable to save task: ${message}`);
    }
  };

  const handleToggleDone = async (task: Task) => {
    const next = task.status === "done" ? "todo" : "done";
    await updateTaskStatus(task.id, next);
    await refreshAll();
  };

  const handleSetStatus = async (task: Task, status: TaskStatus) => {
    try {
      setTaskNotice(null);
      await updateTaskStatus(task.id, status);
      await refreshAll();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setTaskNotice(`Unable to change status: ${message}`);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    try {
      setTaskNotice(null);
      await deleteTask(task.id);
      await refreshTimers();
      await refreshAll();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setTaskNotice(`Unable to delete task: ${message}`);
    }
  };

  const handleMoveTask = async (task: Task, direction: "up" | "down") => {
    await moveTask(task.id, direction);
    await refreshAll();
  };

  const handleTestNotification = async () => {
    setNotificationHint(null);
    const granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      if (permission !== "granted") {
        setNotificationHint("Notifications are disabled in macOS Settings.");
        return;
      }
    }
    await testNotification();
    setNotificationHint("Notification sent.");
  };

  const handleStartTimer = async (task: Task) => {
    try {
      setTaskNotice(null);
      const granted = await isPermissionGranted();
      if (!granted) {
        const permission = await requestPermission();
        if (permission !== "granted") {
          setTaskNotice("Allow notifications in macOS Settings to get timer alerts.");
          return;
        }
      }
      const minutes = Math.max(1, task.timer_minutes ?? 25);
      setTimers((prev) => ({ ...prev, [task.id]: minutes * 60 }));
      await startTaskTimer(task.id);
      await refreshTimers();
      await refreshAll();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setTaskNotice(`Unable to start timer: ${message}`);
      await refreshTimers();
      await refreshAll();
    }
  };

  const handleStopTimer = async (task: Task) => {
    try {
      setTaskNotice(null);
      await stopTaskTimer(task.id);
      await refreshTimers();
      await refreshAll();
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setTaskNotice(`Unable to stop timer: ${message}`);
    }
  };

  const formatSeconds = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleCreateNote = async () => {
    setNoteError(null);
    setNoteNotice(null);
    const created = await createNote({
      title: "Untitled note",
      body_markdown: "",
      tags: [],
      folder_id: noteForm.folder_id
    });
    await refreshNoteFolders();
    await refreshNotes(created.id);
    navigateToView("notes");
  };

  const beginCreateFolder = () => {
    setNoteError(null);
    setNoteNotice(null);
    setNewFolderName("");
    setIsCreatingFolder(true);
  };

  const cancelCreateFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
  };

  const handleCreateFolder = async () => {
    const cleaned = newFolderName.trim();
    if (!cleaned) {
      setNoteError("Folder name cannot be empty.");
      return;
    }
    try {
      setNoteError(null);
      setNoteNotice(null);
      const folder = await createNoteFolder(cleaned);
      await refreshNoteFolders();
      const key = `folder:${folder.id}`;
      setExpandedFolders((prev) => ({ ...prev, [key]: true }));
      setIsCreatingFolder(false);
      setNewFolderName("");
      setNoteForm((prev) => ({ ...prev, folder_id: folder.id }));
      setNoteNotice(`Folder "${folder.name}" created.`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setNoteError(`Unable to create folder: ${message}`);
    }
  };

  const handleDeleteFolder = async (folder: NoteFolder) => {
    const confirmed = window.confirm(`Delete folder "${folder.name}"? Notes will be kept.`);
    if (!confirmed) return;

    try {
      setNoteError(null);
      setNoteNotice(null);
      await deleteNoteFolder(folder.id);
      setExpandedFolders((prev) => {
        const next = { ...prev };
        delete next[`folder:${folder.id}`];
        return next;
      });
      setNoteForm((prev) => ({
        ...prev,
        folder_id: prev.folder_id === folder.id ? null : prev.folder_id
      }));
      await refreshNoteFolders();
      await refreshNotes(selectedNoteId);
      setNoteNotice(`Folder "${folder.name}" deleted.`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setNoteError(`Unable to delete folder: ${message}`);
    }
  };

  const handleSelectNote = async (id: string) => {
    setNoteError(null);
    await applySelectedNote(id);
  };

  const handleSaveNote = async () => {
    if (!selectedNoteId) return;
    setNoteError(null);
    setNoteNotice(null);
    const html = noteEditorRef.current?.innerHTML ?? noteForm.body_markdown;
    await updateNote(selectedNoteId, {
      title: noteForm.title.trim(),
      body_markdown: toStorageHtml(html),
      tags: parseTagText(noteForm.tags_text),
      folder_id: noteForm.folder_id
    });
    await refreshNoteFolders();
    await refreshNotes(selectedNoteId);
    setNoteNotice("Note saved.");
  };

  const handleDeleteNote = async () => {
    if (!selectedNoteId) return;
    const selected = notes.find((note) => note.id === selectedNoteId);
    const confirmed = window.confirm(`Delete note "${selected?.title ?? "this note"}"?`);
    if (!confirmed) return;

    setNoteError(null);
    setNoteNotice(null);
    await deleteNote(selectedNoteId);
    await refreshNoteFolders();
    await refreshNotes();
  };

  const ensureNoteForAttachment = async () => {
    if (selectedNoteId) {
      return selectedNoteId;
    }
    const created = await createNote(toNoteInput(noteForm));
    await refreshNotes(created.id);
    return created.id;
  };

  const storeDroppedImage = async (bytes: Uint8Array) => {
    setNoteError(null);
    setNoteNotice(null);
    const noteId = await ensureNoteForAttachment();
    const attachment = await saveNoteAttachment(noteId, Array.from(bytes));
    setNoteAttachments((prev) => [attachment, ...prev]);
    const src = resolveAttachmentSrc(settings.workspace_path, attachment.path_relative);
    if (src) {
      const html = `<p><img src="${src}" data-path="${attachment.path_relative}" alt="${attachment.filename}" /></p>`;
      if (noteEditorRef.current) {
        noteEditorRef.current.focus();
        insertHtmlAtCursor(html);
      } else {
        setNoteForm((prev) => ({ ...prev, body_markdown: `${toEditableHtml(prev.body_markdown)}${html}` }));
      }
    }
    setNoteNotice("Image attached.");
  };

  const handleNotePaste = async (event: ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith("image/")) continue;
      const file = item.getAsFile();
      if (!file) continue;
      event.preventDefault();
      const bytes = new Uint8Array(await file.arrayBuffer());
      await storeDroppedImage(bytes);
      break;
    }
  };

  const handleNoteDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await storeDroppedImage(bytes);
    }
  };

  const handleCopyPlainText = async () => {
    try {
      const html = noteEditorRef.current?.innerHTML ?? noteForm.body_markdown;
      const text = toPlainTextFromHtml(html);
      try {
        await copyTextNative(text);
      } catch {
        await writeText(text);
      }
      setNoteError(null);
      setNoteNotice("Plain text copied.");
    } catch (err) {
      console.error(err);
      setNoteError("Clipboard write failed.");
    }
  };

  const handleCopyTeamsFriendly = async () => {
    try {
      const html = noteEditorRef.current?.innerHTML ?? noteForm.body_markdown;
      const plainText = toTeamsFriendlyFromHtml(html);
      const teamsHtml = await toTeamsClipboardHtml(html);
      try {
        await writeHtml(teamsHtml, plainText);
      } catch {
        try {
          await copyTextNative(plainText);
        } catch {
          await writeText(plainText);
        }
      }
      setNoteError(null);
      setNoteNotice("Teams-friendly text copied.");
    } catch (err) {
      console.error(err);
      setNoteError("Clipboard write failed.");
    }
  };

  const handleCreateCheckinPerson = async () => {
    const name = checkinPersonForm.name.trim();
    if (!name) {
      setCheckinError("Person name is required.");
      return;
    }

    try {
      setCheckinError(null);
      setCheckinNotice(null);
      const created = await createCheckinPerson({
        name,
        relationship: checkinPersonForm.relationship
      });
      setCheckinPersonForm(emptyCheckinPersonForm());
      await refreshCheckinPeople();
      setSelectedPersonId(created.id);
      await refreshCheckins(created.id);
      setCheckinForm(emptyCheckinForm(created.id));
      setCheckinNotice(`Added ${created.name}.`);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setCheckinError(`Unable to add person: ${message}`);
    }
  };

  const handleDeleteSelectedPerson = async () => {
    if (!selectedPersonId) return;
    const selected = checkinPeople.find((person) => person.id === selectedPersonId);
    const confirmed = window.confirm(`Delete ${selected?.name ?? "this person"} and all related check-ins?`);
    if (!confirmed) return;

    try {
      setCheckinError(null);
      setCheckinNotice(null);
      await deleteCheckinPerson(selectedPersonId);
      const people = await refreshCheckinPeople();
      const nextPersonId = people[0]?.id ?? null;
      setSelectedPersonId(nextPersonId);
      await refreshCheckins(nextPersonId);
      setCheckinForm(emptyCheckinForm(nextPersonId));
      setCheckinNotice("Person removed.");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setCheckinError(`Unable to delete person: ${message}`);
    }
  };

  const handleSelectPerson = async (personId: string) => {
    setSelectedPersonId(personId);
    setEditingCheckinId(null);
    setCheckinNotice(null);
    setCheckinError(null);
    await refreshCheckins(personId);
    setCheckinForm(emptyCheckinForm(personId));
  };

  const handleEditLastCheckin = () => {
    if (!lastCheckin) return;
    setEditingCheckinId(lastCheckin.id);
    setCheckinNotice(null);
    setCheckinError(null);
    setCheckinForm(toCheckinFormFromExisting(lastCheckin));
  };

  const handleNewCheckin = () => {
    setEditingCheckinId(null);
    setCheckinNotice(null);
    setCheckinError(null);
    setCheckinForm(emptyCheckinForm(selectedPersonId));
  };

  const handleSaveCheckin = async () => {
    const personId = selectedPersonId || checkinForm.person_id || "";
    if (!personId) {
      setCheckinError("Select a person for this check-in.");
      return;
    }
    if (!checkinForm.checkin_date) {
      setCheckinError("Check-in date is required.");
      return;
    }

    const input = toCheckinInput({ ...checkinForm, person_id: personId });
    try {
      setCheckinError(null);
      setCheckinNotice(null);
      if (editingCheckinId) {
        await updateCheckin(editingCheckinId, input);
      } else {
        await createCheckin(input);
      }
      await refreshCheckins(personId);
      setEditingCheckinId(null);
      setCheckinForm(emptyCheckinForm(personId));
      setCheckinNotice(editingCheckinId ? "Check-in updated." : "Check-in saved.");
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : String(err);
      setCheckinError(`Unable to save check-in: ${message}`);
    }
  };

  const updateCheckinRow = (index: number, key: keyof CheckinTableRow, value: string) => {
    setCheckinForm((prev) => {
      const rows = [...prev.rows];
      rows[index] = { ...rows[index], [key]: value };
      return { ...prev, rows };
    });
  };

  const addCheckinRow = () => {
    setCheckinForm((prev) => ({
      ...prev,
      rows: [...prev.rows, { discussion: "", achieved: "", action: "" }]
    }));
  };

  const removeCheckinRow = (index: number) => {
    setCheckinForm((prev) => {
      const rows = prev.rows.filter((_, rowIndex) => rowIndex !== index);
      return {
        ...prev,
        rows: rows.length > 0 ? rows : [{ discussion: "", achieved: "", action: "" }]
      };
    });
  };

  const recurrenceLabel = (task: Task) => {
    if (!task.is_recurring || !task.recurrence_type) return null;
    if (task.recurrence_type === "daily") return "Daily";
    if (task.recurrence_type === "weekly") return "Weekly";
    if (task.recurrence_type === "monthly") return "Monthly";
    return null;
  };

  const todayIso = todayString();
  const isFutureTask = (task: Task, bucket: TaskBucket) => bucket === "upcoming" || task.target_date > todayIso;

  const currentDayTasks = [...overview.today, ...overview.rolled_over].sort((a, b) => a.sort_order - b.sort_order);
  const visibleTasks: DisplayTask[] = [
    ...currentDayTasks
      .filter((task) => task.status !== "done")
      .map((task) => ({ task, bucket: (task.rolled_over ? "rolled" : "today") as TaskBucket })),
    ...currentDayTasks
      .filter((task) => task.status === "done")
      .map((task) => ({ task, bucket: (task.rolled_over ? "rolled" : "today") as TaskBucket })),
    ...overview.upcoming.map((task) => ({ task, bucket: "upcoming" as TaskBucket }))
  ];
  const selectedNote = notes.find((note) => note.id === selectedNoteId) ?? null;
  const selectedPersonName = checkinPeople.find((person) => person.id === selectedPersonId)?.name ?? null;
  const lastCheckin = checkins[0] ?? null;
  const lastCheckinRows = lastCheckin ? buildCheckinRows(lastCheckin.discussion, lastCheckin.notes, lastCheckin.action_items) : [];
  const lastCheckinVisibleRows = lastCheckinRows.filter(
    (row) => row.discussion.trim() || row.achieved.trim() || row.action.trim()
  );
  const suggestedNextCheckinDate = computeNextCheckinDate(checkinForm.checkin_date, checkinForm.occurrence);
  const effectiveNextCheckinDate = checkinForm.next_checkin_date.trim() || suggestedNextCheckinDate;
  const unfiledNotes = useMemo(() => notes.filter((note) => !note.folder_id), [notes]);
  const notesByFolderId = useMemo(() => {
    const map: Record<string, Note[]> = {};
    noteFolders.forEach((folder) => {
      map[folder.id] = notes.filter((note) => note.folder_id === folder.id);
    });
    return map;
  }, [notes, noteFolders]);
  const folderKeys = useMemo(() => ["all", ...noteFolders.map((folder) => `folder:${folder.id}`)], [noteFolders]);

  useEffect(() => {
    setExpandedFolders((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of folderKeys) {
        if (!(key in next)) {
          next[key] = key === "all";
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [folderKeys]);

  useEffect(() => {
    if (!isCreatingFolder) return;
    createFolderInputRef.current?.focus();
  }, [isCreatingFolder]);

  useEffect(() => {
    if (!selectedPersonId) return;
    setCheckinForm((prev) => (prev.person_id === selectedPersonId ? prev : { ...prev, person_id: selectedPersonId }));
  }, [selectedPersonId]);

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return <div className="main">Loading DayRally...</div>;
  }

  const renderSection = (title: string, tasks: DisplayTask[]) => (
    <section className="task-panel">
      <div className="panel-title">{title}</div>
      {tasks.length === 0 ? (
        <div className="empty-state">No tasks.</div>
      ) : (
        <div className="task-rows">
          {tasks.map(({ task, bucket }, index) => {
            const isFuture = isFutureTask(task, bucket);
            const remainingSeconds = timers[task.id];
            const hasActiveTimer = remainingSeconds !== undefined || task.timer_state === "running";
            const showUpcomingDivider = bucket === "upcoming" && tasks[index - 1]?.bucket !== "upcoming";
            return (
              <Fragment key={task.id}>
                {showUpcomingDivider ? <div className="task-divider" aria-hidden="true" /> : null}
                <div
                  className={`task-row ${isFuture ? "is-disabled" : ""} ${bucket === "upcoming" ? "is-upcoming" : ""}`}
                >
                  <button
                    className={`check ${task.status === "done" ? "checked" : ""}`}
                    onClick={() => handleToggleDone(task)}
                    aria-label="Toggle task status"
                    disabled={isFuture}
                  />
                    <div className="task-main">
                      <div className={`task-title ${task.status === "done" ? "done" : ""}`}>{task.title}</div>
                      <div className="task-badges">
                      {bucket === "rolled" ? (
                        <span className="task-badge">
                          <AppIcon name="rollover" />
                          <span>Rolled Over</span>
                        </span>
                      ) : null}
                      {bucket === "upcoming" ? (
                        <span className="task-badge">
                          <AppIcon name="clock" />
                          <span>Upcoming {task.target_date}</span>
                        </span>
                      ) : null}
                      {recurrenceLabel(task) ? (
                        <span className="task-badge">
                          <AppIcon name="repeat" />
                          <span>{recurrenceLabel(task)}</span>
                        </span>
                      ) : null}
                      {task.timer_enabled ? (
                        <span className="task-badge">
                          <AppIcon name="clock" />
                          <span>{task.timer_minutes ?? 25}m</span>
                        </span>
                      ) : null}
                      {task.tags.map((tag) => (
                        <span
                          key={`${task.id}-tag-${tag}`}
                          className="task-badge"
                          style={taskTagBadgeStyle(tag, theme)}
                        >
                          <span>#{tag}</span>
                        </span>
                      ))}
                      <select
                        className={`task-status-pill ${taskStatusClassName(task.status)}`}
                        value={task.status}
                        onChange={(event) => void handleSetStatus(task, event.target.value as TaskStatus)}
                        disabled={isFuture}
                        aria-label="Task status"
                        title="Task status"
                      >
                        <option value="todo">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="skipped">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>
                  <div className="task-actions">
                    {task.timer_enabled ? (
                      hasActiveTimer ? (
                        <>
                          <span className="timer-badge">{formatSeconds(Math.max(0, remainingSeconds ?? 0))}</span>
                          <button
                            className="icon-btn timer-btn"
                            onClick={() => handleStopTimer(task)}
                            title="Stop timer"
                            aria-label="Stop timer"
                            disabled={isFuture}
                          >
                            <AppIcon name="stop" />
                          </button>
                        </>
                      ) : (
                        <button
                          className="icon-btn timer-btn"
                          onClick={() => handleStartTimer(task)}
                          title="Start timer"
                          aria-label="Start timer"
                          disabled={isFuture}
                        >
                          <AppIcon name="play" />
                        </button>
                      )
                    ) : null}
                    <div className="move-group">
                      <button className="icon-btn move-btn" onClick={() => handleMoveTask(task, "up")} title="Move up" aria-label="Move task up" disabled={isFuture}>
                        <AppIcon name="up" />
                      </button>
                      <button className="icon-btn move-btn" onClick={() => handleMoveTask(task, "down")} title="Move down" aria-label="Move task down" disabled={isFuture}>
                        <AppIcon name="down" />
                      </button>
                    </div>
                    <button className="icon-btn" onClick={() => openEditTaskModal(task)} title="Edit task" aria-label="Edit task">
                      <AppIcon name="edit" />
                    </button>
                    <button className="icon-btn danger" onClick={() => handleDeleteTask(task)} title="Delete task" aria-label="Delete task">
                      <AppIcon name="trash" />
                    </button>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <h2 className="logo">DayRally</h2>
          <div className="tagline">Momentum for today.</div>
        </div>
        <nav className="nav">
          <button className={view === "today" ? "active" : ""} onClick={() => navigateToView("today")}>
            <AppIcon name="today" />
            <span>Today</span>
          </button>
          <button className={view === "checkins" ? "active" : ""} onClick={() => navigateToView("checkins")}>
            <AppIcon name="checkins" />
            <span>Check-ins</span>
          </button>
          <button className={view === "notes" ? "active" : ""} onClick={() => navigateToView("notes")}>
            <AppIcon name="notes" />
            <span>Notes</span>
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={() => navigateToView("settings")}>
            <AppIcon name="settings" />
            <span>Settings</span>
          </button>
        </nav>

        {view === "notes" ? (
          <section className="notes-sidebar">
            <div className="notes-sidebar-header">
              <span className="notes-sidebar-title">
                <AppIcon name="folder" />
                <span>Folders</span>
              </span>
              <div className="notes-sidebar-actions">
                <button className="folder-add-btn note-add-btn" onClick={handleCreateNote} title="New note" aria-label="Create note">
                  <AppIcon name="compose" />
                </button>
                <button className="folder-add-btn" onClick={beginCreateFolder} title="Create folder" aria-label="Create folder">
                  <AppIcon name="plus" />
                </button>
              </div>
            </div>

            {isCreatingFolder ? (
              <div className="folder-create-row">
                <input
                  ref={createFolderInputRef}
                  className="folder-create-input"
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateFolder();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      cancelCreateFolder();
                    }
                  }}
                  placeholder="Folder name"
                />
                <button className="folder-create-action" onClick={handleCreateFolder}>
                  Add
                </button>
                <button className="folder-create-action secondary" onClick={cancelCreateFolder}>
                  Cancel
                </button>
              </div>
            ) : null}

            <div className="notes-sidebar-tree">
              <div className="notes-folder">
                <button
                  className="notes-folder-header"
                  onClick={() => toggleFolder("all")}
                  aria-expanded={expandedFolders.all ?? true}
                >
                  <span className={`folder-caret ${expandedFolders.all ?? true ? "open" : ""}`}>▸</span>
                  <span className="folder-label">
                    <AppIcon name="stack" className="folder-label-icon" />
                    <span>All Notes</span>
                  </span>
                  <span className="folder-count">{notes.length}</span>
                </button>
                {expandedFolders.all ?? true ? (
                  <div className="notes-folder-children">
                    {unfiledNotes.length > 0 ? (
                      <div className="notes-list">
                        {unfiledNotes.map((note) => (
                          <button
                            key={`unfiled:${note.id}`}
                            className={`note-item ${selectedNoteId === note.id ? "active" : ""}`}
                            onClick={() => handleSelectNote(note.id)}
                          >
                            <span className="note-item-title">{note.title || "Untitled note"}</span>
                            <span className="note-item-time">{shortUpdatedLabel(note.updated_at)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {noteFolders.map((folder) => {
                      const key = `folder:${folder.id}`;
                      const folderNotes = notesByFolderId[folder.id] ?? [];
                      const expanded = expandedFolders[key] ?? false;
                      return (
                        <div key={key} className="notes-folder notes-folder-nested">
                          <div className="notes-folder-header-row">
                            <button className="notes-folder-header" onClick={() => toggleFolder(key)} aria-expanded={expanded}>
                              <span className={`folder-caret ${expanded ? "open" : ""}`}>▸</span>
                              <span className="folder-label">
                                <AppIcon name="folder" className="folder-label-icon" />
                                <span>{folder.name}</span>
                              </span>
                              <span className="folder-count">{folderNotes.length}</span>
                            </button>
                            <button
                              className="folder-delete-btn"
                              onClick={() => void handleDeleteFolder(folder)}
                              title="Delete folder"
                              aria-label={`Delete folder ${folder.name}`}
                            >
                              <AppIcon name="close" />
                            </button>
                          </div>
                          {expanded ? (
                            <div className="notes-list">
                              {folderNotes.map((note) => (
                                <button
                                  key={`${key}:${note.id}`}
                                  className={`note-item ${selectedNoteId === note.id ? "active" : ""}`}
                                  onClick={() => handleSelectNote(note.id)}
                                >
                                  <span className="note-item-title">{note.title || "Untitled note"}</span>
                                  <span className="note-item-time">{shortUpdatedLabel(note.updated_at)}</span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {notes.length === 0 ? (
                      <div className="notes-tree-empty">No notes yet.</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </aside>

      <main className="main">
        {view === "today" ? (
          <>
            <section className="page-header">
              <div>
                <div className="eyebrow">DayRally</div>
                <h1>Today</h1>
                <p>{todayLabel}</p>
              </div>
              <div className="header-actions">
                <button className="primary" onClick={openCreateTaskModal}>+ Add Task</button>
              </div>
            </section>

            {taskNotice ? <div className="notice" style={{ marginBottom: "18px" }}>{taskNotice}</div> : null}

            {renderSection("Today", visibleTasks)}
          </>
        ) : view === "checkins" ? (
          <>
            <section className="page-header">
              <div>
                <div className="eyebrow">DayRally</div>
                <h1>Check-ins</h1>
                <p>Quickly capture discussion, actions, reminders, and what was achieved.</p>
              </div>
            </section>

            {checkinError ? <div className="notice" style={{ marginBottom: "10px" }}>{checkinError}</div> : null}
            {checkinNotice ? <div className="notice" style={{ marginBottom: "10px" }}>{checkinNotice}</div> : null}

            <section className="card checkins-redesign">
              <div className="checkins-topbar">
                <div className="checkins-person-field">
                  <label className="path">Person</label>
                  <select
                    value={selectedPersonId ?? ""}
                    onChange={(event) => {
                      const personId = event.target.value;
                      if (!personId) {
                        setSelectedPersonId(null);
                        setEditingCheckinId(null);
                        setCheckins([]);
                        setCheckinForm((prev) => ({ ...prev, person_id: "" }));
                        return;
                      }
                      void handleSelectPerson(personId);
                    }}
                  >
                    <option value="">Select person</option>
                    {checkinPeople.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name} ({person.relationship})
                      </option>
                    ))}
                  </select>
                </div>
                <button className="secondary" onClick={() => navigateToView("settings")}>
                  Manage People
                </button>
              </div>

              {selectedPersonId ? (
                <>
                  <section className="checkins-section-card">
                    <div className="checkins-section-head">
                      <div className="checkins-section-title">Schedule</div>
                      <div className="path">Suggested next: {suggestedNextCheckinDate || "Not scheduled"}</div>
                    </div>

                    <div className="checkins-compact-grid">
                      <div>
                        <label className="path">Check-in Date</label>
                        <input
                          type="date"
                          value={checkinForm.checkin_date}
                          onChange={(event) =>
                            setCheckinForm((prev) =>
                              patchCheckinFormWithAutoNextDate(prev, {
                                checkin_date: event.target.value
                              })
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="path">Repeat</label>
                        <select
                          value={checkinForm.occurrence}
                          onChange={(event) =>
                            setCheckinForm((prev) =>
                              patchCheckinFormWithAutoNextDate(prev, {
                                occurrence: event.target.value as CheckinFormState["occurrence"]
                              })
                            )
                          }
                        >
                          <option value="none">No repeat</option>
                          <option value="weekly">Weekly</option>
                          <option value="biweekly">Biweekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                      <div>
                        <label className="path">Next Check-in Date</label>
                        <input
                          type="date"
                          value={checkinForm.next_checkin_date}
                          onChange={(event) =>
                            setCheckinForm((prev) => ({
                              ...prev,
                              next_checkin_date: event.target.value
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="checkins-reminder-row">
                      <label className="checkins-checkbox">
                        <input
                          type="checkbox"
                          checked={checkinForm.reminder_enabled}
                          onChange={(event) =>
                            setCheckinForm((prev) => ({
                              ...prev,
                              reminder_enabled: event.target.checked
                            }))
                          }
                        />
                        <span>Enable reminder</span>
                      </label>
                      <input
                        type="time"
                        value={checkinForm.reminder_time}
                        disabled={!checkinForm.reminder_enabled || !effectiveNextCheckinDate}
                        onChange={(event) =>
                          setCheckinForm((prev) => ({
                            ...prev,
                            reminder_time: event.target.value
                          }))
                        }
                      />
                    </div>
                  </section>

                  <section className="checkins-section-card">
                    <div className="checkins-table-headline">
                      <div className="checkins-section-title">
                        {editingCheckinId ? "Editing Check-in" : "Check-in Table"}
                      </div>
                      <button className="secondary checkins-add-row" onClick={addCheckinRow}>
                        + Add row
                      </button>
                    </div>
                    <div className="checkins-table-wrap">
                      <div className="checkins-table">
                        <div className="checkins-table-head">
                          <span>Discussion points</span>
                          <span>What happened / achieved</span>
                          <span>Action items</span>
                          <span />
                        </div>
                        {checkinForm.rows.map((row, index) => (
                          <div className="checkins-table-row" key={`checkin-row-${index}`}>
                            <input
                              value={row.discussion}
                              onChange={(event) => updateCheckinRow(index, "discussion", event.target.value)}
                              placeholder={`Discussion ${index + 1}`}
                            />
                            <input
                              value={row.achieved}
                              onChange={(event) => updateCheckinRow(index, "achieved", event.target.value)}
                              placeholder={`Achieved ${index + 1}`}
                            />
                            <input
                              value={row.action}
                              onChange={(event) => updateCheckinRow(index, "action", event.target.value)}
                              placeholder={`Action ${index + 1}`}
                            />
                            <button
                              className="icon-btn"
                              onClick={() => removeCheckinRow(index)}
                              aria-label="Remove row"
                              title="Remove row"
                              disabled={checkinForm.rows.length <= 1}
                            >
                              <AppIcon name="close" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  <div className="checkins-primary-actions">
                    <button className="primary" onClick={handleSaveCheckin}>
                      {editingCheckinId ? "Update Check-in" : "Save Check-in"}
                    </button>
                    <button className="secondary" onClick={handleNewCheckin}>Reset</button>
                  </div>

                  <details className="checkins-last-details">
                    <summary className="checkins-last-summary">
                      <span>Last Check-in: {selectedPersonName ?? "Person"}</span>
                      <span className="path">
                        {lastCheckin
                          ? `${lastCheckin.checkin_date}${lastCheckin.next_checkin_date ? ` to ${lastCheckin.next_checkin_date}` : ""}`
                          : "No previous check-in yet"}
                      </span>
                    </summary>
                    {lastCheckin ? (
                      <div className="checkins-last-content">
                        <div className="checkins-last-actions">
                          <button className="secondary" onClick={handleEditLastCheckin}>
                            Edit Last Check-in
                          </button>
                        </div>
                        <div className="checkins-table checkins-table-readonly">
                          <div className="checkins-table-head">
                            <span>Discussion points</span>
                            <span>What happened / achieved</span>
                            <span>Action items</span>
                            <span />
                          </div>
                          {lastCheckinVisibleRows.length > 0 ? (
                            lastCheckinVisibleRows.map((row, index) => (
                              <div className="checkins-table-row" key={`last-checkin-row-${index}`}>
                                <div className="checkins-cell">{row.discussion}</div>
                                <div className="checkins-cell">{row.achieved}</div>
                                <div className="checkins-cell">{row.action}</div>
                                <div />
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">No discussion/action details.</div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </details>
                </>
              ) : (
                <div className="empty-state">Select a person to create a check-in. Add people in Settings.</div>
              )}
            </section>
          </>
        ) : view === "notes" ? (
          <>
            <section className="page-header">
              <div>
                <div className="eyebrow">DayRally</div>
                <h1>Notes</h1>
                <p>Write rich notes and paste screenshots directly into the document.</p>
              </div>
            </section>

            {noteError ? <div className="notice" style={{ marginBottom: "10px" }}>{noteError}</div> : null}
            {noteNotice ? <div className="notice" style={{ marginBottom: "10px" }}>{noteNotice}</div> : null}

            <section className="notes-grid">
              <div className="card notes-editor-card">
                {!selectedNote ? (
                  <div className="empty-state">Select a note or create one.</div>
                ) : (
                  <>
                    <div className="notes-fields">
                      <div>
                        <label className="path">Title</label>
                        <input
                          value={noteForm.title}
                          onChange={(event) => setNoteForm((prev) => ({ ...prev, title: event.target.value }))}
                          placeholder="Note title"
                        />
                      </div>
                      <div>
                        <label className="path">Tags (comma-separated)</label>
                        <input
                          value={noteForm.tags_text}
                          onChange={(event) => setNoteForm((prev) => ({ ...prev, tags_text: event.target.value }))}
                          placeholder="engineering, planning"
                        />
                      </div>
                      <div>
                        <label className="path">Folder</label>
                        <select
                          value={noteForm.folder_id ?? ""}
                          onChange={(event) =>
                            setNoteForm((prev) => ({
                              ...prev,
                              folder_id: event.target.value || null
                            }))
                          }
                        >
                          <option value="">Unfiled</option>
                          {noteFolders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="notes-editor-grid">
                      <div>
                        <label className="path">Document</label>
                        <div
                          ref={noteEditorRef}
                          className="note-editor-rich"
                          contentEditable
                          suppressContentEditableWarning
                          onPaste={handleNotePaste}
                          onDrop={handleNoteDrop}
                          onDragOver={(event) => event.preventDefault()}
                          dangerouslySetInnerHTML={{ __html: toEditableHtml(noteForm.body_markdown) }}
                        />
                      </div>
                    </div>

                    <div className="notes-actions">
                      <button className="primary" onClick={handleSaveNote}>Save</button>
                      <button className="secondary" onClick={handleCopyPlainText}>Copy Plain Text</button>
                      <button className="secondary" onClick={handleCopyTeamsFriendly}>Copy Teams Friendly</button>
                      <button className="secondary" onClick={handleDeleteNote}>Delete</button>
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="card">
              <h3 className="section-title">Workspace</h3>
              <div className="settings-grid">
                <div>
                  <div>Current workspace</div>
                  <div className="path">{settings.workspace_path ?? "Not set"}</div>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button className="primary" onClick={handleSelectWorkspace}>Change Workspace</button>
                  {settings.workspace_path ? (
                    <button className="secondary" onClick={() => openWorkspace(settings.workspace_path!)}>
                      Open Workspace in Finder
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="card">
              <h3 className="section-title">Notifications</h3>
              <div className="settings-grid">
                <div>
                  <div>Test banner delivery</div>
                  <div className="path">Use the buttons below, then enable Banners in macOS Settings.</div>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button className="secondary" onClick={handleTestNotification}>Test Notification</button>
                  <button className="secondary" onClick={openNotificationSettings}>Open Notification Settings</button>
                </div>
                {notificationHint ? <div className="notice">{notificationHint}</div> : null}
              </div>
            </section>

            <section className="card">
              <h3 className="section-title">Check-in People</h3>
              <div className="settings-grid">
                <div>
                  <div>Manage people used in check-ins</div>
                  <div className="path">Add or remove people here to keep the Check-ins page clean.</div>
                </div>
                <div className="checkin-people-settings">
                  <div>
                    <label className="path">Selected person</label>
                    <select
                      value={selectedPersonId ?? ""}
                      onChange={(event) => {
                        const personId = event.target.value;
                        if (!personId) {
                          setSelectedPersonId(null);
                          setEditingCheckinId(null);
                          setCheckins([]);
                          setCheckinForm((prev) => ({ ...prev, person_id: "" }));
                          return;
                        }
                        void handleSelectPerson(personId);
                      }}
                    >
                      <option value="">Select person</option>
                      {checkinPeople.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name} ({person.relationship})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="path">Name</label>
                    <input
                      value={checkinPersonForm.name}
                      onChange={(event) =>
                        setCheckinPersonForm((prev) => ({
                          ...prev,
                          name: event.target.value
                        }))
                      }
                      placeholder="Person name"
                    />
                  </div>
                  <div>
                    <label className="path">Relationship</label>
                    <select
                      value={checkinPersonForm.relationship}
                      onChange={(event) =>
                        setCheckinPersonForm((prev) => ({
                          ...prev,
                          relationship: event.target.value as CheckinRelationship
                        }))
                      }
                    >
                      <option value="manager">manager</option>
                      <option value="report">report</option>
                      <option value="peer">peer</option>
                    </select>
                  </div>
                  <div className="checkin-people-actions">
                    <button className="secondary" onClick={handleCreateCheckinPerson}>Add Person</button>
                    <button className="secondary" onClick={handleDeleteSelectedPerson} disabled={!selectedPersonId}>
                      Delete Selected
                    </button>
                  </div>
                </div>
                {checkinError ? <div className="notice">{checkinError}</div> : null}
                {checkinNotice ? <div className="notice">{checkinNotice}</div> : null}
              </div>
            </section>

            <section className="card">
              <h3 className="section-title">Appearance</h3>
              <div className="settings-grid">
                <div>
                  <div>Theme</div>
                  <div className="path">Switch between light and dark mode.</div>
                </div>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <button className="secondary" onClick={toggleTheme}>
                    {theme === "dark" ? "Use Light Mode" : "Use Dark Mode"}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {showTaskModal ? (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingTask ? "Edit Task" : "Add Task"}</h2>
              <button className="icon-btn" onClick={() => setShowTaskModal(false)} aria-label="Close dialog" title="Close">
                <AppIcon name="close" />
              </button>
            </div>
            <div className="settings-grid">
              <label className="path">Title</label>
              <input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Task title"
              />

              <label className="path">Date</label>
              <input
                type="date"
                value={taskForm.target_date}
                onChange={(e) => setTaskForm({ ...taskForm, target_date: e.target.value })}
              />

              <label className="path">Notes</label>
              <textarea
                value={taskForm.notes}
                onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                placeholder="Optional notes"
              />

              <label className="path">Tags (comma-separated)</label>
              <input
                value={taskForm.tags_text}
                onChange={(e) => setTaskForm({ ...taskForm, tags_text: e.target.value })}
                placeholder="work, follow-up, personal"
                list="task-tag-options"
              />
              <datalist id="task-tag-options">
                {taskTags.map((tag) => (
                  <option key={`task-tag-option-${tag}`} value={tag} />
                ))}
              </datalist>

              <label className="path">Deadline</label>
              <input
                type="datetime-local"
                value={taskForm.deadline_local}
                onChange={(e) => setTaskForm({ ...taskForm, deadline_local: e.target.value })}
              />

              <label className="path">Status</label>
              <select
                value={taskForm.status}
                onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}
              >
                <option value="todo">New</option>
                <option value="in_progress">In Progress</option>
                <option value="skipped">Blocked</option>
                <option value="done">Done</option>
              </select>

              <label className="path">Recurring</label>
              <div>
                <input
                  type="checkbox"
                  checked={taskForm.is_recurring}
                  onChange={(e) => setTaskForm({ ...taskForm, is_recurring: e.target.checked })}
                />
              </div>

              {taskForm.is_recurring ? (
                <>
                  <label className="path">Type</label>
                  <select
                    value={taskForm.recurrence_type}
                    onChange={(e) =>
                      setTaskForm({ ...taskForm, recurrence_type: e.target.value as RecurrenceType })
                    }
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>

                  <label className="path">Interval</label>
                  <input
                    type="number"
                    min={1}
                    value={taskForm.recurrence_interval}
                    onChange={(e) => setTaskForm({ ...taskForm, recurrence_interval: Number(e.target.value) || 1 })}
                  />

                  {taskForm.recurrence_type === "weekly" ? (
                    <>
                      <label className="path">Weekdays</label>
                      <div className="weekday-grid">
                        {WEEKDAYS.map((day) => (
                          <label key={day} className="path" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <input
                              type="checkbox"
                              checked={taskForm.recurrence_weekdays.includes(day)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTaskForm({
                                    ...taskForm,
                                    recurrence_weekdays: [...taskForm.recurrence_weekdays, day]
                                  });
                                } else {
                                  setTaskForm({
                                    ...taskForm,
                                    recurrence_weekdays: taskForm.recurrence_weekdays.filter((d) => d !== day)
                                  });
                                }
                              }}
                            />
                            {day}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}

              <label className="path">Timer</label>
              <div>
                <input
                  type="checkbox"
                  checked={taskForm.timer_enabled}
                  onChange={(e) => setTaskForm({ ...taskForm, timer_enabled: e.target.checked })}
                />
              </div>

              {taskForm.timer_enabled ? (
                <>
                  <label className="path">Minutes</label>
                  <input
                    type="number"
                    min={1}
                    value={taskForm.timer_minutes}
                    onChange={(e) => setTaskForm({ ...taskForm, timer_minutes: Number(e.target.value) || 1 })}
                  />
                </>
              ) : null}
            </div>
            <div className="modal-actions" style={{ marginTop: "16px" }}>
              <button className="secondary" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button className="primary" onClick={handleSaveTask}>Save</button>
            </div>
          </div>
        </div>
      ) : null}

      {needsWorkspace ? (
        <div className="modal-backdrop">
          <div className="modal">
            <h2>Choose your workspace</h2>
            <p>
              DayRally stores your database and attachments in a folder you control. Select
              or create one to continue.
            </p>
            {error ? <div className="notice">{error}</div> : null}
            <div className="modal-actions">
              <button className="primary" onClick={handleSelectWorkspace}>Select Workspace</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

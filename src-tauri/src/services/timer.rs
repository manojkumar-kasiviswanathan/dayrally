use chrono::{DateTime, Local};
use std::{collections::HashMap, sync::Mutex};

#[derive(Debug, Clone)]
pub struct TimerEntry {
    pub task_id: String,
    pub title: String,
    pub ends_at: DateTime<Local>,
}

#[derive(Default)]
pub struct TimerState {
    pub timers: Mutex<HashMap<String, TimerEntry>>,
}

impl TimerState {
    pub fn upsert(&self, entry: TimerEntry) {
        let mut guard = self.timers.lock().expect("timer mutex");
        guard.insert(entry.task_id.clone(), entry);
    }

    pub fn remove(&self, task_id: &str) {
        let mut guard = self.timers.lock().expect("timer mutex");
        guard.remove(task_id);
    }

    pub fn list(&self) -> Vec<TimerEntry> {
        let guard = self.timers.lock().expect("timer mutex");
        guard.values().cloned().collect()
    }

    pub fn get(&self, task_id: &str) -> Option<TimerEntry> {
        let guard = self.timers.lock().expect("timer mutex");
        guard.get(task_id).cloned()
    }
}

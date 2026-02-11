use chrono::Utc;
use std::{fs, path::Path};

#[derive(Debug, Clone)]
pub struct StoredAttachment {
    pub filename: String,
    pub path_relative: String,
}

pub fn save_note_image(
    workspace: &Path,
    note_id: &str,
    bytes: &[u8],
) -> Result<StoredAttachment, String> {
    if bytes.is_empty() {
        return Err("Attachment is empty".to_string());
    }

    let note_dir = workspace.join("attachments").join(note_id);
    fs::create_dir_all(&note_dir).map_err(|err| err.to_string())?;

    let filename = format!("{}.png", Utc::now().format("%Y%m%d%H%M%S%3f"));
    let full_path = note_dir.join(&filename);
    fs::write(&full_path, bytes).map_err(|err| err.to_string())?;

    let path_relative = format!("attachments/{}/{}", note_id, filename);
    Ok(StoredAttachment {
        filename,
        path_relative,
    })
}

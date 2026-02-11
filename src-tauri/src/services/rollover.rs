use chrono::{Datelike, Local, NaiveDate};

pub fn today_date() -> NaiveDate {
    let now = Local::now();
    NaiveDate::from_ymd_opt(now.year(), now.month(), now.day()).unwrap()
}

pub fn should_rollover(target_date: &str, status: &str, today: NaiveDate) -> Result<bool, String> {
    let date = NaiveDate::parse_from_str(target_date, "%Y-%m-%d").map_err(|e| e.to_string())?;
    Ok(date < today && status != "done")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rollover_for_past_todo() {
        let today = NaiveDate::from_ymd_opt(2026, 2, 6).unwrap();
        let should = should_rollover("2026-02-05", "todo", today).unwrap();
        assert!(should);
    }

    #[test]
    fn no_rollover_for_done() {
        let today = NaiveDate::from_ymd_opt(2026, 2, 6).unwrap();
        let should = should_rollover("2026-02-05", "done", today).unwrap();
        assert!(!should);
    }
}

use chrono::{Datelike, Duration, Local, NaiveDate, Weekday};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "freq", rename_all = "lowercase")]
pub enum RecurrenceRule {
    Daily {
        interval: i64,
    },
    Weekly {
        interval: i64,
        weekdays: Option<Vec<WeekdayRule>>,
    },
    Monthly {
        interval: i64,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WeekdayRule {
    Mon,
    Tue,
    Wed,
    Thu,
    Fri,
    Sat,
    Sun,
}

impl WeekdayRule {
    pub fn from_weekday(value: Weekday) -> Self {
        match value {
            Weekday::Mon => WeekdayRule::Mon,
            Weekday::Tue => WeekdayRule::Tue,
            Weekday::Wed => WeekdayRule::Wed,
            Weekday::Thu => WeekdayRule::Thu,
            Weekday::Fri => WeekdayRule::Fri,
            Weekday::Sat => WeekdayRule::Sat,
            Weekday::Sun => WeekdayRule::Sun,
        }
    }

    pub fn to_weekday(&self) -> Weekday {
        match self {
            WeekdayRule::Mon => Weekday::Mon,
            WeekdayRule::Tue => Weekday::Tue,
            WeekdayRule::Wed => Weekday::Wed,
            WeekdayRule::Thu => Weekday::Thu,
            WeekdayRule::Fri => Weekday::Fri,
            WeekdayRule::Sat => Weekday::Sat,
            WeekdayRule::Sun => Weekday::Sun,
        }
    }
}

pub fn parse_rule(value: &str) -> Result<RecurrenceRule, String> {
    serde_json::from_str(value).map_err(|err| err.to_string())
}

pub fn next_occurrence(rule: &RecurrenceRule, from: NaiveDate) -> NaiveDate {
    match rule {
        RecurrenceRule::Daily { interval } => from + Duration::days(*interval),
        RecurrenceRule::Weekly { interval, weekdays } => {
            let start = from + Duration::days(1);
            let allowed: Vec<Weekday> = weekdays
                .clone()
                .unwrap_or_else(|| vec![WeekdayRule::from_weekday(from.weekday())])
                .into_iter()
                .map(|w| w.to_weekday())
                .collect();
            let mut date = start;
            loop {
                if allowed.contains(&date.weekday()) {
                    return date;
                }
                date += Duration::days(1);
                if (date - from).num_days() >= 7 * interval {
                    return date;
                }
            }
        }
        RecurrenceRule::Monthly { interval } => {
            let mut year = from.year();
            let mut month = from.month() as i64 + interval;
            while month > 12 {
                year += 1;
                month -= 12;
            }
            let month = month as u32;
            let day = from.day();
            NaiveDate::from_ymd_opt(year, month, day)
                .or_else(|| {
                    NaiveDate::from_ymd_opt(year, month + 1, 1).map(|d| d - Duration::days(1))
                })
                .unwrap_or(from)
        }
    }
}

pub fn today_date() -> NaiveDate {
    let now = Local::now();
    NaiveDate::from_ymd_opt(now.year(), now.month(), now.day()).unwrap()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn daily_next_occurrence() {
        let rule = RecurrenceRule::Daily { interval: 1 };
        let start = NaiveDate::from_ymd_opt(2026, 2, 6).unwrap();
        assert_eq!(
            next_occurrence(&rule, start),
            NaiveDate::from_ymd_opt(2026, 2, 7).unwrap()
        );
    }

    #[test]
    fn weekly_with_weekdays() {
        let rule = RecurrenceRule::Weekly {
            interval: 1,
            weekdays: Some(vec![WeekdayRule::Mon, WeekdayRule::Wed]),
        };
        let start = NaiveDate::from_ymd_opt(2026, 2, 6).unwrap();
        let next = next_occurrence(&rule, start);
        assert!(next.weekday() == Weekday::Mon || next.weekday() == Weekday::Wed);
    }

    #[test]
    fn monthly_clamps_to_end_of_month() {
        let rule = RecurrenceRule::Monthly { interval: 1 };
        let start = NaiveDate::from_ymd_opt(2026, 1, 31).unwrap();
        let next = next_occurrence(&rule, start);
        assert_eq!(next.month(), 2);
    }
}

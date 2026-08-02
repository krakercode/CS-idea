use chrono::Utc;
use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use serde_json::Value;
use std::path::Path;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

#[derive(Debug, Serialize, Clone)]
pub struct Snapshot {
    pub fetched_at: String,
    pub rating: Value,
    pub ranks: Value,
}

fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id TEXT NOT NULL,
            fetched_at TEXT NOT NULL,
            rating_json TEXT NOT NULL,
            ranks_json TEXT NOT NULL
        )",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_snapshots_player ON snapshots(player_id, fetched_at)",
        [],
    )?;
    Ok(())
}

pub fn open(data_dir: &Path) -> rusqlite::Result<Db> {
    std::fs::create_dir_all(data_dir).ok();
    let conn = Connection::open(data_dir.join("stats.db"))?;
    init_schema(&conn)?;
    Ok(Db(Mutex::new(conn)))
}

pub fn insert_snapshot(
    db: &Db,
    player_id: &str,
    rating: &Value,
    ranks: &Value,
) -> rusqlite::Result<()> {
    let conn = db.0.lock().expect("db mutex poisoned");

    let rating_json = rating.to_string();
    let ranks_json = ranks.to_string();

    // Skip the write if it's identical to this player's last snapshot -
    // re-checking your own stats repeatedly (this app's whole use case)
    // shouldn't grow the table by a row every time nothing actually changed.
    let last: Option<(String, String)> = conn
        .query_row(
            "SELECT rating_json, ranks_json FROM snapshots
             WHERE player_id = ?1 ORDER BY fetched_at DESC LIMIT 1",
            rusqlite::params![player_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    if last == Some((rating_json.clone(), ranks_json.clone())) {
        return Ok(());
    }

    conn.execute(
        "INSERT INTO snapshots (player_id, fetched_at, rating_json, ranks_json) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![player_id, Utc::now().to_rfc3339(), rating_json, ranks_json],
    )?;
    Ok(())
}

pub fn get_latest(db: &Db, player_id: &str) -> rusqlite::Result<Option<Snapshot>> {
    let conn = db.0.lock().expect("db mutex poisoned");
    conn.query_row(
        "SELECT fetched_at, rating_json, ranks_json FROM snapshots
         WHERE player_id = ?1 ORDER BY fetched_at DESC LIMIT 1",
        rusqlite::params![player_id],
        |row| {
            let fetched_at: String = row.get(0)?;
            let rating_str: String = row.get(1)?;
            let ranks_str: String = row.get(2)?;
            Ok(Snapshot {
                fetched_at,
                rating: serde_json::from_str(&rating_str).unwrap_or(Value::Null),
                ranks: serde_json::from_str(&ranks_str).unwrap_or(Value::Null),
            })
        },
    )
    .optional()
}

/// Caps how far back the trend chart looks - without this, a player who
/// re-checks their own stats routinely (this app's exact use case) grows an
/// unbounded query result and JSON payload forever.
const MAX_TREND_ROWS: i64 = 180;

pub fn get_trend(db: &Db, player_id: &str) -> rusqlite::Result<Vec<Snapshot>> {
    let conn = db.0.lock().expect("db mutex poisoned");
    let mut stmt = conn.prepare(
        "SELECT fetched_at, rating_json, ranks_json FROM (
            SELECT fetched_at, rating_json, ranks_json FROM snapshots
            WHERE player_id = ?1 ORDER BY fetched_at DESC LIMIT ?2
         ) ORDER BY fetched_at ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![player_id, MAX_TREND_ROWS], |row| {
        let fetched_at: String = row.get(0)?;
        let rating_str: String = row.get(1)?;
        let ranks_str: String = row.get(2)?;
        Ok(Snapshot {
            fetched_at,
            rating: serde_json::from_str(&rating_str).unwrap_or(Value::Null),
            ranks: serde_json::from_str(&ranks_str).unwrap_or(Value::Null),
        })
    })?;
    rows.collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn open_in_memory() -> Db {
        let conn = Connection::open_in_memory().expect("open in-memory sqlite");
        init_schema(&conn).expect("init schema");
        Db(Mutex::new(conn))
    }

    #[test]
    fn insert_snapshot_skips_exact_duplicate() {
        let db = open_in_memory();
        insert_snapshot(&db, "p1", &json!({"a": 1}), &json!({"b": 2})).unwrap();
        insert_snapshot(&db, "p1", &json!({"a": 1}), &json!({"b": 2})).unwrap();
        assert_eq!(get_trend(&db, "p1").unwrap().len(), 1);
    }

    #[test]
    fn insert_snapshot_writes_when_changed() {
        let db = open_in_memory();
        insert_snapshot(&db, "p1", &json!({"a": 1}), &json!({"b": 2})).unwrap();
        insert_snapshot(&db, "p1", &json!({"a": 2}), &json!({"b": 2})).unwrap();
        assert_eq!(get_trend(&db, "p1").unwrap().len(), 2);
    }

    #[test]
    fn get_trend_caps_to_most_recent_rows() {
        let db = open_in_memory();
        let total = MAX_TREND_ROWS + 20;
        {
            let conn = db.0.lock().unwrap();
            for i in 0..total {
                conn.execute(
                    "INSERT INTO snapshots (player_id, fetched_at, rating_json, ranks_json) VALUES (?1, ?2, ?3, ?4)",
                    rusqlite::params![
                        "p1",
                        format!("2024-01-01T00:{:02}:{:02}Z", (i / 60) % 60, i % 60),
                        json!({ "n": i }).to_string(),
                        json!({}).to_string(),
                    ],
                )
                .unwrap();
            }
        }

        let trend = get_trend(&db, "p1").unwrap();
        assert_eq!(trend.len() as i64, MAX_TREND_ROWS);
        // Keeps the most recent rows, still returned oldest-first.
        assert_eq!(trend.first().unwrap().rating["n"].as_i64().unwrap(), total - MAX_TREND_ROWS);
        assert_eq!(trend.last().unwrap().rating["n"].as_i64().unwrap(), total - 1);
    }
}

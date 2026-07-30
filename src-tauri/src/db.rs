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

pub fn open(data_dir: &Path) -> rusqlite::Result<Db> {
    std::fs::create_dir_all(data_dir).ok();
    let conn = Connection::open(data_dir.join("stats.db"))?;
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
    Ok(Db(Mutex::new(conn)))
}

pub fn insert_snapshot(
    db: &Db,
    player_id: &str,
    rating: &Value,
    ranks: &Value,
) -> rusqlite::Result<()> {
    let conn = db.0.lock().expect("db mutex poisoned");
    conn.execute(
        "INSERT INTO snapshots (player_id, fetched_at, rating_json, ranks_json) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            player_id,
            Utc::now().to_rfc3339(),
            rating.to_string(),
            ranks.to_string(),
        ],
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

pub fn get_trend(db: &Db, player_id: &str) -> rusqlite::Result<Vec<Snapshot>> {
    let conn = db.0.lock().expect("db mutex poisoned");
    let mut stmt = conn.prepare(
        "SELECT fetched_at, rating_json, ranks_json FROM snapshots
         WHERE player_id = ?1 ORDER BY fetched_at ASC",
    )?;
    let rows = stmt.query_map(rusqlite::params![player_id], |row| {
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

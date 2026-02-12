use rusqlite::{Connection, params};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

const CURRENT_SCHEMA_VERSION: i32 = 1;

pub struct ConfigDB {
    conn: Mutex<Connection>,
}

impl ConfigDB {
    pub fn new() -> Result<Self, String> {
        let path = Self::db_path()?;

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(&path).map_err(|e| e.to_string())?;

        // Enable WAL mode for better concurrent read/write performance
        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| e.to_string())?;

        Self::run_migrations(&conn)?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    fn run_migrations(conn: &Connection) -> Result<(), String> {
        // Ensure the schema_version table exists
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_version (
                version INTEGER NOT NULL
            );"
        ).map_err(|e| e.to_string())?;

        let current_version: i32 = conn
            .query_row("SELECT COALESCE(MAX(version), 0) FROM schema_version", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;

        if current_version < 1 {
            conn.execute_batch(
                "CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );"
            ).map_err(|e| e.to_string())?;
        }

        // Future migrations go here:
        // if current_version < 2 { ... }

        if current_version < CURRENT_SCHEMA_VERSION {
            conn.execute(
                "INSERT OR REPLACE INTO schema_version (rowid, version) VALUES (1, ?1)",
                params![CURRENT_SCHEMA_VERSION],
            ).map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    fn db_path() -> Result<PathBuf, String> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| "Could not find data directory".to_string())?;
        Ok(data_dir.join("k0").join("config.db"))
    }

    pub fn get(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT value FROM config WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![key], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(val)) => Ok(Some(val)),
            Some(Err(e)) => Err(e.to_string()),
            None => Ok(None),
        }
    }

    pub fn set(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            params![key, value],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete(&self, key: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM config WHERE key = ?1",
            params![key],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_all(&self) -> Result<HashMap<String, String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT key, value FROM config")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        for row in rows {
            let (k, v) = row.map_err(|e| e.to_string())?;
            map.insert(k, v);
        }
        Ok(map)
    }
}

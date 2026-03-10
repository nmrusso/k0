use rusqlite::{Connection, params};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

const CURRENT_SCHEMA_VERSION: i32 = 1;

/// Marker stored in SQLite to indicate a value lives in the OS keychain.
const KEYCHAIN_MARKER: &str = "[keychain]";

/// Keychain service identifier used for all k0 secrets.
const KEYCHAIN_SERVICE: &str = "k0";

/// Returns true for keys whose values must be stored in the OS keychain.
fn is_sensitive(key: &str) -> bool {
    key.contains("_api_key")
}

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
        let db_name = if cfg!(debug_assertions) {
            "config.dev.db"
        } else {
            "config.db"
        };
        Ok(data_dir.join("k0").join(db_name))
    }

    fn keychain_entry(key: &str) -> Result<keyring::Entry, String> {
        keyring::Entry::new(KEYCHAIN_SERVICE, key).map_err(|e| e.to_string())
    }

    pub fn get(&self, key: &str) -> Result<Option<String>, String> {
        if is_sensitive(key) {
            return self.get_sensitive(key);
        }

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

    /// Reads a sensitive key: fetches from OS keychain.
    /// If a legacy plaintext value is found in SQLite, migrates it automatically.
    fn get_sensitive(&self, key: &str) -> Result<Option<String>, String> {
        // Read what's in SQLite for this key
        let sqlite_val = {
            let conn = self.conn.lock().map_err(|e| e.to_string())?;
            let mut stmt = conn
                .prepare("SELECT value FROM config WHERE key = ?1")
                .map_err(|e| e.to_string())?;
            let mut rows = stmt
                .query_map(params![key], |row| row.get::<_, String>(0))
                .map_err(|e| e.to_string())?;
            match rows.next() {
                Some(Ok(val)) => Some(val),
                Some(Err(e)) => return Err(e.to_string()),
                None => None,
            }
        };

        match sqlite_val.as_deref() {
            None => Ok(None),
            Some(KEYCHAIN_MARKER) => {
                // Normal path: value is in keychain
                match Self::keychain_entry(key)?.get_password() {
                    Ok(secret) => Ok(Some(secret)),
                    Err(keyring::Error::NoEntry) => Ok(None),
                    Err(e) => Err(format!("Keychain read error: {}", e)),
                }
            }
            Some(legacy_plaintext) => {
                // Migration path: value was stored in plaintext before this fix.
                // Move it to the keychain and replace SQLite value with the marker.
                let secret = legacy_plaintext.to_owned();
                Self::keychain_entry(key)?.set_password(&secret).map_err(|e| e.to_string())?;
                let conn = self.conn.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
                    params![key, KEYCHAIN_MARKER],
                ).map_err(|e| e.to_string())?;
                Ok(Some(secret))
            }
        }
    }

    pub fn set(&self, key: &str, value: &str) -> Result<(), String> {
        if is_sensitive(key) {
            // Store the actual value in the OS keychain
            Self::keychain_entry(key)?.set_password(value).map_err(|e| {
                format!("Keychain write error: {}. Make sure an OS keychain (Secret Service, Keychain, or Credential Manager) is available.", e)
            })?;
            // Store a marker in SQLite so we know the key exists
            let conn = self.conn.lock().map_err(|e| e.to_string())?;
            conn.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
                params![key, KEYCHAIN_MARKER],
            ).map_err(|e| e.to_string())?;
            return Ok(());
        }

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR REPLACE INTO config (key, value) VALUES (?1, ?2)",
            params![key, value],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete(&self, key: &str) -> Result<(), String> {
        if is_sensitive(key) {
            // Remove from keychain (ignore if not present)
            match Self::keychain_entry(key)?.delete_credential() {
                Ok(_) | Err(keyring::Error::NoEntry) => {}
                Err(e) => return Err(format!("Keychain delete error: {}", e)),
            }
        }

        // Remove marker / value from SQLite
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM config WHERE key = ?1",
            params![key],
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Returns all config entries. Sensitive keys show "[stored securely]" instead of their value.
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
            // Never expose the raw keychain marker to the frontend
            let display_value = if v == KEYCHAIN_MARKER {
                "[stored securely]".to_owned()
            } else {
                v
            };
            map.insert(k, display_value);
        }
        Ok(map)
    }
}

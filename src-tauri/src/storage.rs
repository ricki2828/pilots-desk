use chrono::{DateTime, Utc};
use log::{debug, error, info};
use rusqlite::{params, Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

/// Transcript segment stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptSegment {
    pub id: String,
    pub call_id: String,
    pub timestamp: DateTime<Utc>,
    pub text: String,
    pub confidence: f32,
    pub speaker: String, // "agent" or "customer"
}

/// Call metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallMetadata {
    pub id: String,
    pub agent_id: String,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub script_version: String,
}

/// Local storage manager using SQLite
pub struct Storage {
    conn: Connection,
}

impl Storage {
    /// Create new storage instance
    pub fn new(db_path: PathBuf) -> SqliteResult<Self> {
        let conn = Connection::open(db_path)?;
        let storage = Self { conn };
        storage.init_schema()?;
        info!("Storage initialized");
        Ok(storage)
    }

    /// Initialize database schema
    fn init_schema(&self) -> SqliteResult<()> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS calls (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                script_version TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS transcripts (
                id TEXT PRIMARY KEY,
                call_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                text TEXT NOT NULL,
                confidence REAL NOT NULL,
                speaker TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (call_id) REFERENCES calls(id)
            )",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transcripts_call_id ON transcripts(call_id)",
            [],
        )?;

        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transcripts_timestamp ON transcripts(timestamp)",
            [],
        )?;

        debug!("Database schema initialized");
        Ok(())
    }

    /// Start a new call
    pub fn start_call(&self, agent_id: String, script_version: String) -> SqliteResult<String> {
        let call_id = Uuid::new_v4().to_string();
        let started_at = Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT INTO calls (id, agent_id, started_at, script_version) VALUES (?1, ?2, ?3, ?4)",
            params![call_id, agent_id, started_at, script_version],
        )?;

        info!("Started call: {}", call_id);
        Ok(call_id)
    }

    /// End a call
    pub fn end_call(&self, call_id: &str) -> SqliteResult<()> {
        let ended_at = Utc::now().to_rfc3339();

        self.conn.execute(
            "UPDATE calls SET ended_at = ?1 WHERE id = ?2",
            params![ended_at, call_id],
        )?;

        info!("Ended call: {}", call_id);
        Ok(())
    }

    /// Save a transcript segment
    pub fn save_transcript(&self, segment: TranscriptSegment) -> SqliteResult<()> {
        self.conn.execute(
            "INSERT INTO transcripts (id, call_id, timestamp, text, confidence, speaker)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                segment.id,
                segment.call_id,
                segment.timestamp.to_rfc3339(),
                segment.text,
                segment.confidence,
                segment.speaker,
            ],
        )?;

        debug!("Saved transcript segment: {}", segment.id);
        Ok(())
    }

    /// Get all transcripts for a call
    pub fn get_call_transcripts(&self, call_id: &str) -> SqliteResult<Vec<TranscriptSegment>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, call_id, timestamp, text, confidence, speaker
             FROM transcripts
             WHERE call_id = ?1
             ORDER BY timestamp ASC",
        )?;

        let segments = stmt
            .query_map(params![call_id], |row| {
                Ok(TranscriptSegment {
                    id: row.get(0)?,
                    call_id: row.get(1)?,
                    timestamp: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                        .unwrap()
                        .with_timezone(&Utc),
                    text: row.get(3)?,
                    confidence: row.get(4)?,
                    speaker: row.get(5)?,
                })
            })?
            .collect::<SqliteResult<Vec<_>>>()?;

        Ok(segments)
    }

    /// Get call metadata
    pub fn get_call(&self, call_id: &str) -> SqliteResult<Option<CallMetadata>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, agent_id, started_at, ended_at, script_version
             FROM calls
             WHERE id = ?1",
        )?;

        let mut rows = stmt.query(params![call_id])?;

        if let Some(row) = rows.next()? {
            Ok(Some(CallMetadata {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                started_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(2)?)
                    .unwrap()
                    .with_timezone(&Utc),
                ended_at: row
                    .get::<_, Option<String>>(3)?
                    .map(|s| DateTime::parse_from_rfc3339(&s).unwrap().with_timezone(&Utc)),
                script_version: row.get(4)?,
            }))
        } else {
            Ok(None)
        }
    }

    /// Clean up old calls (older than retention days)
    pub fn cleanup_old_calls(&self, retention_days: i64) -> SqliteResult<usize> {
        let cutoff = Utc::now() - chrono::Duration::days(retention_days);
        let cutoff_str = cutoff.to_rfc3339();

        // Delete old transcripts first (foreign key)
        self.conn.execute(
            "DELETE FROM transcripts WHERE call_id IN (
                SELECT id FROM calls WHERE started_at < ?1
            )",
            params![cutoff_str],
        )?;

        // Delete old calls
        let deleted = self.conn.execute(
            "DELETE FROM calls WHERE started_at < ?1",
            params![cutoff_str],
        )?;

        info!("Cleaned up {} calls older than {} days", deleted, retention_days);
        Ok(deleted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_init() {
        let storage = Storage::new(PathBuf::from(":memory:")).unwrap();
        assert!(storage.conn.is_autocommit());
    }

    #[test]
    fn test_call_lifecycle() {
        let storage = Storage::new(PathBuf::from(":memory:")).unwrap();

        // Start call
        let call_id = storage
            .start_call("agent-123".to_string(), "v1.0".to_string())
            .unwrap();

        // Get call
        let call = storage.get_call(&call_id).unwrap();
        assert!(call.is_some());
        assert_eq!(call.unwrap().agent_id, "agent-123");

        // End call
        storage.end_call(&call_id).unwrap();

        // Verify ended
        let call = storage.get_call(&call_id).unwrap().unwrap();
        assert!(call.ended_at.is_some());
    }
}

use super::{LedgerError, StorageVersion};
use turso::Connection;
use turso::transaction::TransactionBehavior;

pub struct LedgerSchema;

impl LedgerSchema {
    pub async fn migrate(connection: &mut Connection) -> Result<(), LedgerError> {
        let tx = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let mut rows = tx.query("PRAGMA user_version", ()).await?;
        let row = rows
            .next()
            .await?
            .ok_or(LedgerError::Invalid("missing database version"))?;
        let version = StorageVersion::try_from(row.get::<i64>(0)?)?;
        drop(rows);
        if version == StorageVersion::EMPTY {
            tx.execute("CREATE TABLE feature (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), document TEXT NOT NULL) STRICT", ()).await?;
            tx.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision > 0), document TEXT NOT NULL) STRICT", ()).await?;
            tx.execute("CREATE TABLE events (task_id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL) STRICT", ()).await?;
            tx.execute("PRAGMA user_version = 1", ()).await?;
        }
        if version == StorageVersion::EMPTY || version == StorageVersion::DOCUMENTS {
            tx.execute(
                "CREATE UNIQUE INDEX events_task_revision ON events(task_id, revision)",
                (),
            )
            .await?;
            tx.execute("PRAGMA user_version = 2", ()).await?;
        }
        tx.commit().await?;
        Ok(())
    }
}

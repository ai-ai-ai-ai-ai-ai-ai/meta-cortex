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
        let mut version = StorageVersion::try_from(row.get::<i64>(0)?)?;
        drop(rows);
        loop {
            version = match version {
                StorageVersion::Empty => {
                    tx.execute("CREATE TABLE feature (singleton INTEGER PRIMARY KEY CHECK(singleton = 1), document TEXT NOT NULL) STRICT", ()).await?;
                    tx.execute("CREATE TABLE tasks (id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision > 0), document TEXT NOT NULL) STRICT", ()).await?;
                    tx.execute("CREATE TABLE events (task_id TEXT NOT NULL, revision INTEGER NOT NULL, document TEXT NOT NULL) STRICT", ()).await?;
                    StorageVersion::DocumentsV1
                }
                StorageVersion::DocumentsV1 => {
                    tx.execute(
                        "CREATE UNIQUE INDEX events_task_revision ON events(task_id, revision)",
                        (),
                    )
                    .await?;
                    StorageVersion::IndexedV2
                }
                StorageVersion::IndexedV2 => break,
            };
            // PRAGMA assignments cannot bind parameters; render the closed version enum.
            tx.execute(&format!("PRAGMA user_version = {version}"), ())
                .await?;
        }
        tx.commit().await?;
        Ok(())
    }
}

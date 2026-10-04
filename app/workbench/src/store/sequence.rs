//! V4-to-V5 preserves rowid values and raw documents, including holes. Those
//! identities describe legacy storage order, never recovered commit chronology.
use super::observation::SequenceProvenance;
use super::relational::EventTable;
use super::sql::SqlStatement;
use crate::LedgerError;
use sea_query::{ColumnDef, Expr, ExprTrait, Iden, Index, Order, Query, SqliteQueryBuilder, Table};
use turso::Connection;

#[derive(Iden)]
enum PreviousEvents {
    #[iden = "events_v4"]
    Table,
}
pub(super) struct SequenceSchema;
impl SequenceSchema {
    pub(super) async fn migrate(connection: &Connection) -> Result<(), LedgerError> {
        connection
            .execute(
                Table::rename()
                    .table(EventTable::Table, PreviousEvents::Table)
                    .to_string(SqliteQueryBuilder),
                (),
            )
            .await?;
        let mut table = EventTable::definition();
        table
            .col(
                ColumnDef::new(EventTable::Sequence)
                    .integer()
                    .primary_key()
                    .auto_increment(),
            )
            .col(
                ColumnDef::new(EventTable::Provenance)
                    .integer()
                    .not_null()
                    .default(i64::from(SequenceProvenance::CommittedAppend))
                    .check(Expr::col(EventTable::Provenance).is_in([
                        i64::from(SequenceProvenance::LegacyStorageOrder),
                        i64::from(SequenceProvenance::CommittedAppend),
                    ])),
            )
            .index(
                Index::create()
                    .unique()
                    .col(EventTable::FeatureId)
                    .col(EventTable::TaskId)
                    .col(EventTable::Revision),
            );
        // SeaQuery exposes SQLite STRICT only through this fixed dialect token.
        table.extra("STRICT");
        connection
            .execute(table.to_string(SqliteQueryBuilder), ())
            .await?;
        SqlStatement::build(
            Query::insert()
                .into_table(EventTable::Table)
                .columns([
                    EventTable::Sequence,
                    EventTable::Provenance,
                    EventTable::FeatureId,
                    EventTable::TaskId,
                    EventTable::Revision,
                    EventTable::Document,
                ])
                .select_from(
                    Query::select()
                        .column(EventTable::RowId)
                        .expr(Expr::val(i64::from(SequenceProvenance::LegacyStorageOrder)))
                        .columns([
                            EventTable::FeatureId,
                            EventTable::TaskId,
                            EventTable::Revision,
                            EventTable::Document,
                        ])
                        .from(PreviousEvents::Table)
                        .order_by(EventTable::RowId, Order::Asc)
                        .to_owned(),
                )?
                .to_owned(),
        )?
        .execute(connection)
        .await?;
        connection
            .execute(
                Table::drop()
                    .table(PreviousEvents::Table)
                    .to_string(SqliteQueryBuilder),
                (),
            )
            .await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::relational::tests::Records;
    use crate::store::relational::{RecordWriter, RelationalSchema};
    use crate::store::schema::LedgerSchema;
    use crate::values::EventSequence;
    use crate::versions::StorageVersion;
    use tokio::runtime::Builder;
    use turso::Builder as DatabaseBuilder;

    #[derive(Iden)]
    enum Pragma {
        UserVersion,
        ForeignKeys,
        ForeignKeyCheck,
    }
    #[derive(Debug, PartialEq, Eq)]
    struct Snapshot {
        sequence: EventSequence,
        document: String,
    }
    async fn snapshot(connection: &Connection) -> anyhow::Result<Vec<Snapshot>> {
        let mut rows = SqlStatement::build(
            Query::select()
                .columns([EventTable::RowId, EventTable::Document])
                .from(EventTable::Table)
                .order_by(EventTable::RowId, Order::Asc)
                .to_owned(),
        )?
        .query(connection)
        .await?;
        let mut events = Vec::new();
        while let Some(row) = rows.next().await? {
            events.push(Snapshot {
                sequence: EventSequence::from(row.get::<i64>(0)?),
                document: row.get::<String>(1)?,
            });
        }
        Ok(events)
    }
    #[test]
    fn migration_preserves_exact_rowids_holes_documents_and_append_watermark() -> anyhow::Result<()>
    {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let directory = tempfile::tempdir()?;
                let path = directory.path().join("ledger.db");
                let database = DatabaseBuilder::new_local(
                    path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?,
                )
                .build()
                .await?;
                let mut connection = database.connect()?;
                connection
                    .pragma_update(&Pragma::ForeignKeys.to_string(), 1)
                    .await?;
                RelationalSchema::create(&connection).await?;
                connection
                    .pragma_update(
                        &Pragma::UserVersion.to_string(),
                        i64::from(StorageVersion::CommonTasksV4),
                    )
                    .await?;
                let mut records = Records::new()?;
                let writer = RecordWriter {
                    connection: &connection,
                };
                writer.feature(&records.feature).await?;
                writer.task(&records.task).await?;
                for _ in 0..3 {
                    writer.event(&records.event).await?;
                    records.event.task.common.revision =
                        records.event.task.common.revision.advance()?;
                }
                SqlStatement::build(
                    Query::delete()
                        .from_table(EventTable::Table)
                        .and_where(Expr::col(EventTable::RowId).eq(2))
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                let before = snapshot(&connection).await?;
                assert_eq!(
                    before
                        .iter()
                        .map(|event| event.sequence)
                        .collect::<Vec<_>>(),
                    [EventSequence::from(1), EventSequence::from(3)]
                );
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::SequencedEventsV5
                );
                assert_eq!(snapshot(&connection).await?, before);
                let mut provenance = SqlStatement::build(
                    Query::select()
                        .column(EventTable::Provenance)
                        .from(EventTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                while let Some(row) = provenance.next().await? {
                    assert_eq!(
                        SequenceProvenance::try_from(row.get::<i64>(0)?)?,
                        SequenceProvenance::LegacyStorageOrder
                    );
                }
                drop(provenance);
                let mut violations = Vec::new();
                connection
                    .pragma_query(&Pragma::ForeignKeyCheck.to_string(), |row| {
                        violations.push(row.get::<String>(0));
                        Ok(())
                    })
                    .await?;
                assert!(violations.is_empty());
                // Removing the largest ID must not reuse a committed append identity.
                SqlStatement::build(
                    Query::delete()
                        .from_table(EventTable::Table)
                        .and_where(Expr::col(EventTable::Sequence).eq(3))
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                RecordWriter {
                    connection: &connection,
                }
                .event(&records.event)
                .await?;
                let appended = snapshot(&connection).await?;
                assert_eq!(
                    appended
                        .last()
                        .ok_or_else(|| anyhow::anyhow!("append missing"))?
                        .sequence,
                    EventSequence::from(4)
                );
                assert!(
                    RecordWriter {
                        connection: &connection
                    }
                    .event(&records.event)
                    .await
                    .is_err()
                );
                assert_eq!(snapshot(&connection).await?, appended);
                drop(connection);
                drop(database);
                let database = DatabaseBuilder::new_local(
                    path.to_str().ok_or_else(|| anyhow::anyhow!("path"))?,
                )
                .build()
                .await?;
                let mut connection = database.connect()?;
                LedgerSchema::migrate(&mut connection).await?;
                records.event.task.common.revision =
                    records.event.task.common.revision.advance()?;
                RecordWriter {
                    connection: &connection,
                }
                .event(&records.event)
                .await?;
                let after_restart = snapshot(&connection).await?;
                assert_eq!(
                    after_restart
                        .last()
                        .ok_or_else(|| anyhow::anyhow!("restart append missing"))?
                        .sequence,
                    EventSequence::from(5)
                );
                Ok(())
            })
    }
    #[test]
    fn invalid_legacy_uniqueness_rolls_back_the_entire_upgrade() -> anyhow::Result<()> {
        Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = DatabaseBuilder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                RelationalSchema::create(&connection).await?;
                connection
                    .execute(
                        Table::drop()
                            .table(EventTable::Table)
                            .to_string(SqliteQueryBuilder),
                        (),
                    )
                    .await?;
                // Model an invalid old event index without modifying any real ledger.
                connection
                    .execute(
                        Table::create()
                            .table(EventTable::Table)
                            .col(ColumnDef::new(EventTable::FeatureId).text().not_null())
                            .col(ColumnDef::new(EventTable::TaskId).text().not_null())
                            .col(ColumnDef::new(EventTable::Revision).integer().not_null())
                            .col(ColumnDef::new(EventTable::Document).text().not_null())
                            .to_string(SqliteQueryBuilder),
                        (),
                    )
                    .await?;
                connection
                    .pragma_update(
                        &Pragma::UserVersion.to_string(),
                        i64::from(StorageVersion::CommonTasksV4),
                    )
                    .await?;
                let records = Records::new()?;
                let writer = RecordWriter {
                    connection: &connection,
                };
                writer.feature(&records.feature).await?;
                writer.task(&records.task).await?;
                writer.event(&records.event).await?;
                writer.event(&records.event).await?;
                let before = snapshot(&connection).await?;
                let error = LedgerSchema::migrate(&mut connection)
                    .await
                    .err()
                    .ok_or_else(|| {
                        anyhow::anyhow!("duplicate legacy identity must reject migration")
                    })?;
                assert!(error.to_string().contains("UNIQUE constraint failed"));
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::CommonTasksV4
                );
                assert_eq!(snapshot(&connection).await?, before);
                Ok(())
            })
    }
}

use super::{LedgerError, StorageVersion};
use sea_query::{
    ColumnDef, Expr, ExprTrait, Iden, Index, SqliteQueryBuilder, Table, TableCreateStatement,
};
use turso::Connection;
use turso::transaction::TransactionBehavior;

// These identifiers preserve the existing on-disk schema.
#[derive(Iden)]
pub(super) enum FeatureTable {
    #[iden = "feature"]
    Table,
    Singleton,
    Document,
}

#[derive(Iden)]
pub(super) enum TaskTable {
    #[iden = "tasks"]
    Table,
    Id,
    Revision,
    Document,
}

#[derive(Iden)]
pub(super) enum EventTable {
    #[iden = "events"]
    Table,
    TaskId,
    Revision,
    Document,
}

#[derive(Iden)]
enum EventIndex {
    EventsTaskRevision,
}

#[derive(Iden)]
enum DatabasePragma {
    UserVersion,
}

pub struct LedgerSchema;

impl LedgerSchema {
    async fn version(connection: &Connection) -> Result<StorageVersion, LedgerError> {
        let mut version = Err(LedgerError::Invalid("missing database version"));
        connection
            .pragma_query(&DatabasePragma::UserVersion.to_string(), |row| {
                version = row
                    .get::<i64>(0)
                    .map_err(LedgerError::from)
                    .and_then(|value| StorageVersion::try_from(value).map_err(LedgerError::from));
                Ok(())
            })
            .await?;
        version
    }

    pub async fn migrate(connection: &mut Connection) -> Result<(), LedgerError> {
        let tx = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let mut version = Self::version(&tx).await?;
        loop {
            version = match version {
                StorageVersion::Empty => {
                    for mut table in [
                        FeatureTable::create(),
                        TaskTable::create(),
                        EventTable::create(),
                    ] {
                        // SeaQuery 1.0 has no typed SQLite STRICT option. This fixed
                        // dialect keyword is confined to the schema adapter.
                        table.extra("STRICT");
                        tx.execute(table.to_string(SqliteQueryBuilder), ()).await?;
                    }
                    StorageVersion::DocumentsV1
                }
                StorageVersion::DocumentsV1 => {
                    let index = Index::create()
                        .name(EventIndex::EventsTaskRevision.to_string())
                        .table(EventTable::Table)
                        .col(EventTable::TaskId)
                        .col(EventTable::Revision)
                        .unique()
                        .to_string(SqliteQueryBuilder);
                    tx.execute(index, ()).await?;
                    StorageVersion::IndexedV2
                }
                StorageVersion::IndexedV2 => break,
            };
            tx.pragma_update(&DatabasePragma::UserVersion.to_string(), version)
                .await?;
        }
        tx.commit().await?;
        Ok(())
    }
}

impl FeatureTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(
                ColumnDef::new(Self::Singleton)
                    .integer()
                    .primary_key()
                    .check(Expr::col(Self::Singleton).eq(1)),
            )
            .col(ColumnDef::new(Self::Document).text().not_null())
            .to_owned()
    }
}

impl TaskTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(ColumnDef::new(Self::Id).text().primary_key())
            .col(
                ColumnDef::new(Self::Revision)
                    .integer()
                    .not_null()
                    .check(Expr::col(Self::Revision).gt(0)),
            )
            .col(ColumnDef::new(Self::Document).text().not_null())
            .to_owned()
    }
}

impl EventTable {
    fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(ColumnDef::new(Self::TaskId).text().not_null())
            .col(ColumnDef::new(Self::Revision).integer().not_null())
            .col(ColumnDef::new(Self::Document).text().not_null())
            .to_owned()
    }
}

#[cfg(test)]
pub mod tests {
    use super::{EventTable, FeatureTable, LedgerSchema, TaskTable};
    use crate::LedgerError;
    use crate::store::sql::SqlStatement;
    use crate::values::Note;
    use sea_query::{Expr, Query};
    use tokio::runtime;
    use turso::Builder;

    #[test]
    fn generated_schema_preserves_constraints_and_bound_documents() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LedgerSchema::migrate(&mut connection).await?;
                // A typed scalar probes SQL storage independently of task decoding.
                let document = serde_json::to_string(&Note::from(
                    "O'Brien\n🦀 '; DROP TABLE tasks; --".to_owned(),
                ))?;
                SqlStatement::build(
                    Query::insert()
                        .into_table(FeatureTable::Table)
                        .columns([FeatureTable::Singleton, FeatureTable::Document])
                        .values([1.into(), document.clone().into()])?
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                for singleton in [0, 1, 2] {
                    assert!(matches!(
                        SqlStatement::build(
                            Query::insert()
                                .into_table(FeatureTable::Table)
                                .columns([FeatureTable::Singleton, FeatureTable::Document])
                                .values([singleton.into(), document.clone().into()])?
                                .to_owned()
                        )?
                        .execute(&connection)
                        .await,
                        Err(LedgerError::Database(_))
                    ));
                }
                for revision in [Expr::val(0), Expr::val(-1), Expr::val("not an integer")] {
                    assert!(matches!(
                        SqlStatement::build(
                            Query::insert()
                                .into_table(TaskTable::Table)
                                .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                                .values(["task".into(), revision, document.clone().into()])?
                                .to_owned()
                        )?
                        .execute(&connection)
                        .await,
                        Err(LedgerError::Database(_))
                    ));
                }
                SqlStatement::build(
                    Query::insert()
                        .into_table(TaskTable::Table)
                        .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                        .values(["task".into(), i64::MAX.into(), document.clone().into()])?
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                let mut rows = SqlStatement::build(
                    Query::select()
                        .columns([TaskTable::Document, TaskTable::Revision])
                        .from(TaskTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let row = rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("missing bound document"))?;
                assert_eq!(row.get::<String>(0)?, document);
                assert_eq!(row.get::<i64>(1)?, i64::MAX);
                drop(rows);
                let event = Query::insert()
                    .into_table(EventTable::Table)
                    .columns([
                        EventTable::TaskId,
                        EventTable::Revision,
                        EventTable::Document,
                    ])
                    .values(["task".into(), 1.into(), document.into()])?
                    .to_owned();
                SqlStatement::build(event.clone())?
                    .execute(&connection)
                    .await?;
                assert!(matches!(
                    SqlStatement::build(event)?.execute(&connection).await,
                    Err(LedgerError::Database(_))
                ));
                anyhow::Ok(())
            })
    }
}

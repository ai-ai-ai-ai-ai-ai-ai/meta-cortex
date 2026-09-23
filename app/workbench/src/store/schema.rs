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
mod tests;

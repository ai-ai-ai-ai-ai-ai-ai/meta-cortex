use super::legacy::LegacyRecords;
use super::relational::RelationalSchema;
use super::{LedgerError, StorageVersion};
#[cfg(test)]
use sea_query::{ColumnDef, Expr, ExprTrait, Table, TableCreateStatement};
use sea_query::{Iden, Index, SqliteQueryBuilder};
use turso::Connection;
use turso::transaction::TransactionBehavior;

// These identifiers preserve the existing on-disk schema.
#[derive(Iden)]
#[cfg(test)]
pub(super) enum FeatureTable {
    #[iden = "feature"]
    Table,
    #[cfg(test)]
    Singleton,
    Document,
}

#[derive(Iden)]
#[cfg(test)]
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
    #[cfg(test)]
    Document,
}

#[derive(Iden)]
enum EventIndex {
    EventsTaskRevision,
}

#[derive(Iden)]
enum DatabasePragma {
    UserVersion,
    ForeignKeys,
}

pub struct LedgerSchema;

impl LedgerSchema {
    pub(super) async fn version(connection: &Connection) -> Result<StorageVersion, LedgerError> {
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
        connection
            .pragma_update(&DatabasePragma::ForeignKeys.to_string(), 1)
            .await?;
        let tx = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .await?;
        let mut version = Self::version(&tx).await?;
        match version {
            StorageVersion::RelationalV3 => {
                tx.commit().await?;
                return Ok(());
            }
            StorageVersion::Empty | StorageVersion::DocumentsV1 | StorageVersion::IndexedV2 => {}
        }
        loop {
            version = match version {
                StorageVersion::Empty => {
                    RelationalSchema::create(&tx).await?;
                    StorageVersion::RelationalV3
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
                StorageVersion::IndexedV2 => {
                    let records = LegacyRecords::read(&tx).await?;
                    LegacyRecords::replace_tables(&tx).await?;
                    RelationalSchema::create(&tx).await?;
                    records.write(&tx).await?;
                    StorageVersion::RelationalV3
                }
                StorageVersion::RelationalV3 => break,
            };
        }
        tx.pragma_update(
            &DatabasePragma::UserVersion.to_string(),
            StorageVersion::CURRENT,
        )
        .await?;
        tx.commit().await?;
        Ok(())
    }
}

#[cfg(test)]
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

#[cfg(test)]
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

#[cfg(test)]
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
    use super::{
        DatabasePragma, EventTable, FeatureTable, LedgerSchema, StorageVersion, TaskTable,
    };
    use crate::model::Event;
    use crate::store::relational::tests::Records;
    use crate::store::sql::SqlStatement;
    use sea_query::{Iden, Query, SqliteQueryBuilder};
    use tokio::runtime;
    use turso::Connection;

    pub(crate) struct LegacyFixture;
    impl LegacyFixture {
        pub(crate) async fn create(connection: &Connection) -> anyhow::Result<()> {
            for mut table in [
                FeatureTable::create(),
                TaskTable::create(),
                EventTable::create(),
            ] {
                table.extra("STRICT");
                connection
                    .execute(table.to_string(SqliteQueryBuilder), ())
                    .await?;
            }
            let records = Records::new()?;
            SqlStatement::build(
                Query::insert()
                    .into_table(FeatureTable::Table)
                    .columns([FeatureTable::Singleton, FeatureTable::Document])
                    .values([1.into(), serde_json::to_string(&records.feature)?.into()])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
            SqlStatement::build(
                Query::insert()
                    .into_table(TaskTable::Table)
                    .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                    .values([
                        records.task.id.to_string().into(),
                        i64::from(records.task.revision).into(),
                        serde_json::to_string(&records.task)?.into(),
                    ])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
            SqlStatement::build(
                Query::insert()
                    .into_table(EventTable::Table)
                    .columns([
                        EventTable::TaskId,
                        EventTable::Revision,
                        EventTable::Document,
                    ])
                    .values([
                        records.task.id.to_string().into(),
                        i64::from(records.task.revision).into(),
                        serde_json::to_string(&records.event)?.into(),
                    ])?
                    .to_owned(),
            )?
            .execute(connection)
            .await?;
            connection
                .pragma_update(
                    &DatabasePragma::UserVersion.to_string(),
                    StorageVersion::DocumentsV1,
                )
                .await?;
            Ok(())
        }
    }
    #[test]
    fn migrations_preserve_history_and_reject_future_versions() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = turso::Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LegacyFixture::create(&connection).await?;
                let mut source_rows = SqlStatement::build(
                    Query::select()
                        .column(EventTable::Document)
                        .from(EventTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let original = source_rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("missing source history"))?
                    .get::<String>(0)?;
                drop(source_rows);
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::RelationalV3
                );
                LedgerSchema::migrate(&mut connection).await?;
                let mut rows = SqlStatement::build(
                    Query::select()
                        .column(EventTable::Document)
                        .from(EventTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let row = rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("missing history"))?;
                assert_eq!(row.get::<String>(0)?, original);
                drop(rows);
                connection
                    .pragma_update(&DatabasePragma::UserVersion.to_string(), 99)
                    .await?;
                assert!(LedgerSchema::migrate(&mut connection).await.is_err());
                anyhow::Ok(())
            })
    }
    #[test]
    fn invalid_legacy_relationship_rolls_back_schema_and_data() -> anyhow::Result<()> {
        runtime::Builder::new_current_thread()
            .enable_time()
            .build()?
            .block_on(async {
                let database = turso::Builder::new_local(":memory:").build().await?;
                let mut connection = database.connect()?;
                LegacyFixture::create(&connection).await?;
                SqlStatement::build(Query::delete().from_table(TaskTable::Table).to_owned())?
                    .execute(&connection)
                    .await?;
                assert!(LedgerSchema::migrate(&mut connection).await.is_err());
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::DocumentsV1
                );
                let mut rows = SqlStatement::build(
                    Query::select()
                        .column(EventTable::Document)
                        .from(EventTable::Table)
                        .to_owned(),
                )?
                .query(&connection)
                .await?;
                let row = rows
                    .next()
                    .await?
                    .ok_or_else(|| anyhow::anyhow!("lost history"))?;
                let event: Event = serde_json::from_str(&row.get::<String>(0)?)?;
                drop(rows);
                SqlStatement::build(
                    Query::insert()
                        .into_table(TaskTable::Table)
                        .columns([TaskTable::Id, TaskTable::Revision, TaskTable::Document])
                        .values([
                            event.task.id.to_string().into(),
                            i64::from(event.task.revision).into(),
                            serde_json::to_string(&event.task)?.into(),
                        ])?
                        .to_owned(),
                )?
                .execute(&connection)
                .await?;
                LedgerSchema::migrate(&mut connection).await?;
                assert_eq!(
                    LedgerSchema::version(&connection).await?,
                    StorageVersion::RelationalV3
                );
                anyhow::Ok(())
            })
    }
}

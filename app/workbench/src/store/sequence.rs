//! V4-to-V5 preserves rowid values and raw documents, including holes. Those
//! identities describe legacy storage order, never recovered commit chronology.
use super::observation::SequenceProvenance;
use super::relational::EventTable;
use super::sql::SqlStatement;
use crate::LedgerError;
use sea_query::{ColumnDef, Expr, Iden, Index, Order, Query, SqliteQueryBuilder, Table};
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
                    .default(i64::from(SequenceProvenance::CommittedAppend)),
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

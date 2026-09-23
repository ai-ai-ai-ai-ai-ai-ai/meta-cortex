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

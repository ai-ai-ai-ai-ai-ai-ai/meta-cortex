//! Global append order is storage evidence; task revisions remain local counters.
use super::{FeedEntry, HistoryPage, Observation, Page, RecordLimit};
use crate::LedgerError;
use crate::model::Event;
use crate::store::relational::EventTable;
use crate::store::sql::SqlStatement;
use crate::values::{EventSequence, FeatureId, TaskId};
use schemars::JsonSchema;
use sea_query::{Expr, ExprTrait, Order, Query};
use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub enum SequenceProvenance {
    LegacyStorageOrder,
    CommittedAppend,
}
impl From<SequenceProvenance> for i64 {
    fn from(value: SequenceProvenance) -> Self {
        match value {
            SequenceProvenance::LegacyStorageOrder => 0,
            SequenceProvenance::CommittedAppend => 1,
        }
    }
}
impl TryFrom<i64> for SequenceProvenance {
    type Error = LedgerError;
    fn try_from(value: i64) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(Self::LegacyStorageOrder),
            1 => Ok(Self::CommittedAppend),
            _ => Err(LedgerError::Invalid("unknown event sequence provenance")),
        }
    }
}
#[derive(Debug, Serialize, JsonSchema)]
pub struct RevisionLogEntry {
    pub feature: FeatureId,
    pub task: TaskId,
    pub sequence: EventSequence,
    pub provenance: SequenceProvenance,
    pub entry: FeedEntry,
}
pub(super) struct SequencedEvent {
    pub sequence: EventSequence,
    pub provenance: SequenceProvenance,
    pub event: Event,
}
impl Observation {
    pub(super) async fn sequenced_history(
        &self,
        request: HistoryPage,
    ) -> Result<Page<SequencedEvent>, LedgerError> {
        let reader = self.reader().await?;
        let mut rows = SqlStatement::build(
            Query::select()
                .columns([
                    EventTable::Sequence,
                    EventTable::Provenance,
                    EventTable::Document,
                ])
                .from(EventTable::Table)
                .and_where(Expr::col(EventTable::FeatureId).eq(request.feature.to_string()))
                .and_where(Expr::col(EventTable::TaskId).eq(request.task.to_string()))
                .order_by(EventTable::Revision, Order::Desc)
                .offset(request.page.offset())
                .limit(RecordLimit::PAGE.probe())
                .to_owned(),
        )?
        .query(&reader.connection)
        .await?;
        let mut records = Vec::new();
        while let Some(row) = rows.next().await? {
            records.push(SequencedEvent {
                sequence: EventSequence::from(row.get::<i64>(0)?),
                provenance: SequenceProvenance::try_from(row.get::<i64>(1)?)?,
                event: serde_json::from_str(&row.get::<String>(2)?)?,
            });
        }
        Ok(RecordLimit::PAGE.bound(records))
    }
}

//! Pull requests a feature's tasks recorded in their progress extensions. The ledger
//! has no dedicated field, so observers read the GitHub URLs agents already store there.
use super::{JsonPath, LedgerReader, RecordLimit};
use crate::LedgerError;
use crate::model::Feature;
use crate::store::relational::TaskTable;
use crate::store::sql::SqlStatement;
use crate::values::{TaskId, Timestamp};
use schemars::JsonSchema;
use sea_query::{Expr, ExprTrait, Order, Query};
use serde::Serialize;
use std::cmp::Reverse;

/// A pull request recorded by at least one task, with the tasks that recorded it.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, JsonSchema)]
pub struct PullRequest {
    /// Canonical `https://host/owner/repository/pull/number` link.
    pub url: String,
    /// `owner/repository` as written in the link.
    pub repository: String,
    pub number: u64,
    /// Tasks whose current progress records this pull request, most recent first.
    pub tasks: Vec<TaskId>,
    /// Latest update of a task that records this pull request.
    pub recorded_at: Timestamp,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct PullRequestLink {
    host: String,
    repository: String,
    number: u64,
}
impl PullRequestLink {
    const SCHEME: &'static str = "https://";
    fn parse(token: &str) -> Option<Self> {
        let rest = token.strip_prefix(Self::SCHEME)?;
        let mut parts = rest.split('/');
        let host = parts.next().filter(|part| !part.is_empty())?;
        let owner = parts.next().filter(|part| !part.is_empty())?;
        let repository = parts.next().filter(|part| !part.is_empty())?;
        parts.next().filter(|part| *part == "pull")?;
        let digits = parts
            .next()?
            .chars()
            .take_while(char::is_ascii_digit)
            .collect::<String>();
        Some(Self {
            host: host.to_owned(),
            repository: format!("{owner}/{repository}"),
            number: digits.parse().ok()?,
        })
    }
    fn url(&self) -> String {
        format!(
            "{}{}/{}/pull/{}",
            Self::SCHEME,
            self.host,
            self.repository,
            self.number
        )
    }
}

/// Every pull request link inside one recorded JSON value, in document order.
struct RecordedLinks(Vec<PullRequestLink>);
impl From<&serde_json::Value> for RecordedLinks {
    fn from(value: &serde_json::Value) -> Self {
        let mut texts = Vec::new();
        let mut pending = vec![value];
        while let Some(value) = pending.pop() {
            match value {
                serde_json::Value::String(text) => texts.push(text.as_str()),
                serde_json::Value::Array(items) => pending.extend(items.iter().rev()),
                serde_json::Value::Object(fields) => pending.extend(fields.values().rev()),
                serde_json::Value::Null
                | serde_json::Value::Bool(_)
                | serde_json::Value::Number(_) => {}
            }
        }
        let mut links = Vec::new();
        for link in texts.into_iter().flat_map(|text| {
            text.split(|c: char| c.is_whitespace() || "\"'()<>[],".contains(c))
                .filter_map(PullRequestLink::parse)
        }) {
            if !links.contains(&link) {
                links.push(link);
            }
        }
        Self(links)
    }
}

struct RecordingTask {
    task: TaskId,
    recorded_at: Timestamp,
    links: RecordedLinks,
}
/// Pull requests ordered by how many tasks recorded them, then by recency.
struct PullRequests(Vec<PullRequest>);
impl FromIterator<RecordingTask> for PullRequests {
    fn from_iter<I: IntoIterator<Item = RecordingTask>>(tasks: I) -> Self {
        let mut found: Vec<PullRequest> = Vec::new();
        for RecordingTask {
            task,
            recorded_at,
            links: RecordedLinks(links),
        } in tasks
        {
            for link in links {
                let url = link.url();
                match found.iter_mut().find(|known| known.url == url) {
                    Some(known) => known.tasks.push(task.clone()),
                    None => found.push(PullRequest {
                        url,
                        repository: link.repository,
                        number: link.number,
                        tasks: vec![task.clone()],
                        recorded_at,
                    }),
                }
            }
        }
        found.sort_by_key(|known| Reverse(known.tasks.len()));
        Self(found)
    }
}

impl LedgerReader {
    pub(super) async fn pull_requests(
        &self,
        feature: &Feature,
    ) -> Result<Vec<PullRequest>, LedgerError> {
        let extensions = JsonPath::from("$.common.progress.extensions").extract();
        let last_update = JsonPath::from("$.common.last_update").extract();
        let mut rows = SqlStatement::build(
            Query::select()
                .column(TaskTable::Id)
                .expr(extensions.clone())
                .expr(last_update.clone())
                .from(TaskTable::Table)
                .and_where(Expr::col(TaskTable::FeatureId).eq(feature.id.to_string()))
                .and_where(extensions.like("%/pull/%"))
                .order_by_expr(last_update.into(), Order::Desc)
                .limit(RecordLimit::PAGE.sql_count())
                .to_owned(),
        )?
        .query(&self.connection)
        .await?;
        let mut tasks = Vec::new();
        while let Some(row) = rows.next().await? {
            let extensions: serde_json::Value = serde_json::from_str(&row.get::<String>(1)?)?;
            tasks.push(RecordingTask {
                task: TaskId::try_from(row.get::<String>(0)?)?,
                recorded_at: Timestamp::try_from(row.get::<i64>(2)?)?,
                links: RecordedLinks::from(&extensions),
            });
        }
        let PullRequests(found) = tasks.into_iter().collect();
        Ok(found)
    }
}

#[cfg(test)]
mod tests {
    use super::{PullRequestLink, RecordedLinks};

    #[test]
    fn parses_canonical_links_from_recorded_text() {
        let link = PullRequestLink::parse("https://github.com/acme/tool/pull/41#discussion")
            .map(|link| (link.url(), link.repository, link.number));
        assert_eq!(
            link,
            Some((
                "https://github.com/acme/tool/pull/41".to_owned(),
                "acme/tool".to_owned(),
                41
            ))
        );
        for rejected in [
            "http://github.com/acme/tool/pull/41",
            "https://github.com/acme/tool/issues/41",
            "https://github.com/acme/tool/pull/",
            "https://github.com//tool/pull/41",
        ] {
            assert_eq!(PullRequestLink::parse(rejected), None, "{rejected}");
        }
    }

    #[test]
    fn finds_nested_links_once_in_document_order() -> serde_json::Result<()> {
        let value = serde_json::from_str(
            r#"{"a_pr_url": "https://github.com/acme/tool/pull/7",
                "results": {"pr": {"url": "https://github.com/acme/tool/pull/9", "number": 9}},
                "notes": ["merged (https://github.com/acme/tool/pull/7) after review"]}"#,
        )?;
        let RecordedLinks(links) = RecordedLinks::from(&value);
        let numbers = links.iter().map(|link| link.number).collect::<Vec<_>>();
        assert_eq!(numbers, [7, 9]);
        Ok(())
    }
}

use crate::LedgerError;
use sea_query::{QueryStatementBuilder, SqliteQueryBuilder, Value, Values};
use turso::{Connection, Rows};

// Generated SQL exists only at the driver boundary; callers supply SeaQuery ASTs.
struct SqlText(String);

pub(super) struct SqlStatement {
    text: SqlText,
    parameters: Vec<turso::Value>,
}

impl SqlStatement {
    pub(super) fn build(query: impl QueryStatementBuilder) -> Result<Self, LedgerError> {
        let (text, Values(values)) = query.build_any(&SqliteQueryBuilder);
        let parameters = values
            .into_iter()
            .map(Self::parameter)
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self {
            text: SqlText(text),
            parameters,
        })
    }

    fn parameter(value: Value) -> Result<turso::Value, LedgerError> {
        // Workbench binds only non-null text and signed integers. Reject other
        // dependency-owned variants rather than silently coercing a new column type.
        match value {
            Value::String(Some(text)) => Ok(turso::Value::Text(text)),
            Value::BigInt(Some(number)) => Ok(turso::Value::Integer(number)),
            Value::Int(Some(number)) => Ok(turso::Value::Integer(i64::from(number))),
            Value::String(None)
            | Value::BigInt(None)
            | Value::Int(None)
            | Value::Bool(_)
            | Value::TinyInt(_)
            | Value::SmallInt(_)
            | Value::TinyUnsigned(_)
            | Value::SmallUnsigned(_)
            | Value::Unsigned(_)
            | Value::BigUnsigned(_)
            | Value::Float(_)
            | Value::Double(_)
            | Value::Enum(_)
            | Value::Char(_)
            | Value::Bytes(_) => Err(LedgerError::UnsupportedSqlBinding),
        }
    }

    pub(super) async fn execute(self, connection: &Connection) -> Result<u64, LedgerError> {
        let Self {
            text: SqlText(text),
            parameters,
        } = self;
        Ok(connection.execute(text, parameters).await?)
    }

    pub(super) async fn query(self, connection: &Connection) -> Result<Rows, LedgerError> {
        let Self {
            text: SqlText(text),
            parameters,
        } = self;
        Ok(connection.query(text, parameters).await?)
    }
}

#[cfg(test)]
mod tests {
    use super::SqlStatement;
    use crate::LedgerError;
    use sea_query::{Expr, Query, Value};

    #[test]
    fn rejects_bindings_outside_the_workbench_column_types() {
        for value in [
            Value::BigInt(None),
            Value::String(None),
            Value::BigUnsigned(Some(u64::MAX)),
        ] {
            assert!(matches!(
                SqlStatement::build(Query::select().expr(Expr::val(value)).to_owned()),
                Err(LedgerError::UnsupportedSqlBinding)
            ));
        }
    }
}

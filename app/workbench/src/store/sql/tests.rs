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

# Typed SQL Construction

Use an established SQL schema/query builder or typed ORM compatible with the
project's database driver. Build tables, columns, indexes, constraints, predicates,
and mutations from its typed API. Keep identifiers in closed enums and bind
runtime values. Apply this to migrations, application queries, and test fixtures.
Do not replace SQL literals with interpolation, string concatenation, a text
wrapper, or a homegrown SQL builder.

These alternative fragments assume SeaQuery 1.0.2 with `backend-sqlite` and
`derive`. The prohibited statements assume an existing `task_id` implementing
`Display` and belong inside an owning method; the preferred
declarations are complete. Both compile; only the preferred form exposes schema
structure to Rust's type checker.

**Prohibited:** table structure is hidden inside authored SQL text.

```rust
let ddl = "CREATE TABLE tasks (id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK(revision > 0))";
let query = format!("SELECT revision FROM tasks WHERE id = '{task_id}'");
```

**Preferred:** identifiers, columns, and expressions belong to the builder.

```rust
use sea_query::{ColumnDef, Expr, ExprTrait, Iden, Table, TableCreateStatement};

#[derive(Iden)]
pub enum TaskTable {
    #[iden = "tasks"]
    Table,
    Id,
    Revision,
}

impl TaskTable {
    pub fn create() -> TableCreateStatement {
        Table::create()
            .table(Self::Table)
            .col(ColumnDef::new(Self::Id).text().primary_key())
            .col(ColumnDef::new(Self::Revision).integer().not_null()
                .check(Expr::col(Self::Revision).gt(0)))
            .to_owned()
    }
}
```

The `tasks` mapping preserves an established database identifier. Generate SQL
only at the driver adapter. For queries with runtime data, use the builder's
parameterized output and bind its values in the generated order. Destructure any
dependency-returned tuple immediately into named fields; do not expose it as an
application contract or access its fields by index. Decode returned rows into
the owning domain records at the same boundary.

Prefer the driver's transaction and database-setting APIs over authored `BEGIN`
or `PRAGMA` statements. If the builder lacks a required dialect feature, document
that exact limitation and isolate the smallest fixed token at the adapter. For
example, SeaQuery 1.0.2 exposes SQLite `STRICT` only through its `extra` hook;
`table.extra("STRICT")` preserves that constraint without rebuilding the DDL.
This exception permits neither dynamic SQL fragments nor runtime data in SQL text.

A query builder's typed AST is not proof that a column exists, that a value fits
its database type, or that an application transition is legal. Keep domain
validation, transactions, and database constraints. Test generated migrations and
queries against the actual driver, including uniqueness, checks, strict column
types, parameter preservation, and rollback behavior. Preserve supported on-disk
schemas when changing query construction; do not reset user databases.

See [SeaQuery's statement-builder documentation](https://docs.rs/sea-query/1.0.2/sea_query/#statement-builders)
for parameterized rendering and the schema/query API distinction.

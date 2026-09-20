# Rust Libraries

Rust projects use these libraries for their respective responsibilities:

- **`serde`** — serialization and deserialization of typed data.
- **`thiserror`** — concrete error types with messages and typed sources.
- **`derive_more`** — mechanical trait implementations, including single-field `From` conversions.
- **`tracing`** — structured diagnostic events and spans.

Enable the features used by the project. Keep dependencies in the crates that
use them; a workspace member does not need unused dependencies.

**Prohibited:** build custom serialization helpers, handwrite mechanical error
and conversion implementations, or use `println!` as application logging.

**Preferred:** declare the libraries and use their derives and structured events.
Normal CLI output may still use `println!`.

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
thiserror = "2"
derive_more = { version = "2", features = ["from"] }
tracing = "0.1"
```

```rust
#[derive(serde::Serialize, serde::Deserialize, derive_more::From)]
pub struct JobId(u64);

#[derive(Debug, thiserror::Error)]
pub enum JobError {
    #[error("could not read job")]
    Read(#[from] std::io::Error),
}

let job_id = JobId::from(42);
tracing::info!(job_id = job_id.0, "job started");
```

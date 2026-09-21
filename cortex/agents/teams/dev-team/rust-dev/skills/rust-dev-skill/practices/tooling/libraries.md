# Rust Libraries

Use the required core libraries below. Select the other categories when the
project needs their capabilities.

Enable only the features used by the project. Declare dependencies in the crates
that use them; a workspace member does not need unused dependencies.

## Required core

- **`serde`** — serialization and deserialization of typed data.
- **`thiserror`** — concrete error types with messages and typed sources.
- **`derive_more`** — mechanical trait implementations, including single-field `From` conversions.
- **`tracing`** — structured diagnostic events and spans.

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
use std::io;

#[derive(serde::Serialize, serde::Deserialize, derive_more::From)]
pub struct JobId(u64);

#[derive(Debug, thiserror::Error)]
pub enum JobError {
    #[error("could not read job")]
    Read(#[from] io::Error),
}

let job_id = JobId::from(42);
tracing::info!(job_id = job_id.0, "job started");
```

## Concurrency

- **`tokio`** — asynchronous runtime, task scheduling, timers, and native async I/O.
- **`flume`** — typed channels between producers and consumers, including sync/async communication.

**Prohibited:** build a polling queue for task communication or block an async
worker while waiting for a channel message.

**Preferred:** use Tokio for native async execution and Flume's async channel
operations inside async tasks. Browser WASM uses its host event loop through
`wasm-bindgen-futures`.

## Web and networking

- **`reqwest`** — HTTP clients, including browser WASM requests with compatible features.
- **`axum`** — native HTTP servers, routing, request extraction, and responses.

**Prohibited:** handwrite an HTTP client or routing framework for ordinary API work.

**Preferred:** use Reqwest for outgoing requests and Axum for server endpoints.
Browser WASM is a client target, not an Axum server target.

## WASM

### Rust–JavaScript contracts

- **`wasm-bindgen`** — exported Rust APIs and JavaScript interoperation.
- **`tsify`** — generated TypeScript declarations and typed structural ABI values; enable `js` for JavaScript interoperation.
- **`serde-wasm-bindgen`** — typed conversion at unavoidable external JavaScript
  edges or through generated bindings; never an authored `JsValue` contract.
- **`wasm-bindgen-futures`** — Rust futures and JavaScript promises on the browser event loop.

### Browser APIs and storage

- **`gloo-file`** — browser file and blob APIs; enable `futures` for async reads.
- **`gloo-storage`** — typed local/session storage access.
- **`gloo-utils`** — browser interoperation utilities.
- **`rexie`** — IndexedDB access.
- **`web-sys` / `js-sys`** — direct browser/JavaScript bindings when a higher-level adapter does not cover the required API.
- **`getrandom`** — secure randomness when needed; enable the browser backend appropriate to the selected version.

### Diagnostics and tests

- **`tracing-web`** — browser tracing output, composed with `tracing-subscriber`.
- **`wasm-bindgen-test`** — WASM integration tests, including browser execution; declare it as a development dependency.

**Prohibited:** mirror Rust contracts in handwritten TypeScript, serialize through
JSON merely to cross the JS boundary, or spread low-level browser bindings into
domain code.

**Preferred:** generate contracts with wasm-bindgen/Tsify, use serde-wasm-bindgen
only for unavoidable external value conversion, and keep browser I/O in adapters using Gloo or
Rexie. Use direct bindings only at the remaining unsupported edges.

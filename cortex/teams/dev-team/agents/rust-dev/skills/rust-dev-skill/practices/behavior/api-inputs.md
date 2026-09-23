# Rust API Inputs

## One non-receiver input

Authored functions, methods, and constructors take at most one non-receiver
parameter. Multiple input values form one named domain or operation request.
The receiver `self`, `&self`, or `&mut self` does not count as a parameter.

Command handlers follow the same rule. Parse command-line values at the edge,
then pass one typed command request into application behavior.

## Required actions

- Use a named struct when an operation needs multiple independent values.
- Name that struct for its domain or operation, such as `RotateKeyRequest`.
- Use the domain newtype directly when the operation needs one scalar value.
- Destructure or match the request inside the function or method that owns the
  operation.

## Prohibited actions

- Do not use tuples, arrays, or collections to hide unrelated parameters.
- Do not use generic request names such as `Args`, `Params`, `Input`, or
  `Options` without domain or operation meaning.
- Do not bundle booleans, sentinel values, or cross-workflow optional fields
  into a request to bypass domain modeling.

## Fixed-signature exceptions

Compiler-required trait methods, FFI functions, generated ABI functions, and
framework callbacks may retain their externally required parameters.

- Identify the trait, ABI, or framework contract requiring the signature.
- Assemble the inputs into a named request before delegating to application code.
- Keep the external signature on the adapter; do not propagate it into internal APIs.

## Examples

The pairs show alternative implementations, not definitions to combine in one
module. Prohibited examples can compile while violating the API rules.

### Pass one domain value directly

These fragments assume a `RetryPolicy` with a `limit: RetryLimit` field.
`RetryLimit` is already a validated domain newtype.

**Prohibited:** a request wrapper adds no meaning or invariant. It exists only
to wrap the operation's sole input in another struct.

```rust
pub struct SetRetryLimitRequest {
    pub limit: RetryLimit,
}

impl RetryPolicy {
    pub fn with_limit(mut self, request: SetRetryLimitRequest) -> Self {
        self.limit = request.limit;
        self
    }
}
```

**Preferred:** accept the existing domain value. The receiver does not count
against the one-parameter limit.

```rust
impl RetryPolicy {
    pub fn with_limit(mut self, limit: RetryLimit) -> Self {
        self.limit = limit;
        self
    }
}
```

### Do not hide multiple inputs inside a tuple

A tuple is one syntactic parameter, but independent inputs remain positional.
Changing the container does not satisfy the named-request requirement.
The [domain aggregate rule](../modeling/domain-types.md#replace-positional-tuples-with-named-records)
also covers locals, returns, match results, and fixtures.
These fragments assume a `TransferService` that owns access to the account ledger
and executes a transfer. This operation changes balances; it is not a conversion.

**Prohibited:** tuple positions determine the account roles.

```rust
impl TransferService {
    pub fn execute(&self, values: (AccountId, AccountId, Amount)) {
        let (source, destination, amount) = values;
        // Execute the transfer using these values.
    }
}
```

**Preferred:** accept a named request and destructure it inside the operation.
The request describes operation inputs; it does not wrap a trivial constructor.

```rust
pub struct TransferRequest {
    pub source: AccountId,
    pub destination: AccountId,
    pub amount: Amount,
}

impl TransferService {
    pub fn execute(&self, request: TransferRequest) {
        let TransferRequest { source, destination, amount } = request;
        // Execute the transfer using these values.
    }
}
```

### Contain an externally required signature

Assume a host library owns this callback contract:
`ResizeHandler::resized(&mut self, width: u32, height: u32)`.
The fragments implement that external trait on `WindowAdapter`, which contains
`layout: Layout`. The host requires mutation of the adapter during callbacks.
This assumed contract illustrates the exception; defining the same trait in
application code would not make its signature externally required.

**Prohibited:** the callback's parameter list spreads into an internal API.

```rust
impl ResizeHandler for WindowAdapter {
    fn resized(&mut self, width: u32, height: u32) {
        self.layout.resize(width, height);
    }
}

impl Layout {
    fn resize(&mut self, width: u32, height: u32) {
        self.viewport = Viewport {
            width: Width::from(width),
            height: Height::from(height),
        };
    }
}
```

**Preferred:** keep the fixed signature on the adapter. Convert the two boundary
values into a named aggregate and pass that single value to the internal API.
Here `Width` and `Height` are infallible pixel-count newtypes, including zero;
a constrained dimension would require validation at this boundary.

```rust
pub struct Viewport {
    pub width: Width,
    pub height: Height,
}

impl ResizeHandler for WindowAdapter {
    fn resized(&mut self, width: u32, height: u32) {
        let viewport = Viewport {
            width: Width::from(width),
            height: Height::from(height),
        };
        self.layout = Layout::from(viewport);
    }
}

#[derive(derive_more::From)]
pub struct Layout {
    viewport: Viewport,
}
```

## Validation

- Count non-receiver parameters in changed signatures, including constructors and command handlers.
- Inspect request construction for positional tuples, generic names, and flags or optional fields that encode unrelated workflow states.
- For each retained multi-parameter signature, verify the named external contract and the adapter's single-request delegation.

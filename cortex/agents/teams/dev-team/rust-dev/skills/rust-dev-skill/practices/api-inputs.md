# Rust API Inputs

Authored functions, methods, and constructors take at most one non-receiver
parameter. Multiple input values form one named domain or operation request.
The receiver `self`, `&self`, or `&mut self` does not count as a parameter.

Command handlers follow the same rule. Parse command-line values at the edge,
then pass one typed command request into application behavior.

## Required actions

- Use a named struct when an operation needs multiple independent values.
- Name that struct for its domain or operation, such as `RotateKeyRequest`.
- Construct independent request values with named fields.
- Use the domain newtype directly when the operation needs one scalar value.
- Validate request-wide invariants in a named fallible constructor.
- Destructure or match the request inside the function or method that owns the
  operation.

## Prohibited actions

- Do not use tuples, arrays, or collections to hide unrelated parameters.
- Do not add a trivial positional constructor such as `new(a, b, c)`.
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

### Replace positional constructors with named requests

These method fragments assume `AccountId` and `Amount` domain types and a
`Transfer` struct with `source`, `destination`, and `amount` fields.

**Prohibited:** multiple positional inputs obscure their roles. A tuple would
retain the same ambiguity.

```rust
impl Transfer {
    pub fn new(source: AccountId, destination: AccountId, amount: Amount) -> Self {
        Self { source, destination, amount }
    }
}
```

**Preferred:** one named request keeps independent fields visible at construction.

```rust
pub struct TransferRequest {
    pub source: AccountId,
    pub destination: AccountId,
    pub amount: Amount,
}

impl Transfer {
    pub fn new(request: TransferRequest) -> Self {
        Self {
            source: request.source,
            destination: request.destination,
            amount: request.amount,
        }
    }
}
```

### Make call-site roles visible

These expressions use the corresponding constructors above. `source` and
`destination` both have type `AccountId`, so swapping positional arguments
still compiles. Named fields expose the intended mapping during review.

**Prohibited:** the call hides which account sends and which receives.

```rust
let transfer = Transfer::new(source, destination, amount);
```

**Preferred:** the call names each role. Field names improve reviewability;
they do not prove that the caller selected the correct accounts.

```rust
let transfer = Transfer::new(TransferRequest {
    source,
    destination,
    amount,
});
```

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

**Prohibited:** tuple positions still determine the account roles.

```rust
impl Transfer {
    pub fn new(values: (AccountId, AccountId, Amount)) -> Self {
        let (source, destination, amount) = values;
        Self { source, destination, amount }
    }
}
```

**Preferred:** accept the named `TransferRequest` defined above and destructure
its fields inside the operation that owns them.

```rust
impl Transfer {
    pub fn new(request: TransferRequest) -> Self {
        let TransferRequest { source, destination, amount } = request;
        Self { source, destination, amount }
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
        self.layout = Layout::for_viewport(viewport);
    }
}

impl Layout {
    fn for_viewport(viewport: Viewport) -> Self {
        Self { viewport }
    }
}
```

## Validation

- Count non-receiver parameters in changed signatures, including constructors and command handlers.
- Inspect request construction for positional tuples, generic names, and flags or optional fields that encode unrelated workflow states.
- For each retained multi-parameter signature, verify the named external contract and the adapter's single-request delegation.

# Rust Owned Updates

Consume an owned value when an update replaces it. Return the updated value
without inventing a workflow stage for every edit.

## Required actions

- Use `mut self` for replacement updates and return `Self` or a typed result.
- Retain `&mut self` only for required traits or externally owned mutation contracts.
- Keep those exceptions at their exact boundary.
- Introduce channels only for a real high-level actor or concurrent owner.

## Prohibited actions

- Do not add actor infrastructure merely to avoid an owned update.
- Do not introduce artificial lifecycle phases for a pure value update.

## Replace an owned value

A retry policy owns its retry limit and delay. Changing the limit preserves the
rest of that policy. This updates an existing value; it does not convert a limit
into a policy or interpret another domain's outcome.

**Prohibited:** mutate the existing policy through a borrowed receiver.

```rust
use std::time;

#[derive(derive_more::From)]
pub struct RetryLimit(u32);

pub struct RetryPolicy {
    pub limit: RetryLimit,
    pub delay: time::Duration,
}

impl RetryPolicy {
    pub fn with_limit(&mut self, limit: RetryLimit) {
        self.limit = limit;
    }
}
```

**Preferred:** consume the old policy and return its replacement.

```rust
use std::time;

#[derive(derive_more::From)]
pub struct RetryLimit(u32);

pub struct RetryPolicy {
    pub limit: RetryLimit,
    pub delay: time::Duration,
}

impl RetryPolicy {
    pub fn with_limit(mut self, limit: RetryLimit) -> Self {
        self.limit = limit;
        self
    }
}

let policy = RetryPolicy { limit: RetryLimit::from(3), delay };
let policy = policy.with_limit(RetryLimit::from(5));
```

The previous policy is moved. The returned policy keeps its delay and replaces
only its limit. Neither a conversion trait nor an approval state is needed.

## Validation

- Check that the update consumes the previous value and preserves unchanged fields.
- Identify the exact external contract for every retained mutation exception.

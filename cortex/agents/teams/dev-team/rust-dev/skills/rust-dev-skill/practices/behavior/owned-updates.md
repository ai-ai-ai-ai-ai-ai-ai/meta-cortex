# Rust Owned Updates

Consume an owned value when an update replaces it. Returning the updated value
makes replacement explicit without introducing a workflow stage for every edit.
A transition with genuinely different next actions returns an exhaustive outcome.

## Required actions

- Consume owned Rust state when an update replaces its value.
- Use `mut self` internally and return `Self`, a next state, or a typed result.
- Retain `&mut self` only for required traits or externally owned mutation contracts.
- Keep those exceptions at their exact boundary.
- Introduce channels only for a real high-level actor or concurrent owner.

## Prohibited actions

- Do not add actor infrastructure merely to avoid an owned update.
- Do not introduce artificial lifecycle phases for a pure value update.

## Examples

An owned update should return the resulting value. When an operation can lead
to different next actions, use an enum that carries the corresponding state.
A boolean leaves the caller to infer what happened and what it can do next.

**Prohibited:** mutation retains the same API surface for every outcome, and
`true` does not name the resulting state.

```rust
pub struct Review {
    approved: bool,
}

impl Review {
    pub fn approve(&mut self, approved: bool) -> bool {
        self.approved = approved;
        approved
    }
}
```

**Preferred:** the decision has a domain name, and each outcome carries the
state that owns the next action. The update consumes its previous value.

```rust
#[derive(derive_more::From)]
pub struct SubmissionId(u64);

#[derive(derive_more::From)]
pub struct Review {
    submission: SubmissionId,
}

pub enum Decision {
    Approve,
    RequestChanges,
}

pub enum ReviewOutcome {
    Approved(Approved),
    ChangesRequested(Review),
}

pub struct Approved {
    submission: SubmissionId,
}

impl SubmissionId {
    pub fn value(&self) -> u64 {
        self.0
    }
}

impl Review {
    pub fn replace_submission(mut self, submission: SubmissionId) -> Self {
        self.submission = submission;
        self
    }

    pub fn decide(self, decision: Decision) -> ReviewOutcome {
        match decision {
            Decision::Approve => ReviewOutcome::Approved(Approved {
                submission: self.submission,
            }),
            Decision::RequestChanges => ReviewOutcome::ChangesRequested(self),
        }
    }
}

impl Approved {
    pub fn submission(&self) -> &SubmissionId {
        &self.submission
    }
}
```

Callers match `ReviewOutcome` exhaustively. They receive the selected state
without a second lookup or an optional field. In a real workflow, the owner
admitting `Decision` must establish who may make it; the enum alone proves
neither authorization nor freshness.

## Validation

- Check that replaced values are consumed and the returned value owns the result.
- Test each outcome and ensure callers cannot reuse a consumed capability.
- Identify the exact external contract for every retained mutation exception.

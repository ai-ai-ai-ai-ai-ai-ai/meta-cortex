# Rust Workflow Typestate

Represent a multi-stage workflow with a domain-named owner parameterized by
its state, such as `Publication<State>`. Implement transitions on the owner’s
concrete states. Each transition consumes the owner and returns its next type.

For example, only `Publication<Draft>` can validate and only
`Publication<Validated>` can publish.

This is the highest-priority modeling rule for new or changed meaningful action flows.
Migrate one cohesive flow at a time; do not rewrite unrelated flows merely to
adopt the policy. Pure operations without a lifecycle need no artificial stages.

Domain newtypes explain what a value means. An owning type explains where an
operation belongs. Typestate additionally limits which operations are available
at each stage. These mechanisms complement one another.

## Required actions

### State and transitions

- Use typestate for most meaningful action flows.
- Use distinct state types to carry the data available at each stage.
- Put transition methods on specialized owner implementations, such as
  `impl Publication<Validated>`, rather than on the state data.
- Carry validated domain values forward through transition results.
- Consume `self` when a transition replaces the prior state's capabilities.
- Return an exhaustive outcome enum when a transition has multiple next states.
- Return typed errors for failed validation or failed effects.
- Keep independent state dimensions separate.
- Name the workflow owner for its domain. Keep independent domain objects
  separate when they own distinct behavior rather than stages of one workflow.
- Seal a generic phase contract when external implementations would forge states.

### Capability construction

- Keep advanced state fields private to the module that enforces transitions.
- Admit untrusted inputs through validation before returning a trusted state.
- Limit constructors to states callers are actually allowed to enter.
- Review `Default`, `Deserialize`, `From`, `Clone`, and `Copy` implementations.
  - Reject any implementation that forges or duplicates a restricted capability.
- Deserialize external data into boundary data before validating capabilities.
- Recheck authorization or freshness at effects when external state can change.
- Preserve cryptographic verification at its existing trust boundary.

## Prohibited actions

- Do not require a generic `Session<P>` or `Phase` framework for ordinary flows.
- Do not add artificial states to a pure operation without a lifecycle.
- Do not reuse one field bag with optional stage-specific fields.
- Do not expose an unchecked constructor for a validated or authorized state.
- Do not derive deserialization directly into a restricted capability.
- Do not clone a one-use capability to preserve the pre-transition state.
- Do not treat typestate as proof of runtime authorization or cryptographic safety.

## Publication pipeline

`Publication<Draft> → Publication<Validated> → Publication<Published>`

The publication owns transitions. Each state holds the data available at that
stage. Validation is a conversion; publishing writes a file and is an action.

**Prohibited:** a mutable flag lets callers skip validation or change the content
after validation. Every instance exposes `publish` regardless of its state.

```rust
use std::{fs, io, path::PathBuf};

pub struct Publication {
    pub content: String,
    pub destination: PathBuf,
    pub validated: bool,
}

impl Publication {
    pub fn validate(&mut self) {
        self.validated = !self.content.trim().is_empty();
    }

    pub fn publish(&self) -> io::Result<()> {
        fs::write(&self.destination, &self.content)
    }
}
```

**Preferred:** transitions belong to specialized `Publication<State>`
implementations. Callers can construct only the draft publication.

```rust
pub mod publishing {
    use std::{fs, io, path::PathBuf};

    pub struct Publication<State> {
        state: State,
    }

    pub struct Draft {
        pub content: String,
        pub destination: PathBuf,
    }

    pub struct Validated {
        content: String,
        destination: PathBuf,
    }

    pub struct Published {
        destination: PathBuf,
    }

    #[derive(Debug, thiserror::Error)]
    pub enum PublishError {
        #[error("document is empty")]
        EmptyDocument,
        #[error("could not publish document")]
        Write(#[from] io::Error),
    }

    impl From<Draft> for Publication<Draft> {
        fn from(state: Draft) -> Self {
            Self { state }
        }
    }

    impl TryFrom<Draft> for Validated {
        type Error = PublishError;

        fn try_from(draft: Draft) -> Result<Self, Self::Error> {
            if draft.content.trim().is_empty() {
                return Err(PublishError::EmptyDocument);
            }

            let Draft { content, destination } = draft;
            Ok(Self { content, destination })
        }
    }

    impl Publication<Draft> {
        pub fn validate(self) -> Result<Publication<Validated>, PublishError> {
            let state = Validated::try_from(self.state)?;
            Ok(Publication { state })
        }
    }

    impl Publication<Validated> {
        pub fn publish(self) -> Result<Publication<Published>, PublishError> {
            let Validated { content, destination } = self.state;
            fs::write(&destination, content)?;
            Ok(Publication { state: Published { destination } })
        }
    }

    impl Publication<Published> {
        pub fn destination(&self) -> &PathBuf {
            &self.state.destination
        }
    }
}
```

The initial `From` implementation is deliberately limited to `Publication<Draft>`.
Do not derive `From<State>` for every publication state. Conversion creates
validated data; only publication methods wrap advanced states in the workflow.

### Run the pipeline

```rust
use publishing::{Draft, Publication, PublishError};

fn main() -> Result<(), PublishError> {
    let draft = Draft {
        content: String::from("Release notes"),
        destination: "release-notes.md".into(),
    };

    let publication = Publication::from(draft);
    let publication = publication.validate()?;
    let publication = publication.publish()?;

    println!("Published to {}", publication.destination().display());
    Ok(())
}
```

**Prohibited:** publish a draft, inspect a published result before publishing,
or reuse a publication after a consuming transition. These fail to compile.

**Preferred:** move through the pipeline above. Each returned type exposes only
the next valid operations. Validation and I/O failures return typed errors.

This example writes a file; it does not guarantee atomic writes or durable
storage. Check runtime permissions and freshness at the actual effect boundary.

## Validation

- Test changed domain behavior in Rust.
- Add compile-fail tests for forbidden state construction and action ordering.
- Test each outcome branch and typed failure in the migrated flow.
- Test that invalid external input cannot construct an advanced state.
- Review secret ownership and destruction across consuming transitions.
- Verify these cases with the project's Rust validation tooling.

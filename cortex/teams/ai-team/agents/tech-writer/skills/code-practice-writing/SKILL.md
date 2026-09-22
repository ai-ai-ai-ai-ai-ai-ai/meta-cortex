---
name: code-practice-writing
description: Write and maintain coding practices with concrete rules, supporting code, accurate validation claims, and explicit boundary exceptions.
---

# Code Practice Writing

Write coding-practice documentation for any language, including tests, scripts,
and boundary adapters. Use code to make each rule concrete and verifiable.

## Required actions

### Let code carry programming rules

For Rust and TypeScript practices, code examples must dominate the explanation.
Give each focused rule a prohibited/preferred pair. Keep prose to the requirement,
its motivation, and the context needed to read the code. Cut repeated prose before
cutting signatures, types, or call sites that demonstrate the decision. Do not
pad examples to reach a line-count ratio.

**Prohibited:** several paragraphs about type safety followed by “use newtypes,”
without showing which declarations change.

**Preferred:** one sentence and a pair that makes the distinction visible:
“Give each identifier its own type so unrelated identifiers cannot be exchanged.”

```rust
// Prohibited: these fields accept the same primitive.
pub struct Invoice {
    pub id: u64,
    pub customer: u64,
}
```

```rust
// Preferred: distinct identifier types preserve their meaning.
#[derive(derive_more::From)]
pub struct InvoiceId(u64);

#[derive(derive_more::From)]
pub struct CustomerId(u64);

pub struct Invoice {
    pub id: InvoiceId,
    pub customer: CustomerId,
}
```

These fragments assume `derive_more` with its `from` feature. The identifiers
have no additional validation constraints.

### Show the code needed to decide

Include the signatures, call sites, types, and boundary code needed to expose
the difference. Identify supporting dependencies and omitted context for
fragments. Preferred code must satisfy the applicable coding practices.

**Prohibited:** “Replace positional inputs with a request,” followed only by
`send(request)`. Neither the request's fields nor the replaced signature is visible.

**Preferred:** show the contrasting declarations and calls. This illustrative
Rust fragment assumes existing `Source` and `Destination` domain types:

```rust
// Prohibited API shape; method body omitted.
fn send(&self, source: Source, destination: Destination);

// Preferred request and API shape; method body omitted.
struct SendRequest {
    source: Source,
    destination: Destination,
}
fn send(&self, request: SendRequest);
```

At the call site, show `sender.send(source, destination)` versus
`sender.send(SendRequest { source, destination })`. These are alternative
fragments, not a complete Rust module. They demonstrate the parameter choice
without inventing transport behavior.

### Identify the boundary behind an exception

Name the actual external contract requiring an exceptional signature. Show
where the adapter stops and the compliant internal operation begins. Label
hypothetical contracts explicitly.

- **Prohibited:** “Callbacks can have any number of parameters,” followed by an
  application-authored callback with no external owner.

- **Preferred:** “Assume the host owns `resized(width, height)`. Its adapter builds
  `Viewport { width, height }` and calls `layout.resize(viewport)`.”

The host signature is hypothetical and the example is pseudocode. The exception
belongs to that boundary; naming an internal function `resized` grants no exception.

### Separate design violations from compiler errors

State whether prohibited code fails compilation or merely violates the practice.
Compilation cannot establish ownership, policy compliance, or runtime correctness.

**Prohibited:** “A method with two inputs cannot compile.”

**Preferred:** “The method compiles, but its two non-receiver parameters violate
the one-input rule.” Conversely, calling a method absent from the current state
is a compiler error and should be verified as such.

## Validation

### Execute examples with their stated context

Compile or run examples when the required tooling is available. Supply the
stated supporting types and dependencies. Keep temporary validation scaffolding
outside the distributed skill; do not turn a fragment into a persistent project
merely to check it.

**Prohibited:** compile a fragment without its declared supporting types and
report the resulting missing-type error as proof of the prohibited design.

**Preferred:** supply those types in temporary scaffolding, compile both
alternatives, and separately review which one violates the API rule.

### Verify the claimed failure

Check expected failures for their stated cause, not only for a failing exit
code. Report compiler results separately from semantic review and behavior tests.

**Prohibited:** “The forbidden state transition fails as expected,” when the
compiler actually rejected an unresolved import.

**Preferred:** “The forbidden transition failed because the draft type has no
completion method. The preferred transition compiled; runtime behavior was not tested.”

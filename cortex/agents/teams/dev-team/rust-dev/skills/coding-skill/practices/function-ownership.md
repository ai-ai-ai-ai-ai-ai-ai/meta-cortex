# Function Ownership

This is the repository-wide P1 code-structure rule for every implementation
language. Every authored function, constant, and state variable belongs to a
meaningful owner. Free functions and module-level value declarations are prohibited.
Each owner must satisfy the single-responsibility principle.
Repository automation follows the same ownership requirements.

An owner represents the knowledge, capability, state, lifecycle, or external
contract required by the operation. A file, module, namespace, or generic
utility container is not an owner by itself.

## Required actions

### Single responsibility

- Give each owner one coherent responsibility with one reason to change.
- Put domain decisions on the type that owns the required knowledge.
- Keep invariants, selection rules, priority comparisons, and state
  interpretation with that owner.
- Keep exhaustive matching that implements a domain rule inside its owner.
- Let callers orchestrate through methods named for the requested intent.
- Separate responsibilities that change for independent domain reasons.

For example, an authentication workflow match owns candidate selection. Its caller must not interpret match variants or compare priorities
to reconstruct that decision.

### Decision locality

- Treat repeated predicates on one value as evidence of hidden domain behavior.
- Name the decision before changing its implementation.
- Put the decision on the domain owner of the rule, not automatically on the input.
- Return a semantic enum or discriminated outcome for domain classifications.
- Carry admitted data on the outcome when callers need the selected variant.
- Let callers act on the outcome without reconstructing its prerequisites.
- Apply the same placement rule recursively inside the extracted behavior.
- Keep each nested decision with the domain that owns its meaning.
- Treat more than three nested branches or matches as a signal of mixed
  responsibilities or misplaced domain knowledge.
- Extract those decisions into meaningful owner types with intent-named methods.
- Preserve short-circuit behavior when it protects admission or effects.
- Keep transport records structural at their external boundary.
- Admit those records into meaningful owners when authored behavior needs them.

For example, article traversal must not combine absence, heading kind, and
heading depth checks to decide whether a block starts an article.
When article classification belongs to the article domain, its classification
owner interprets the block and returns `Article` with its heading or `Other`.
The source block must not depend on article policy merely because it supplies data.

A compound condition is evidence, not a mechanical extraction rule. Conditions
that relate independent owners belong to the operation that owns that relation.
An empty wrapper around the original expression does not establish ownership.

### Precise receivers

- Inspect the data used by every helper, including single-field predicates.
- Treat a parameter used as the operation's subject as a possible receiver.
- Move behavior to that subject when it owns the required knowledge.
- Choose the smallest semantic owner that determines the result.
- Put kind-only classification on the kind only when that domain owns the rule.
- Keep decisions that require payload, depth, or children on their aggregate.
- Let a meaningful aggregate API delegate to its nested semantic owner.
- Pass only the related value needed by a comparison or relationship.
- Reuse the existing enum or dependency discriminator in that owner.
- Preserve compiler narrowing where a transport variant exposes its payload.

For example, an article renderer owns whether a block contributes to an article
body. Depending only on the block kind does not move article policy into the
block domain. A rule intrinsic to the block itself can remain on the block.

### Dependency direction

Keep source domains independent of consumer-specific interpretations. Place a
transformation in the destination domain when that domain owns the mapping.
Use the language’s conversion mechanism for direct value conversions.

**Prohibited:** a delivery type imports an address-policy type to produce the
consumer’s address requirement.

**Preferred:** the address domain interprets the delivery kind. Delivery retains
only its own behavior and has no dependency on address policy.

### Operation placement

- Put every authored public, private, and nested function on a meaningful
  domain, application, infrastructure, fixture, or framework owner.
- Use an instance method when the operation depends on owned state or
  capability.
- Use a real trait, interface, or equivalent abstraction only when it expresses
  a shared contract.
- Keep closures local only when they express an immediately used operation.
- Put test behavior on a focused fixture, harness, builder, or scenario owner.
- Keep required language entrypoints and externally fixed callbacks thin.
  Delegate portable behavior to a meaningful owner.
- Name the owner for the domain knowledge or capability it holds.

### Constants and state

- Put constants on the type that owns their meaning.
- Keep mutable state in instance fields, not globals or mutable static members.
- Keep parameters, temporary variables, and local constants inside their owning operation.
- Treat function-valued variables as functions; assigning a helper to a variable
  does not bypass ownership.
- Shared state needs an explicit owner passed to its consumers.

**Prohibited:** a module exports a retry limit, a mutable attempt counter, and
free retry helpers. Grouping them in one file does not give them an owner.

**Preferred:** the retry-limit type owns its constant; a retry session owns its
counter and operations. Each operation keeps temporary values local.

## Prohibited actions

### Overwide inputs

- Do not pass an entire block to a helper that only reads its kind.
- Do not move kind-only logic into an aggregate merely to eliminate a helper;
  select its domain owner first.
- Do not duplicate an enum vocabulary to attach methods.
- Do not introduce a generic wrapper around a discriminator.
- Do not add forwarding layers without a meaningful aggregate contract.

### Decision ownership

- Do not reconstruct an owner's domain decision from its getters or variants
  in a caller.
- Do not replace that decision with a chain of mechanical getters.
- Do not return a boolean that erases a named domain decision.
- Do not move a compound predicate into a generic helper and call it locality.
- Do not combine independent responsibilities in a god object.
- Do not add a wrapper whose only purpose is to conceal misplaced behavior.
### Operation placement

- Do not introduce an unowned free function, constant, static, or module-level variable.
- Do not move global mutable state into mutable static members to disguise it.
- Do not treat a file, module, namespace, or directory name as function
  ownership.
- Do not hide functions in `Utils`, `Helpers`, `Common`, `Shared`, or another
  catch-all owner.
- Do not create an empty type, trait, interface, or object only to relocate free
  functions.
- Do not keep a nested helper function when its behavior belongs to an existing
  owner.
- Do not use a closure to bypass ownership for reusable behavior.
- Do not invent identity, lifecycle phases, or a generic framework for a pure operation.

## Narrow boundaries

Only an exact compiler or external framework requirement can justify an
unowned declaration, including a required exported constant or static.
Convenience, visibility, and reuse are not exceptions.

A compiler-required entrypoint, FFI export, generated ABI function, test-runner
entrypoint, or framework callback may retain its externally owned shape.

Document the exact external requirement when the boundary is not
self-evident. Keep the boundary function limited to decoding, delegation, and
encoding. A conventional name alone does not establish an exception.

### Presentation edges

Boundary code may discriminate transport variants for decoding or encoding.
Presentation code may discriminate public outcomes to choose their display.
These branches must not introduce selection, eligibility, authorization, or
other domain rules owned elsewhere.

## Validation

- Treat every new or changed unowned function, constant, static, or module-level
  variable as a P1 review finding.
- Treat misplaced domain decisions or mixed owner responsibilities in new or
  changed code as P1 findings.
- Inspect public, private, nested, test, callback, and adapter functions, plus
  module-level declarations and mutable static members.
- Verify that the selected owner has semantic knowledge or capability required
  by the operation.
- Reject a mechanical move into a catch-all type or object.
- Use language-specific static enforcement where it exists.
- Keep review enforcement mandatory where static enforcement does not exist.

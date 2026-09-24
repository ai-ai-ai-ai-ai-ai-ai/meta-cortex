# Domain API Integrity

This is the repository-wide P1 contract for authored domain and application
APIs. Apply it in every implementation language. Examples below use
language-neutral pseudocode; they are not executable source.

Domain types carry meaning and metadata. API shapes preserve that meaning from
external decoding through state, behavior, persistence, and results.

Apply the [single-responsibility ownership rule](function-ownership.md) when
placing domain decisions on these types.

## Required actions

### Types and states

- Give every domain and application value a distinct, meaningful type, including
  text, numbers, bytes, identifiers, counts, amounts, and durations.
- Preserve that type in private code and local values as well as public APIs.
- Do not substitute a descriptive variable name or primitive alias for a domain type.
- Use a nominal newtype, opaque type, enum, or value object when a primitive
  representation has domain meaning.
- Use an enum or discriminated union for a closed set or named state.
- Use semantic enums for domain-state, policy, mode, and command parameters,
  even when they currently have only two cases.
- Put state-specific data on the state or variant that owns it.
- Keep independent state dimensions in independent types.
- Match evolving domain alternatives exhaustively.
- Keep internal application values concrete after boundary decoding.

**Prohibited:** store domain identifiers as interchangeable primitives.

```text
Invoice { id: String, customer: String, total: Number }
```

**Preferred:** preserve a distinct type for each meaning.

```text
Invoice { id: InvoiceId, customer: CustomerId, total: InvoiceTotal }
```

### Construction and transitions

- Validate untrusted input before constructing a trusted domain value.
- Keep unchecked construction private to the validating owner.
- Keep advanced capability construction private to the legal transition.
- Expose an operation only on the state or capability where it is legal.
- Return a named next state or exhaustive outcome from a state transition.
- Preserve a meaningful success state or capability in the transition result.
- Return success without a value only for a
  side effect with no meaningful success state.
- Return semantic outcomes for eligibility, classification, and selection decisions.
- Put each decision in the domain that owns the rule.
- Do not choose its owner solely from the input type.
- Choose the [precise receiver](function-ownership.md#precise-receivers).
- Keep consumer-specific interpretations out of source types, even when the
  interpretation reads only one field.
- Keep aggregate APIs meaningful when they delegate to nested owners.
- Carry the selected data on its outcome instead of requiring another lookup.
- Apply [decision locality](function-ownership.md#decision-locality) recursively.
- Recheck runtime authorization or freshness at the effect boundary when
  external state can change.

**Prohibited:** expose publication before the document is approved.

```text
Draft.publish() → PublishedDocument
```

**Preferred:** let approval produce the capability required for publication.

```text
Draft.approve(review: Review) → ApprovedDocument or ApprovalFailure
ApprovedDocument.publish() → PublishedDocument or PublicationFailure
```

### API inputs and failures

- Give each authored function or method at most one non-receiver parameter.
- Use one named domain or operation request when an API needs multiple values.
- Construct independent request values with named fields.
- Return a domain-specific failure with a stable kind or code.
- Handle or propagate typed failures explicitly at every caller.
- Translate foreign exceptions into concrete failures at the narrow adapter.
- Preserve a typed source when one operation fails because another operation
  failed.
- Distinguish validation, authorization, unavailable-state, conflict, and
  external-effect failures when callers act on them differently.
- Propagate failure until the owner that can classify, recover, or present it.

**Prohibited:** hide independent inputs in positional parameters and erase failure.

```text
TransferService.send(source: String, destination: String, amount: Number) → Boolean
```

**Preferred:** name the request fields and the possible result.

```text
TransferRequest { source: AccountId, destination: AccountId, amount: TransferAmount }
TransferService.send(request: TransferRequest) → TransferReceipt or TransferFailure
```

### Boundaries and versions

- Decode raw external data into concrete domain values at the narrowest edge.
- Decode known JSON schemas into their concrete record or enum types.
- Keep parsed values typed throughout internal operations.
- Keep raw JSON trees only inside decoding or genuinely dynamic protocol edges.
- Encode domain values only when crossing a required external boundary.
- When a domain event time is owned by a Unix-millisecond newtype, preserve
  that newtype through application layers.
- Convert that value to an ISO string only at a required external presentation
  or serialization boundary.
- Give every persisted or wire schema version a named domain type.
- Keep one explicit current writer version and an explicit supported-reader
  set.
- Reject unsupported versions with a typed failure.
- Define the migration and rollback contract before changing a persisted or
  wire shape.
- Preserve the owning schema and generated binding instead of creating a
  language-local mirror.

**Prohibited:** pass encoded documents between internal operations.

```text
OrderStore.load(id: OrderId) → JsonText
ShippingService.dispatch(order_json: JsonText)
```

**Preferred:** decode once and preserve the typed record inside the application.

```text
OrderStore.load(id: OrderId) → Order or OrderReadFailure
ShippingService.dispatch(order: Order) → DispatchReceipt or DispatchFailure
```

## Prohibited actions

### Types and states

- Do not expose a raw primitive when it carries domain meaning.
- Do not embed an unnamed union in a field, parameter, return, or collection.
- Do not represent a named state with a boolean, sentinel, optional field bag,
  fake default, or decorative missing variant.
- Do not use an erased value bag as a domain or application value.
  - This includes unvalidated top types, generic records, raw JSON trees,
    and equivalent catch-all values.
- Do not cast parsed JSON into a known type without validating its fields.
- Do not serialize a typed value merely to pass it between internal operations.
- Do not use an unchecked cast, non-null assertion, panic shortcut, or
  equivalent escape hatch to manufacture a valid state.

**Prohibited:** claim a decoded value is valid through a cast.

```text
invoice ← CAST raw_json AS Invoice
```

**Preferred:** validate at the boundary and return a typed outcome.

```text
invoice_result ← InvoiceDecoder.decode(raw_json)
MATCH invoice_result
  Decoded(invoice) → use_invoice(invoice)
  Rejected(reason) → report_invalid_invoice(reason)
```

### Enforcement exceptions

- Do not use a file-, module-, or package-wide lint suppression to avoid
  repairing an API, domain-state, newtype, or ownership violation in a migrated
  scope.
- Retain a narrow lint exception only when its owning language or boundary
  policy permits it and identifies the exact external contract.

**Prohibited:** suppress domain-type checks for an entire adapter package.

```text
SUPPRESS domain_type_rule FOR adapter_package
```

**Preferred:** keep the exception on the exact externally owned signature.

```text
HostCallback.resize(width: HostNumber, height: HostNumber)
  → WindowController.resize(Viewport { width: Width(width), height: Height(height) })
```

The callback is a hypothetical fixed host contract. Its exception does not apply
to other adapter APIs.

### API inputs and failures

- Do not use multiple positional parameters, tuples, arrays, or collections to
  hide independent request values.
- Do not use unchecked success-value extraction or convert an error into a fake success.
- Do not introduce generic optional-value or catch-all error wrappers that erase meaning.
- Do not catch or convert a failure unless the current owner adds domain
  meaning, recovery, or boundary translation.

**Prohibited:** report a failed payment as successful.

```text
MATCH payment_result
  Paid(receipt) → receipt
  Failed(error) → fabricated_receipt
```

**Preferred:** preserve the failure for the owner that can handle it.

```text
MATCH payment_result
  Paid(receipt) → PaymentCompleted(receipt)
  Failed(error) → PaymentRejected(error)
```

### Schema versions

- Do not silently accept an unknown schema version.
- Do not change a persisted or wire shape without its explicit version and
  migration decision.

**Prohibited:** decode an unknown version using the current schema.

```text
MATCH wire_version
  V1 → decode_v1(document)
  anything_else → decode_v1(document)
```

**Preferred:** reject unsupported input at the decoding boundary.

```text
MATCH wire_version
  V1 → decode_v1(document)
  unsupported → UnsupportedSchemaVersion(unsupported)
```

## Narrow boundaries

- Keep raw values only in private representation storage or required external edges.
  - Edges include serialization, databases, FFI, generated bindings, browsers, and hosts.
- Validate external values and convert them immediately.
- Preserve an externally fixed boolean field only in its transport contract.
- Convert that field to a semantic enum before domain policy reads it.
- Return named domain alternatives from every authored decision, even for two cases.
- Do not expose authored boolean predicates or store inferred booleans as workflow state.
- Convert dependency predicate results into named outcomes before choosing behavior.
- Keep conversions on existing owners, including in tests and tooling.
- Do not treat boolean exhaustiveness as domain meaning.

**Prohibited:** expose a dependency predicate as the application's decision.

```text
Queue.is_empty() → Boolean
```

**Preferred:** name the meaning before the caller chooses an action.

```text
Queue.state() → QueueState
QueueState = Empty | Ready
```

### Fixed edge contracts

- Preserve compiler-required signatures, traits, generated bindings, and fixed callbacks
  only under the owning language's boundary exceptions.
- Do not use a general boundary exception to waive a specific authored-contract rule.
- Keep adapters thin and delegate to a compliant domain API.
- Give user content and locale keys domain types, such as `MessageBody` and `TranslationKey`.
- Keep their underlying text inside the owning value type.

**Prohibited:** let a fixed host callback dictate the domain API's raw types.

```text
HostCallback.message(text: HostString) → Conversation.append(text: String)
```

**Preferred:** normalize the host value before calling the domain owner.

```text
HostCallback.message(text: HostString) → Conversation.append(body: MessageBody)
```

This hypothetical callback constructs `MessageBody` through its owning conversion.

### Names must survive the API

- Preserve domain types through collections and private helpers.
- Let each type own its representation and validation.
- Reject substitutions between unrelated identifiers through type checking.

**Prohibited:** erase the customer identifier in a private helper.

```text
InvoiceStore.find_for_customer(customer: String) → Invoices
InvoiceStore.find_for_customer(invoice_id.text)
```

**Preferred:** keep the customer type at the helper's boundary.

```text
InvoiceStore.find_for_customer(customer: CustomerId) → Invoices
InvoiceStore.find_for_customer(customer_id)
```

## Validation

- Review every new or changed field, parameter, return, state, and boundary.
- Verify named request construction and one-parameter signatures.
- Test every state transition, exhaustive outcome, and typed failure branch.
- Test malformed and unsupported external input at the decoding boundary.
- Test every supported schema version and unsupported-version rejection.
- Use language-specific static enforcement where it exists.
- Keep semantic review mandatory because syntax checks cannot prove ownership,
  domain meaning, capability integrity, or migration safety.

**Prohibited:** “The compiler passed, so the schema migration is safe.”

**Preferred:** “Types compile. Supported-version fixtures pass. Unknown versions
are rejected. The migration and rollback paths were reviewed separately.”

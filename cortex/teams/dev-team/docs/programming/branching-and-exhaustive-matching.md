# Branching and Exhaustive Matching

Apply this rule to authored TypeScript, JavaScript, and Rust, including pure
functions, Effect workflows, adapters, tests, tooling, and examples. Generated
and dependency-owned code keeps its external form.

## Required actions

### Use patterns instead of boolean if conditions

- Match domain enums and unions directly. Do not reduce their variants to booleans.
- Use Rust `match` and TypeScript `switch`, including inside Effect generators.
- Prohibit ordinary boolean `if`, `else if`, and `if`/`else`. Short guards,
  validation, mechanical predicates, and code outside Effect have no exemption.
- At a required raw-value boundary, match literals, ranges, slices, or dependency
  booleans immediately. Keep the conversion on the existing owner.
- Convert dependency booleans into named domain outcomes before choosing workflow
  actions. Two-case decisions still need meaningful names.
- Keep clear native branches. Do not add matcher DSLs, callback pipelines, generic
  branching helpers, or decorative `True`/`False` enums to avoid an `if`.

These alternative method bodies receive `delivery: DeliveryKind` and return
`AddressRequirement`. `DeliveryKind` has `Shipment` and `Download` variants;
`AddressRequirement` has `Required` and `NotRequired` variants. All fragments
compile; the boolean branches violate this rule.

**Rust — prohibited:** turn the delivery kind into a boolean.

```rust
if matches!(delivery, DeliveryKind::Shipment) {
    AddressRequirement::Required
} else {
    AddressRequirement::NotRequired
}
```

**Rust — preferred:** match the delivery kind directly.

```rust
match delivery {
    DeliveryKind::Shipment => AddressRequirement::Required,
    DeliveryKind::Download => AddressRequirement::NotRequired,
}
```

**TypeScript — prohibited:** turn the delivery kind into a boolean.

```ts
if (delivery === DeliveryKind.Shipment) {
  return AddressRequirement.Required;
}
return AddressRequirement.NotRequired;
```

**TypeScript — preferred:** use the native switch.

```ts
switch (delivery) {
  case DeliveryKind.Shipment:
    return AddressRequirement.Required;
  case DeliveryKind.Download:
    return AddressRequirement.NotRequired;
}
```

### Encourage Rust conditional patterns

Rust `if let`, `else if let`, `if let ... else`, and `let ... else` are pattern
matching and are allowed and encouraged for focused variant handling or payload
extraction. An unmatched case may intentionally take the same fallback or do
nothing. Use a full exhaustive `match` when variants need distinct decisions
that must be revisited when the enum grows.

The exception requires a genuine pattern on the value. Do not disguise a
boolean condition as `if let true = predicate`, append boolean conditions to
a let-chain, or put an ordinary `else if condition` after a pattern branch.
Match guards that refine a pattern remain pattern matching; they must preserve
the exhaustive handling required for closed domain alternatives.

**Prohibited:** use `if let true = matches!(event, Event::Progress(_))` to
reintroduce a boolean guard and discard its payload.

- **Preferred:** these alternative fragments assume existing event and reporting
  owners; each fragment intentionally treats all non-progress events alike.

```rust
if let Event::Progress(update) = event {
    reporter.progress(update);
} else {
    reporter.idle();
}
```

```rust
let Event::Progress(update) = event else {
    return;
};
reporter.progress(update);
```

### Do not use ternary conditionals

Do not use the conditional (`condition ? first : second`) operator in authored
code. Use the same explicit pattern matching required for boolean `if`
conditions. A shorter spelling does not justify losing named alternatives.

### Close every domain match

For decisions over a closed enum or discriminated union, match every variant
explicitly. Group variants only when they intentionally share behavior. Do not
use a wildcard, `default`, or fallback to absorb future variants in these
decisions. The compiler or a required static check must reject a newly added
variant until the decision is updated. Focused Rust conditional patterns follow
the exception above; a catch-all for an open raw input is not an enum default.
In TypeScript, require `@typescript-eslint/switch-exhaustiveness-check` with
`allowDefaultCaseForExhaustiveSwitch: false` and
`considerDefaultExhaustiveForUnions: false`, plus fallthrough checking. TypeScript
does not enforce every exhaustive switch by itself, so the lint gate is mandatory.
Keep Effect sequencing and error handling around native branches. Existing
library matches must remain exhaustive until migrated; use them in new code
only when native constructs cannot clearly express the required pattern.

**Prohibited:** a new field type silently receives the text-field prompt.

```ts
const question = field.type === FieldType.Choice
  ? { title: field.question, options: field.options }
  : { title: field.question };
```

**Preferred:** every field type is named, including cases that share output.

```ts
switch (field.type) {
  case FieldType.Text:
  case FieldType.Integer:
    return { title: field.question };
  case FieldType.Choice:
    return { title: field.question, options: field.options };
}
```

## Validation

- Check that adding a variant fails the relevant compiler or static check until
  the new arm is handled.
- Lint authored TypeScript and JavaScript against `IfStatement` and
  `ConditionalExpression`, including code outside Effect workflows.
- Review Rust syntax for boolean `if` expressions while allowing genuine
  conditional patterns. A keyword search or the standard Clippy baseline alone
  does not establish this distinction.
- Verify the permitted Rust pattern forms and reject boolean disguises and
  mixed let-chains. Review pattern guards and intentional unmatched handling.
- Test behavior for each variant when its outcome or payload differs.

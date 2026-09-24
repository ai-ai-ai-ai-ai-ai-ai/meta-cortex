# Branching and Exhaustive Matching

Apply these rules to authored code in every language, including pure functions,
effectful workflows, adapters, tests, tooling, and examples. Generated and
dependency-owned code keeps its external form. Examples below are language-neutral
pseudocode, not executable source.

## Required actions

### Use patterns instead of boolean if conditions

- Match named domain alternatives directly.
- Do not reduce domain alternatives to booleans.
- Prohibit ordinary boolean conditionals, including short guards, validation,
  and mechanical predicates.
- At a required raw-value boundary, match the input directly.
- Convert dependency booleans into named outcomes before choosing workflow actions.
- Keep conversions on the existing owner.
- Give both outcomes meaningful names, even for a two-case decision.
- Prefer clear native patterns.
- Do not add callback pipelines, generic branching helpers, or true/false wrappers
  just to avoid a condition.
- Use a library matcher only when native constructs cannot clearly express the
  required pattern.
- Keep existing library matches exhaustive until they are migrated.

**Prohibited:** erase the domain alternatives before choosing an action.

```text
is_shipment ← delivery equals Shipment
IF is_shipment THEN require_address ELSE skip_address
```

**Preferred:** name both alternatives in the decision.

```text
MATCH delivery
  Shipment → require_address
  Download → skip_address
```

### Do not use ternary conditionals

- Prohibit ternary conditional operators in languages that provide them.
- Use explicit pattern matching.
- Keep named alternatives visible even when a conditional would be shorter.

**Prohibited:** hide the alternatives in a boolean expression.

```text
address_requirement ← is_shipment ? Required : NotRequired
```

**Preferred:** match the domain value directly.

```text
address_requirement ← MATCH delivery
  Shipment → Required
  Download → NotRequired
```

### Close every domain match

- Name every variant when deciding over a closed set of alternatives.
- Group variants only when they intentionally share behavior.
- Do not let a wildcard or fallback silently absorb future variants.
- Require the compiler or a static check to reject missing variants.
- For focused payload extraction, make unmatched handling intentional.
- Keep open-input catch-alls separate from closed-domain decisions.

**Prohibited:** let a fallback decide the policy for future variants.

```text
MATCH delivery
  Shipment → Required
  anything_else → NotRequired
```

**Preferred:** name every variant, including those with the same result.

```text
MATCH delivery
  Shipment → Required
  Download → NotRequired
  Pickup → NotRequired
```

Adding another delivery kind must fail the static check until its policy is named.

## Validation

- Add a variant and verify that incomplete domain decisions fail the relevant
  compiler or static check.
- Review focused patterns, unmatched handling, and boundary conversions for
  preserved domain meaning.
- Test variants separately when their outcomes or payloads differ.

**Prohibited:** claim exhaustive handling because tests cover today's variants.

**Preferred:** also verify that adding a variant makes an incomplete decision
fail the required static check.

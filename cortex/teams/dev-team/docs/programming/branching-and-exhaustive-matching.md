# Branching and Exhaustive Matching

Apply these rules to authored code in every language, including pure functions,
effectful workflows, adapters, tests, tooling, and examples. Generated and
dependency-owned code keeps its external form.

## Required actions

### Use patterns instead of boolean if conditions

- Match named domain alternatives directly; do not reduce them to booleans.
- Prohibit ordinary boolean conditionals, including short guards, validation,
  and mechanical predicates.
- At a required raw-value boundary, match the input directly. Convert dependency
  booleans into named domain outcomes before choosing workflow actions.
- Keep that conversion on the existing owner. Two-case decisions still need
  meaningful names.
- Prefer clear native patterns. Do not add matcher libraries, callback pipelines,
  generic branching helpers, or decorative true/false wrappers to avoid a condition.
- Use a library matcher only when native constructs cannot clearly express the
  required pattern. Existing library matches must remain exhaustive until migrated.

**Prohibited:** turn a delivery kind into an “is shipment” flag, then use that
flag to decide whether an address is required.

**Preferred:** match the delivery kind: shipment requires an address; download
does not. Both alternatives retain their domain meaning.

### Do not use ternary conditionals

- Prohibit ternary conditional operators in languages that provide them.
- Use explicit pattern matching; a shorter spelling does not justify losing
  named alternatives.

**Prohibited:** choose an address requirement through a compact boolean
conditional expression.

**Preferred:** name the delivery alternatives and their address requirements
in the match.

### Close every domain match

- Name every variant when deciding over a closed set of alternatives.
- Group variants only when they intentionally share behavior.
- Do not let a wildcard or fallback silently absorb future variants.
- Require the compiler or a static check to reject missing variants.
- Distinguish a complete domain decision from focused payload extraction with
  intentional unmatched handling, or a catch-all for open external input.

**Prohibited:** handle shipment explicitly and treat every other delivery kind
as address-free, including kinds added later.

**Preferred:** name shipment and download explicitly. Adding pickup requires
reviewing its address policy before checks pass.

## Validation

- Add a variant and verify that incomplete domain decisions fail the relevant
  compiler or static check.
- Review focused patterns, unmatched handling, and boundary conversions for
  preserved domain meaning.
- Test variants separately when their outcomes or payloads differ.

**Prohibited:** claim exhaustive handling because tests cover today's variants.

**Preferred:** also verify that adding a variant makes an incomplete decision
fail the required static check.

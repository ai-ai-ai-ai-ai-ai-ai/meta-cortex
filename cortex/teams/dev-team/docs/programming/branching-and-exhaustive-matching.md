# Branching and Exhaustive Matching

## Required actions

### Do not use ternary conditionals

Do not use the conditional (`condition ? first : second`) operator in authored
code. It hides a decision inside an expression and lets a new domain alternative
fall into an existing branch. Use a match or switch over a named closed state
when alternatives determine behavior. Use ordinary `if` guards or `if`/`else`
for local mechanical conditions, such as a range check, that are not domain
alternatives.

### Close every domain match

Match every variant of a closed enum or discriminated union explicitly. Group
variants only when they intentionally share behavior. Do not use a wildcard,
`default`, or an `else` branch to absorb future variants. The compiler or a
required static check must reject a newly added variant until the decision is
updated. In TypeScript, enable switch exhaustiveness checking and, where
needed, assign the value remaining after the switch to `never`.

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
const unhandled: never = field;
return unhandled;
```

## Validation

- Check that adding a variant fails the relevant compiler or static check until
  the new arm is handled.
- Lint authored TypeScript and JavaScript against conditional expressions.
- Test behavior for each variant when its outcome or payload differs.

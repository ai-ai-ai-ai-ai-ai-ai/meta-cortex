# TypeScript Function Ownership

Apply the [common function ownership rules](../../../../../../../skills/dev/coding-skill/practices/function-ownership.md)
and [TypeScript domain structure](typescript-domain-structure.md). These
requirements specialize ownership for TypeScript and Svelte without weakening
the common rule.

## TypeScript owners

- Use a concrete kind owner or typed companion for TypeScript enum semantics.
- Reserve authored TypeScript static methods for narrow construction builders.
- Put TypeScript execution, validation, formatting, and dispatch on instances.
- Give those instances the request, state, or capability that their behavior owns.
- Do not mutate primitive or enum prototypes to add TypeScript behavior.
- Do not rename TypeScript execution to a builder merely to retain a static method.
- Do not create an empty instance that serves only as a container for former statics.

## Component boundaries

Svelte component handlers and lifecycle callbacks belong to the component only
when they use that component's state or interaction contract. Shared behavior
moves to its meaningful domain or application owner.

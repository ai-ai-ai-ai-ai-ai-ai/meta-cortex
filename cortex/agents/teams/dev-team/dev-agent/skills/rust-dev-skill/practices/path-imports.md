# Rust Paths and Imports

Authored Rust keeps meaningful context without spelling a dependency hierarchy
at each use site.

### Required actions

- Keep every non-`use` path to at most two inline segments.
- Import the owning module or type when a reference would exceed that limit.
- Retain useful context such as `auth::Item` or `SecretValue::from_yaml_str`.
- Keep a required boundary free function module-qualified so its external
  context remains visible.
- Import `std::str` and write `str::from_utf8(data)` for UTF-8 decoding.
- Deny `clippy::absolute_paths` as the mechanical baseline.
- Set `absolute-paths-max-segments = 2` at each applicable Clippy configuration
  boundary.
- Review relative and other non-absolute paths semantically because the Clippy
  lint does not enforce the complete readability rule.

### Prohibited actions

- Do not author a non-`use` path with more than two inline segments.
- Do not exempt paths rooted at `crate`, `self`, `super`, `std`, `core`, or
  `alloc`.
- Do not replace meaningful module context with an imported bare free function.
- Do not write `std::str::from_utf8(data)`.
- Do not import `from_utf8` and write the ambiguous `from_utf8(data)` call.

## Examples

These expression fragments assume `data: &[u8]` in a fallible operation.

**Prohibited:** a long path repeats infrastructure details at the call site.
Importing only `from_utf8` also removes useful module context.

```rust
let text = std::str::from_utf8(data)?;
```

**Preferred:** import the module and retain the operation's meaningful qualifier.
The `use` path is not subject to the two-segment call-site limit.

```rust
use std::str;

let text = str::from_utf8(data)?;
```

## Validation

- Run Clippy with the configured two-segment limit.
- Review relative paths and preserved module context separately.

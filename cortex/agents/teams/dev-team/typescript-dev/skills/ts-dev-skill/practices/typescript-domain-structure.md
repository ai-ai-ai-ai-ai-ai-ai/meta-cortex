# TypeScript Domain Types

Use types that carry domain meaning through private and public code, tests,
state, collections, and boundaries. Portable product/security types come from
generated Rust contracts; TypeScript owns browser and presentation vocabulary.

Examples are alternative fragments. Supporting domain types and collaborators
are supplied by the application; method fragments belong to their named owner.

## Preserve value identity

Use generated nominal types, opaque types, or value objects for scalars and
named interfaces for aggregates. A primitive alias is not nominal. User content
and locale keys need names too. Keep raw representation inside the value owner
or required external edge; never unwrap merely to cross an application layer.

**Prohibited:**

```ts
type PanelId = string;
interface PanelSelection { readonly id: string; }
```

**Preferred:**

```ts
class PanelId {
  private constructor(private readonly value: string) {}
  static from(value: string): PanelId { return new PanelId(value); }
}
interface PanelSelection { readonly id: PanelId; }
```

## Construct trusted values at the boundary

The preceding PanelId accepts any string. Constrained values need a validating
parser/factory. Keep brand tokens and unchecked construction private. Do not
fabricate brands, expose writable invariant fields, or mirror Rust validation.
Effectful decoders use Effect Schema with typed failures.

**Prohibited:**

```ts
const panel_id = raw as PanelId;
controller.select(panel_id);
```

**Preferred:**

```ts
// Inside the adapter; parser returns a typed decoding Effect.
const panel_id = yield* parser.decode(raw);
controller.select(panel_id);
```

## Declare the complete union separately

Use a named union with enum-backed variants; place data only on its owner.
Do not inline alternatives into fields, generic arguments, arrays, or promises.

**Prohibited:**

```ts
interface PanelState {
  readonly selection: PanelId | false;
}
```

**Preferred:**

```ts
enum PanelSelectionKind { Empty = "empty", Selected = "selected" }
type PanelSelection =
  | { readonly kind: PanelSelectionKind.Empty }
  | { readonly kind: PanelSelectionKind.Selected; readonly id: PanelId };
interface PanelState { readonly selection: PanelSelection; }
```

## Nest vocabulary that shares an owner

Same-prefix operations belong under a coherent object and operation enum.
Keep YAML nesting aligned with that structure; do not flatten unrelated request
fields into one enum. Closed field allow-lists use enum vocabulary, not strings.

**Prohibited:**

```ts
enum RequestKind {
  DocumentExportAssemble = "documentExportAssemble",
  DocumentExportPublish = "documentExportPublish",
}
const allowed = new Set(["destination", "format"]);
```

**Preferred:**

```ts
enum DocumentExportOperation { Assemble = "assemble", Publish = "publish" }
interface DocumentExport {
  readonly operation: DocumentExportOperation;
  readonly destination: ExportPath;
}
interface ExportRequest { readonly documentExport: DocumentExport; }
enum ExportField { Destination = "destination", Format = "format" }
// Inside the codec, using its existing named vocabulary request:
const fields: RequestFieldVocabulary<ExportField> = { vocabulary: ExportField };
validator.check(fields);
```

## Version owned persisted formats

Give TypeScript-owned wire/persisted versions a named type, one current writer,
and an explicit supported-reader set. Reject unsupported versions with a domain
failure; require a migration before changing shape. Do not silently overwrite
an unrecognized version.

**Prohibited:**

```ts
// Inside an importer:
return decoder.current(raw); // Ignores the declared schema version.
```

**Preferred:**

```ts
// Inside the importer; schema is a decoded, validated versioned record.
switch (schema.version) {
  case WorkspaceVersion.V1: return migrations.fromV1(schema);
  case WorkspaceVersion.V2: return decoder.current(schema);
}
```

## Keep capabilities behind their transitions

State owners expose only legal operations. Keep advanced construction private
to validation and use named transitions, not parallel flags. Follow function
ownership: meaningful instances own execution/validation; static methods only
build values. Do not invent a lifecycle for a pure calculation.

**Prohibited:**

```ts
// Caller fabricates an advanced state:
const approved = raw as ApprovedDraft;
publisher.publish(approved);
```

**Preferred:**

```ts
// Inside the workflow owner:
const approved = yield* review.approve(draft);
yield* publisher.publish(approved);
```

## Keep failures and secrets with their owners

Expected failures use Effect’s concrete tagged error channel with stable enum
codes and preserved source errors; catch only to classify, recover, or present.
Do not throw strings, store generic Error as a domain failure, or add Result/Maybe
utilities. Codec-local accumulated field issues remain local, never a competing
runtime Result abstraction. Follow supplied secret-lifecycle rules: no plaintext
logs/persistence and no retained secret after the interaction ends.

**Prohibited:**

```ts
// Inside a workflow:
throw "import failed";
```

**Preferred:**

```ts
// Inside the same workflow; failure retains its concrete cause and code:
return Effect.fail(failure);
```

## Validation

- Review nominal identity, named unions, ownership, external conversions, and version rejection.
- Check nested request/YAML shapes and enum field vocabularies.
- Reject local Result/Maybe utilities, erased failure sources, and plaintext leaks.
- Run type/state/behavior checks; preserve browser and security evidence.
- Follow the supplied single-parameter and Effect rules; generated/dependency types are not authored models.

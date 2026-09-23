# TypeScript Domain Types

Use types that carry domain meaning through private and public code, tests,
state, collections, and boundaries. In Rust/WASM projects, portable
product/security types come from generated Rust contracts; TypeScript owns
browser and presentation vocabulary. Otherwise, TypeScript may own the project's
domain types and rules as well.

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

## Serialize YAML from typed values

**Prohibit building YAML from strings.** Do not construct documents from string
literals, template literals, concatenation, joined lines, indentation helpers,
replacement, or string fragments. This includes static catalog examples,
recovery requests, configuration generators, and valid test fixtures. A branded
`YamlText`, assertion, or parse-after-construction step does not make an encoded
string a typed document.

Construct the canonical named request/wire type, using its enums and domain
values, then pass it to the project's YAML serializer at the output boundary.
Derive wire types from the owning schema or generated contract; do not maintain
a second shape solely for serialization. Validate external data at its decoder.

The following alternative method bodies assume the declarations below and the
project's `yaml` package. The `FrameworkInitYaml` instance owns its typed request;
the raw string return is confined to the external output adapter.

```ts
import { stringify } from "yaml";

enum CommandName { FrameworkInit = "framework.init" }
enum Harness { None = "none" }
enum InstructionAction { Skip = "skip" }
interface InitArguments {
  readonly harness: Harness;
  readonly instructions: InstructionAction;
}
interface FrameworkInitRequest {
  readonly name: CommandName.FrameworkInit;
  readonly arguments: InitArguments;
}
```

**Prohibited:** wire structure and values are assembled as text, even if fixed.
These alternatives both violate the rule; wrapping or parsing the result would
not fix construction.

```ts
// Inside the output adapter:
encode(): string {
  return "name: framework.init\narguments: {harness: none, instructions: skip}";
}

// Another prohibited implementation:
encode(): string {
  return `name: ${this.request.name}\narguments: {harness: ${this.request.arguments.harness}, instructions: ${this.request.arguments.instructions}}`;
}
```

**Preferred:** construct typed data and let the serializer own YAML syntax and
escaping. These call-site statements belong inside the caller's owning method.

```ts
class FrameworkInitYaml {
  constructor(private readonly request: FrameworkInitRequest) {}
  encode(): string {
    return stringify(this.request);
  }
}

const request: FrameworkInitRequest = {
  name: CommandName.FrameworkInit,
  arguments: { harness: Harness.None, instructions: InstructionAction.Skip },
};
const yaml = new FrameworkInitYaml(request).encode();
```

External input and deliberately malformed/unsupported decoder-test documents
may remain raw to preserve the defect under test. Valid scenarios, including
business conflicts, must use typed construction. Open extension data stays
inside explicitly open fields; it does not make the surrounding schema dynamic.
Hand-authored `.yaml` files and documentation YAML are not programmatic builders.
Never replace serialization with a homegrown YAML emitter or parsing round trip.

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
- Check nested request/YAML shapes and enum field vocabularies. Review producers,
  examples, recovery responses, and fixtures for YAML string construction; trace
  each valid document from a concrete typed record to the serializer.
- Run typed round-trip tests with quotes, colons, newlines, and YAML-like content;
  retain explicit malformed-input tests. Compilation alone does not enforce this rule.
- Reject local Result/Maybe utilities, erased failure sources, and plaintext leaks.
- Run type/state/behavior checks; preserve browser and security evidence.
- Follow the supplied single-parameter and Effect rules; generated/dependency types are not authored models.

# Form and helper protocol

## Schema

A form is a YAML mapping with a nonempty `fields` sequence. Each field has a
unique `name`, a nonblank `question`, and either `type: text`, `type: integer`, or
`options: [choice, ...]`. Choice fields may explicitly say `type: choice`.
`required` defaults to `true`; use `required: false` to allow skipping.

Names start with an ASCII letter and contain letters, digits, underscores,
hyphens, or dots. `constructor` and `prototype` are reserved. Names are literal
keys, not paths. Options are unique, nonblank strings matched exactly, including
case and whitespace. Do not combine text/integer types with options. Unknown
properties, duplicate names or YAML keys, empty forms, nulls, custom tags,
anchors, aliases, merge keys, directives, and multiple documents are rejected.
Each input is limited to 64 KiB and bounded nesting.

Required text must contain a non-whitespace character; accepted text retains its
original content. Integers accept safe whole JSON/YAML numbers or free text
matching signed decimal digits after trimming surrounding whitespace. Decimal
strings (`1.0`), exponents (`1e3`), fractions, non-finite values, and values outside
JavaScript's safe integer range are rejected. There is no truncation or rounding.
Blank optional answers skip any field type and are omitted from final answers.
Every field is offered; optional fields can be skipped explicitly.

## Invoke

Resolve `library_root` to the directory containing the framework's `AGENTS.md`.
Run from any working directory after installing workspace dependencies:

```sh
bun "$library_root/teams/gizmo-team/agents/gizmo/skills/user-input/scripts/src/ts/cli.ts" \
  --schema="$library_root/development.yaml" <<'FORM_REQUEST'
{"version":1,"state":{"answers":{},"skipped":[]},"event":{"type":"start"}}
FORM_REQUEST
```

The helper reads one request from stdin and writes one JSON result. It never
calls host tools. Only protocol version `1` is supported; future incompatible
formats require an explicit migration. There is no on-disk session store.

Each request contains the last returned `state` and one event:

- **`start`** validates state and prepares the next question.
- **`answer`** takes `name` and `value` (text or number) to validate one answer.
- **`skip`** takes `name` to skip an optional field; required fields stay pending.
- **`cancel`** returns `cancelled`; do not continue the task.
- **`unavailable`** returns `unavailable`; report the host limitation.

For example, submit the user's mode selection:

```json
{"version":1,"state":{"answers":{},"skipped":[]},"event":{"type":"answer","name":"development.mode","value":"single_agent"}}
```

The completed result contains:

```json
{"version":1,"status":"complete","state":{"answers":{"development.mode":"single_agent"},"skipped":[]},"issues":[]}
```

Pending results also contain `prompt.field` (the stable field name) and
`prompt.arguments` (`questions` with `title` and, for choices, `options`). Pass
only `prompt.arguments` to the host tool, retaining the field/call association.
The host may preselect a suggestion; it is not an answer until submitted.

For the next invocation copy `state` unchanged and replace `event`. The helper
revalidates carried state against the same form, excludes answered/skipped fields
from pending prompts, and rejects invalid carried state. Invalid new answers
produce `issues` without changing valid state. Unknown or already-answered field
names produce issues without overwriting prior answers. Only a result with
`status: complete` and no issues is ready for the original workflow.

Malformed schema, malformed request, invalid carried state, or I/O failures exit
with code 1 and an `error` code. Pending, complete, cancelled, and unavailable
results exit with code 0; check `status`, not just the process exit code. Failure
messages omit supplied values. Do not forward parser diagnostics containing
answers into logs.

## Validation

From the library root, run `bun run --filter @meta-cortex/user-input verify`.
Tests cover parsing, answer conversion, question mapping, retries, preservation,
and terminal outcomes. Native rendering, reply delivery, and question lifetime
belong to the host and require a live host test; unit tests do not prove those.

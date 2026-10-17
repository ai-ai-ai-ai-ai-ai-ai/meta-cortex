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
bun "$library_root/teams/gizmo-team/agents/gizmo-prime/skills/user-input/scripts/src/ts/cli.ts" \
  --schema="$library_root/development.yaml" <<'FORM_REQUEST'
{"version":2,"state":{"answers":{},"skipped":[]},"event":{"type":"start"}}
FORM_REQUEST
```

The helper reads one request from stdin and writes one JSON result. It never
calls host tools. Only protocol version `2` is supported; version 1 and unknown
versions are rejected. Version 2 replaces Codex tool arguments with a typed field.
When updating a caller, discard old prompt/tool bindings and submit retained
answers and skips through a version 2 `start` request for revalidation. There is
no on-disk session store or legacy decoder.

Each request contains the last returned `state` and one event:

- **`start`** validates state and prepares the next question.
- **`answer`** takes `name` and `value` (text or number) to validate one answer.
- **`skip`** takes `name` to skip an optional field; required fields stay pending.
- **`cancel`** returns `cancelled`; do not continue the task.
- **`unavailable`** returns `unavailable`; report the host limitation.

For example, submit the user's explicit delivery choice:

```json
{"version":2,"state":{"answers":{},"skipped":[]},"event":{"type":"answer","name":"development.delivery","value":"create_pr"}}
```

The delivery-only form completes after that answer validates:

```json
{"version":2,"status":"complete","state":{"answers":{"development.delivery":"create_pr"},"skipped":[]},"issues":[]}
```

Pending results contain a host-neutral `prompt` with `name`, `question`,
`required` (`required` or `optional`), and `type` (`text`, `integer`, or `choice`).
Choice prompts also contain `options`; other types have no options property.
The form's boolean `required` is normalized to the explicit requirement state.
For example, starting the delivery form with empty state returns:

```json
{"name":"development.delivery","question":"Delivery: create_pr (recommended) commits and pushes the validated feature and creates or updates its PR; local_only keeps work local without pushing or creating a PR. Which delivery?","required":"required","type":"choice","options":["create_pr","local_only"]}
```

Present this field through a supported native tool or ordinary conversation.
It contains no tool arguments. Retain the stable `name` and bind the actual reply
to it before submitting an answer event. A host's preselected suggestion is not
an answer until the user submits it.

### Retained state

For the next invocation copy `state` unchanged and replace `event`. The helper
revalidates carried state against the same form, excludes answered/skipped fields
from pending prompts, and rejects invalid carried state. Invalid new answers
produce `issues` without changing valid state. Unknown or already-answered field
names produce issues without overwriting prior answers. Only a result with
`status: complete` and no issues is ready for the original workflow.

Carried answers and skips must belong to the current form. A changed form does
not migrate removed fields; unknown retained-state fields are rejected. The host
retains validated session delivery independently and can construct a fresh state
containing only that delivery answer for revalidation.

- **Prohibited:** accept state with a removed field by silently discarding it.

- **Required:** reject that state. When the host independently retains validated
  `create_pr`, revalidate fresh state with only `development.delivery: create_pr`.

Malformed schema, malformed request, invalid carried state, or I/O failures exit
with code 1 and an `error` code. Pending, complete, cancelled, and unavailable
results exit with code 0; check `status`, not just the process exit code. Failure
messages omit supplied values. Do not forward parser diagnostics containing
answers into logs.

## Validation

From the library root, run `bun run --filter @meta-cortex/user-input verify`.
Tests cover parsing, answer conversion, neutral question fields, retries, preservation,
and terminal outcomes. Host rendering, reply delivery, and question lifetime
belong to the host and require a live host test; unit tests do not prove those.

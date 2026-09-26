# Gizmo and Rust Verifier Protocol

Use these YAML message bodies on the existing host channel. Store the full
review in the existing agent ledger. These are agent instructions, not new CLI
commands, an automatically enforced schema, or a separate service.

## Required actions

### Message conventions

- Use the exact field names and allowed values below. All listed fields are
  required unless explicitly nullable. Use `[]` for an empty list and `null`
  for an allowed absent value. Do not replace structured fields with prose.
- Send verifier messages only to the assigning Team Gizmo. Identify the existing
  ledger feature and verifier task with `feature_id` and `verifier_task_id`.
- Use a full Git commit object ID for a SHA. It must resolve to a commit in
  `workspace`. Branch names and `HEAD` are not SHAs.
- Use absolute paths for roots and workspaces. Code paths are relative to the
  developer `workspace`. Catalog and practice-source paths are normalized
  relative to `library_root`; preserve source anchors. Resolve each YAML
  reference from its containing index before normalizing it.
- Keep ledger attempt, revision, phase, and readiness in their native fields.
  Notification copies identify the saved record; they do not replace it.

**Prohibited:** send `Looks good; see latest branch` as the review result.

**Preferred:** send `review_result` with the reviewed SHA and saved ledger
revision, so Gizmo can retrieve the exact complete report.

### Gizmo request

Gizmo sends `type: verification_request` with these fields:

- **Identity:** `feature_id`, `verifier_task_id`, and `developer_task_id` are
  nonempty existing ledger identifiers. The verifier task uses a read-only
  workspace assignment and names the developer task in its objective.
- **Location:** `branch`, `workspace`, `project_root`, and `library_root` identify
  the stable developer checkout and the two assignment roots.
- **Revision:** `commit_sha` is the single commit to inspect. Review the change
  introduced by that commit relative to its first parent; a root commit adds
  its entire tree. Gizmo does not supply a task-wide base or range.
- **Requirements:** `acceptance_criteria` is a nonempty list of task requirements.
  `required_checks` is a list of check records, each containing unique `id`,
  `source`, exact `command`, absolute `workspace`, and `targets` (a nonempty
  list of target descriptions). `source` cites the project instruction or task
  criterion requiring the check.
- **No required checks:** `no_required_checks_reason` is `null` when the list
  is nonempty. Otherwise it states why none apply and cites the supporting
  instruction or criterion. An unexplained empty list is incomplete input.
- **Evidence:** `validation_evidence` contains supplied execution records.
  Each has `check_id`, `commit_sha`, `command`, `workspace`, `targets`,
  `outcome`, and nonempty `evidence`. Execution outcomes are exactly
  `passed`, `failed`, or `not_run`. Evidence names the observed result and
  its retrievable log or ledger location. `not_run` gives the reason.
- **Previous review:** `prior_review` is `null` on the first pass. A repair pass
  gives `verifier_task_id`, `attempt`, and `ledger_revision` for the prior report
  in the same feature. Gizmo makes that report accessible to the verifier.

Load the catalog from
`library_root/teams/dev-team/agents/rust-dev/skills/rust-dev-skill/index.yaml`.
The request cannot select a catalog subset. Supply ordinary assignment context
alongside this message without inheriting rust-dev's conversation or practices.

**Prohibited:** request “check the two rules mentioned by rust-dev” or omit
required checks because the developer supplied no results.

**Preferred:** send one SHA, all applicable check requirements, and available
execution evidence. The verifier derives the complete catalog inventory itself.

### Missing SHA and corrected input

1. Check `commit_sha` before reading the diff or making catalog judgments.
   If absent, ambiguous, or unresolvable, stop review work.
2. Persist a native ledger `progress` update with `phase.kind: blocked`, a
   precise `phase.reason`, and the request for a SHA in `next_steps`.
   Do not create a fictitious reviewed commit or empty passing report.
3. Send `type: need_commit` with `feature_id`, `verifier_task_id`, `attempt`,
   `ledger_revision`, `supplied_commit` (the received text, or `null`), `reason`,
   and `request`. Set `request` to `Provide exactly one full commit SHA to verify.`
4. Gizmo sends `type: commit_reply` with `feature_id`, `verifier_task_id`,
   `attempt`, and `commit_sha`. Confirm the task and attempt match, resolve
   the SHA, and record it in the ledger before resuming the same task.
   If the execution expired or ended, use normal ledger recovery first.
5. Once review has started on a valid SHA, a different SHA requires a new
   read-only verifier task and a full review. It is not a `commit_reply`.
   For other missing inputs, use a blocked report naming the missing field;
   Gizmo supplies the correction on the existing host channel.

**Prohibited:** infer a missing SHA from the branch or developer checkpoint.

**Preferred:** send `need_commit`, leave the task blocked, and resume only after
Gizmo provides a resolvable SHA for the matching task and attempt.

### Durable report fields

Store the report at `progress.extensions.rust_verification_report`. Use exactly
the fields below. Strings and evidence must be nonempty; lists may be empty
only when no corresponding items exist or a blocker identifies the missing work.

- **`commit_sha`:** the resolved SHA from the accepted request.
- **`prior_review`:** the request's prior-report reference, or `null`. Retain it
  so the previous findings remain retrievable after host context is lost.
- **`catalog_snapshot`:** `library_revision` (commit ID or `null` if unavailable)
  and ordered `indexes` (all traversed library-relative index paths). The
  practice and check records below retain the loaded cues for this snapshot.
  A changed catalog during review is a blocker; do not mix snapshots.
- **`changed_files`:** records with `path`, `change`, and `old_path`.
  `change` is `added`, `modified`, `deleted`, `renamed`, or `type_changed`.
  `old_path` is required for a rename and `null` otherwise. `path` identifies
  the new path, or the former path for a deletion. Include non-Rust files.
- **`practices`:** one record per practice leaf, in traversal order, containing
  `owner`, `catalog`, `source`, and ordered `rules`. Each rule has `id`,
  `source` including its anchor, and its verbatim catalog `summary`.
  Each practice owns one canonical source file. Preserve invalid or duplicate
  catalog entries and report the defect; never silently remove them.
- **`cross_rule_checks`:** one record per check leaf with `catalog`, `overview`,
  `prohibited`, `preferred`, and `compare` copied from that leaf. Each compared
  entry contains `id` and normalized `source`. `overview`, `prohibited`, and
  `preferred` are lists of strings, as in the catalog. This is the check inventory.
- **`outcomes`:** rule/file records with `rule_id`, `file`, `outcome`, `evidence`,
  `finding_ids`, and `blocker_ids`. The key is the pair `(rule_id, file)`.
  `file` must identify a `changed_files.path`.
- **`cross_rule_outcomes`:** records with `catalog`, `outcome`, `files`,
  `evidence`, `finding_ids`, and `blocker_ids`. The key is the check's catalog
  path. `files` lists affected code paths, or `[]` with an applicability reason.
- **`findings`:** one record per violation occurrence with unique `id`,
  `rule_ids`, `sources`, `file`, `lines`, `severity`, `observed`, `required_fix`,
  and `verification`. `rule_ids` and `sources` are nonempty lists of cataloged
  rules and their source citations. `lines` contains `side` (`commit` or
  `parent`), positive `start`, and inclusive `end`. Use parent lines for deleted
  content. Use the cue's severity label, or `not_specified` if none is supplied.
  `verification` states what evidence would demonstrate the correction.
- **`blockers`:** records with unique `id`, `kind`, `affected`, `reason`, and
  `needed`. Kinds are `input`, `catalog`, `access`, `validation`, or
  `interrupted`. `affected` is a nonempty list of field names, rule IDs, check
  IDs, or paths. `needed` names the exact input, evidence, or decision required.
- **`validation`:** `required_checks`, `no_required_checks_reason`, and
  `results`. Retain all requested check requirements; append any additional
  requirement explicitly defined in supplied project instructions or acceptance
  criteria. If a catalog cue suggests a check without defining its command or
  scope, record a blocker and ask Gizmo for the subject owner's clarification.
  Do not invent validation requirements from a summary.
  Each result has the execution-record fields from the request plus
  `assessment` (`satisfied`, `violation`, or `blocked`), `reason`, and
  `blocker_ids`, plus `required_fix` (`null` unless the assessment is `violation`).
  A violation's fix states the correction and required rerun. A blocked result
  references at least one blocker; other assessments have an empty blocker list.
  Keep exactly one current result per required check ID.
  Missing evidence becomes a `not_run` result with `assessment: blocked`.
- **`prior_findings`:** `[]` for the initial review; otherwise one record for
  every previous finding, with `id`, `outcome` (`fixed`, `still_violated`, or
  `blocked`), and fresh `evidence`. Inspect the relevant code at the new SHA
  even if its file is absent from the new commit's diff. Do not drop an
  unresolved finding because it was unchanged by the repair commit.
- **`counts`:** pairs of `expected` and `recorded` for `files`, `practices`,
  `rules`, `cross_rule_checks`, `rule_file_outcomes`, and `cross_rule_outcomes`;
  integer totals for `findings` and `blockers`. Derive expected values from Git
  and the catalog traversal, independently of the recorded outcome rows.
  Expected rule/file outcomes equal rules multiplied by changed files.
  Use `null` for an unknown expected count when discovery is blocked.
- **`coverage`:** `inventory` and `decisions`, each `complete` or `incomplete`,
  according to the completion rules below.
- **`verdict`:** `pass`, `changes_required`, or `blocked`.

**Prohibited:** save only `rules_checked: 178`, or use `result: passed` as an
invented ledger field. Counts alone cannot expose an omitted rule or duplicate row.

**Preferred:** save all inventories and outcomes in the extension, concise
findings in `progress.findings`, and validation commands in native
`progress.checks`. Native check outcomes remain `passed`, `failed`, or `not_run`.

### Outcome and completion rules

1. Record each rule/file and cross-rule decision using exactly one outcome:
   - `pass`: evidence cites inspected code or workspace evidence demonstrating
     compliance. Finding and blocker lists are empty.
   - `violation`: evidence explains noncompliance and `finding_ids` references
     every observed occurrence. The list is nonempty; blockers are empty.
   - `not_applicable`: evidence explains the absent applicability for this
     particular file or change. Finding and blocker lists are empty.
   - `blocked`: evidence explains why the cue cannot decide compliance or what
     is unavailable. `blocker_ids` is nonempty. Keep any already established
     violations in `finding_ids`; do not discard them because review is blocked.
2. Set inventory coverage to `complete` only after all inventories are present
   and all rule/file and check outcome keys match the expected sets exactly.
   Reject duplicate keys, unknown references, missing rows, and mismatched counts.
   Matching totals alone is insufficient. A blocked row can count as present.
   Every finding must be referenced by an outcome or retained prior finding.
   A missing request field or disagreement with the ledger is an input blocker.
3. Set decision coverage to `complete` only when inventory coverage is complete,
   every recorded outcome is decisive and evidence-backed, every required check
   has a decisive assessment, and every prior finding has a fresh decision.
   A proven violation is decisive. Any unresolved blocker makes it incomplete.
4. Assess command failures by evidence. A diagnostic proving noncompliance is
   `violation`; unavailable tools, stale SHA evidence, or an unexplained failure
   are `blocked`. A passing command is `satisfied` only with matching SHA,
   command, workspace, target scope, and observed success evidence.
5. Derive the verdict in this order:
   - `blocked` if either coverage state is incomplete or any blocker remains.
   - `changes_required` if any finding, violation outcome, failed requirement,
     or `still_violated` prior finding remains after complete decisions.
   - `pass` only with both coverage states complete, no violations or blockers,
     all required checks satisfied, and all prior findings fixed.
6. At each practice boundary, persist accumulated work with the native ledger
   `progress` action. Put the exact next unchecked practice/rule/file or check
   in `next_steps`. Pending rows are absent, never fabricated as not applicable.
7. For a final `pass` or `changes_required`, persist the full report with the
   native `ready` action. For `blocked`, use `progress` with blocked phase and
   its reason. Preserve existing attempt/revision checks and lease handling.
   Notify Gizmo only after the ledger write succeeds.

**Prohibited:** set `pass` because all rows exist when one row is blocked, or
mark a failed test as unknown when its diagnostic already proves a defect.

**Preferred:** report complete inventory but incomplete decisions for an unclear
cue. Report `changes_required` for a complete review with a proven test defect.

### Result notification and Gizmo response

Send `type: review_result` with `feature_id`, `verifier_task_id`, `attempt`,
`ledger_revision`, `commit_sha`, `verdict`, `coverage`, `counts`, `summary`, and
`report_key: progress.extensions.rust_verification_report`. Copy coverage and
counts exactly from the saved report. `ledger_revision` is the revision returned
by the successful write; it is not the preceding update's expected revision.

1. Gizmo reads that task's report and checks the exact inventories, keys,
   evidence, verdict, and SHA. A missing, stale, or contradictory report cannot
   approve integration; return the specific defect to the verifier.
2. For `pass`, require the developer's ready checkpoint and branch head to match
   the report SHA before continuing normal integration and combined checks.
3. For `changes_required`, extract every implementation correction into one
   ordinary rust-dev repair task. Include rule/source, code location, observed
   defect, required fix, and validation requirement. Require strict rule
   compliance. Include fixes from violated validation requirements and unresolved
   prior findings, as well as the current `findings` list. Do not send verifier
   instructions or review bookkeeping to dev.
   Create a new full verifier task when the developer supplies its repair SHA.
4. For `blocked`, keep integration stopped. Supply missing evidence or route
   catalog ambiguity to its subject owner. Known implementation findings may
   still be assigned for repair, but they do not resolve the other blockers.
   After review has started, resume only for the same SHA and catalog snapshot; a changed
   SHA or changed catalog requires a fresh complete review task.
   The earlier `need_commit` exchange is a pre-review exception: it fills the
   missing SHA before any review or catalog snapshot exists.

**Prohibited:** treat a ready review task as approval, or forward only the most
severe finding to rust-dev.

**Preferred:** read the report's verdict. Route all fixes for `changes_required`;
route the specific missing decision for `blocked`; integrate only a matching pass.

## Examples

All paths, SHAs, and log references below are fictional. The report uses a
miniature catalog with one practice, two rules, and one cross-rule check to
demonstrate complete records. It does not represent the actual Rust catalog.
Production reviews must discover every entry from the fixed canonical root.

### Request and missing SHA exchange

**Prohibited:** `Review the latest work; tests look fine.`

**Preferred:** Gizmo supplies a structured request:

```yaml
type: verification_request
feature_id: invoice-types
verifier_task_id: rust-review-01
developer_task_id: rust-work
branch: codex/invoice-types
workspace: /work/invoice-types
project_root: /work/invoice-types
library_root: /work/framework/cortex
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
acceptance_criteria:
  - Model invoice identities with the required domain type.
required_checks:
  - id: workspace-tests
    source: /work/invoice-types/AGENTS.md#validation
    command: cargo test --locked --workspace
    workspace: /work/invoice-types/app
    targets: [all workspace test targets]
no_required_checks_reason: null
validation_evidence:
  - check_id: workspace-tests
    commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
    command: cargo test --locked --workspace
    workspace: /work/invoice-types/app
    targets: [all workspace test targets]
    outcome: passed
    evidence: Developer task rust-work revision 8 records exit 0 and test output for this SHA.
prior_review: null
```

If that request instead omitted `commit_sha`, the verifier would persist blocked
progress and send this message before inspecting any code:

```yaml
type: need_commit
feature_id: invoice-types
verifier_task_id: rust-review-01
attempt: 1
ledger_revision: 3
supplied_commit: null
reason: The request has no commit SHA; no diff or rule review has started.
request: Provide exactly one full commit SHA to verify.
```

Gizmo corrects only that missing input. The verifier records and resolves it
before resuming the same review task:

```yaml
type: commit_reply
feature_id: invoice-types
verifier_task_id: rust-review-01
attempt: 1
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

### Complete report with a violation

**Prohibited:** `One type issue; everything else passed.`

**Preferred:** persist this entire example value under
`progress.extensions.rust_verification_report`, then send its notification.
The shortened catalog paths below belong only to the fictional miniature.

```yaml
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
prior_review: null
catalog_snapshot:
  library_revision: cccccccccccccccccccccccccccccccccccccccc
  indexes: [example/index.yaml, example/types/index.yaml, example/check/index.yaml]
changed_files:
  - path: src/invoice.rs
    change: modified
    old_path: null
practices:
  - owner: example:types
    catalog: example/types/index.yaml
    source: example/types.md
    rules:
      - id: example:identity
        source: example/types.md#identity
        summary: Use nominal invoice identities.
      - id: example:boundary
        source: example/types.md#boundary
        summary: Convert external invoice identities at the boundary.
cross_rule_checks:
  - catalog: example/check/index.yaml
    overview: [Check changed boundary adapters preserve nominal identities.]
    prohibited: [Convert external invoice input and then retain its raw identity.]
    preferred: [Keep nominal identities in changed boundary adapters.]
    compare:
      - id: example:identity
        source: example/types.md#identity
      - id: example:boundary
        source: example/types.md#boundary
outcomes:
  - rule_id: example:identity
    file: src/invoice.rs
    outcome: violation
    evidence: Invoice.customer_id at commit line 18 is String instead of CustomerId.
    finding_ids: [invoice-customer-id]
    blocker_ids: []
  - rule_id: example:boundary
    file: src/invoice.rs
    outcome: not_applicable
    evidence: This module stores domain records and contains no external input conversion.
    finding_ids: []
    blocker_ids: []
cross_rule_outcomes:
  - catalog: example/check/index.yaml
    outcome: not_applicable
    files: [src/invoice.rs]
    evidence: This change does not add or modify a boundary conversion.
    finding_ids: []
    blocker_ids: []
findings:
  - id: invoice-customer-id
    rule_ids: [example:identity]
    sources: [example/types.md#identity]
    file: src/invoice.rs
    lines: {side: commit, start: 18, end: 18}
    severity: not_specified
    observed: Invoice stores customer_id as String although CustomerId already exists.
    required_fix: Use CustomerId for Invoice.customer_id and update its callers.
    verification: Inspect the committed field and callers and rerun workspace-tests.
blockers: []
validation:
  required_checks:
    - id: workspace-tests
      source: /work/invoice-types/AGENTS.md#validation
      command: cargo test --locked --workspace
      workspace: /work/invoice-types/app
      targets: [all workspace test targets]
  no_required_checks_reason: null
  results:
    - check_id: workspace-tests
      commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
      command: cargo test --locked --workspace
      workspace: /work/invoice-types/app
      targets: [all workspace test targets]
      outcome: passed
      evidence: Developer task rust-work revision 8 records exit 0 and test output for this SHA.
      assessment: satisfied
      reason: The exact requested command and scope passed for the reviewed SHA.
      blocker_ids: []
      required_fix: null
prior_findings: []
counts:
  files: {expected: 1, recorded: 1}
  practices: {expected: 1, recorded: 1}
  rules: {expected: 2, recorded: 2}
  cross_rule_checks: {expected: 1, recorded: 1}
  rule_file_outcomes: {expected: 2, recorded: 2}
  cross_rule_outcomes: {expected: 1, recorded: 1}
  findings: 1
  blockers: 0
coverage: {inventory: complete, decisions: complete}
verdict: changes_required
```

After saving it with the native `ready` action, notify Gizmo:

```yaml
type: review_result
feature_id: invoice-types
verifier_task_id: rust-review-01
attempt: 1
ledger_revision: 9
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
verdict: changes_required
coverage: {inventory: complete, decisions: complete}
counts:
  files: {expected: 1, recorded: 1}
  practices: {expected: 1, recorded: 1}
  rules: {expected: 2, recorded: 2}
  cross_rule_checks: {expected: 1, recorded: 1}
  rule_file_outcomes: {expected: 2, recorded: 2}
  cross_rule_outcomes: {expected: 1, recorded: 1}
  findings: 1
  blockers: 0
summary: Invoice.customer_id needs CustomerId at src/invoice.rs line 18. Required tests passed.
report_key: progress.extensions.rust_verification_report
```

### Repair and passing notification

**Prohibited:** forward the verifier's instructions and ledger report to rust-dev,
then accept its “fixed” response without a new review.

**Preferred:** Gizmo sends this ordinary implementation task to rust-dev:

> Change `Invoice.customer_id` at `src/invoice.rs:18` from `String` to the existing
> `CustomerId`, and update its callers. Follow `example:identity` in
> `example/types.md#identity` and all applicable Rust practices strictly.
> Inspect the corrected field and callers, run `cargo test --locked --workspace`
> from `/work/invoice-types/app`, and complete the normal committed task handoff.

After rust-dev returns commit `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`, Gizmo
creates `rust-review-02`. Its request supplies that SHA, fresh check evidence,
and `prior_review` identifying task `rust-review-01`, attempt `1`, revision `9`.
The verifier repeats the complete review and records `invoice-customer-id` as
`fixed` with fresh evidence. Only after saving that full passing report does
it send this notification:

```yaml
type: review_result
feature_id: invoice-types
verifier_task_id: rust-review-02
attempt: 1
ledger_revision: 7
commit_sha: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
verdict: pass
coverage: {inventory: complete, decisions: complete}
counts:
  files: {expected: 1, recorded: 1}
  practices: {expected: 1, recorded: 1}
  rules: {expected: 2, recorded: 2}
  cross_rule_checks: {expected: 1, recorded: 1}
  rule_file_outcomes: {expected: 2, recorded: 2}
  cross_rule_outcomes: {expected: 1, recorded: 1}
  findings: 0
  blockers: 0
summary: Complete miniature-catalog review passed; prior identity finding fixed and required tests passed for this SHA.
report_key: progress.extensions.rust_verification_report
```

### Blocked notification

This is an alternative outcome for the initial review, not a change to a ready
task. Suppose the identity violation is established, but the boundary cue cannot
decide an exception and therefore also prevents deciding the cross-rule check.

**Prohibited:** omit the known identity violation, or mark the ambiguous rule
not applicable simply to finish the review.

**Preferred:** retain the finding; record the boundary rule and cross-rule
outcomes as blocked with a shared catalog blocker. Save a blocked report at
revision `6` and notify Gizmo:

```yaml
type: review_result
feature_id: invoice-types
verifier_task_id: rust-review-01
attempt: 1
ledger_revision: 6
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
verdict: blocked
coverage: {inventory: complete, decisions: incomplete}
counts:
  files: {expected: 1, recorded: 1}
  practices: {expected: 1, recorded: 1}
  rules: {expected: 2, recorded: 2}
  cross_rule_checks: {expected: 1, recorded: 1}
  rule_file_outcomes: {expected: 2, recorded: 2}
  cross_rule_outcomes: {expected: 1, recorded: 1}
  findings: 1
  blockers: 1
summary: Identity fix remains required. Resolve the example:boundary exception with the subject owner; boundary and comparison decisions are blocked.
report_key: progress.extensions.rust_verification_report
```

## Prohibited actions

- Do not contact rust-dev directly, modify its checkout, or approve your own fixes.
- Do not replace the report with a notification, count summary, or check log.
- Do not treat a blocked cue as permission to load Rust practice Markdown.
  Ask Gizmo for the missing subject-owner decision.
- Do not claim this documented message format is automatically validated by
  the ledger. Gizmo and the verifier must check it explicitly.

**Prohibited:** report that a ledger write proves exhaustive rule compliance.

**Preferred:** reconcile every expected key and inspect its evidence before
saving the report; describe the ledger write only as durable storage.

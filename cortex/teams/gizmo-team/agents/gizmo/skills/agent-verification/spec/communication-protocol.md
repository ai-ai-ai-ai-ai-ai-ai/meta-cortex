# Gizmo and Verifier Protocol

Gizmo sends a commit SHA. The verifier checks every cataloged practice against
every changed file, saves one complete report, and sends Gizmo every issue
with the evidence and instructions needed to fix it.
Gizmo owns repairs and integration.
Use [committed Git reads](git-review.md) for executable commands. This protocol
defines messages and evidence; it does not authorize checkout changes.

## Required actions

### Reuse the assignment context

- Use the existing host channel and read-only ledger task. Project and library
  roots, workspace, developer task, acceptance criteria, and required validation
  already belong to the assignment; do not repeat them in each message.
- Keep attempt, revision, lease, and task state in the native ledger fields.
- Use the exact message fields and enum values defined below. Every field in
  the selected message is required. Reject nulls, missing required values,
  empty scalar placeholders, and boolean state flags.
- Keep required identities such as the commit SHA as valid values. A missing
  identity rejects the request; it does not become an optional review field.

**Prohibited:** send a nullable commit field and let the verifier guess `HEAD`.

**Required:** send one explicit SHA. If it is missing, the verifier requests it
and waits before starting review.

### Request a review

1. Gizmo sends exactly `type: verification_request` and `commit_sha`, containing
   a full resolvable commit object ID.
2. The verifier reviews the change introduced by that commit relative to its
   first parent. A root commit adds its entire tree. Do not construct a task-wide
   base, follow a moving branch, or select only some practices.
   For implementation handoffs, Gizmo ensures the developer supplied one
   consolidated task commit before sending this request. The verifier derives
   its parent from Git; no base field is added to the message.
3. If the SHA is missing, ambiguous, or unresolvable, stop before reading the
   diff or making rule judgments. Save blocked ledger progress and send
   `need_commit` with a nonempty `reason`. Gizmo resends a complete
   `verification_request`; there is no separate reply format.
4. Reject other missing assignment inputs before review. Save blocked progress
   and send `need_context` with a nonempty `reason` naming the exact missing input.
   Gizmo supplies that input through the existing assignment channel.
5. A corrected request can resume the same task before review starts. After
   review starts, a different SHA requires a new read-only review task.

**Prohibited:** replace the missing SHA with the developer branch tip.

**Required:** exchange these messages; the SHA below is fictional:

```yaml
type: need_commit
reason: No commit SHA was supplied. Provide exactly one full commit SHA to verify.
```

```yaml
type: verification_request
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

A missing project root uses the same rejection pattern without inventing a value:

```yaml
type: need_context
reason: The assignment lacks project_root. Provide the absolute consuming-project root.
```

### Save one complete report

Use readable Markdown in `progress.extensions.verification_report`.
The report has the following five sections. Its inventories and decisions prove
review coverage. Its complete repairs and blockers must also appear in the
message to Gizmo; storing them only in the ledger is not a completed handoff.

1. **Commit and inventory**
   - State the reviewed SHA and list every changed file with its change kind:
     `added`, `modified`, `deleted`, `renamed`, or `type_changed`.
     A rename includes both paths; other changes carry only their actual path.
     Paths are relative to the assigned developer workspace.
   - List every traversed subject `index.yaml`, in order. For each practice, record
     its owner, catalog path, canonical source file, and every ordered rule ID,
     source anchor, and loaded summary. This is one practice, one source file,
     and its complete rule set.
   - List each cross-rule check with its catalog path, compared rules and source
     citations, and loaded comparison cues. Catalog and source paths are relative
     to the library root, after resolving references from their containing YAML.
     These copied cues preserve the review's catalog snapshot.
     Comparison references reuse the practice rules; do not count them as new rules.
     Use `no_checks` only when complete traversal establishes there are no check leaves.
2. **Rule decisions**
   - Visit practices in catalog order and rules in leaf order. Inspect every
     changed file and the surrounding code needed for each rule decision.
     Evaluate cross-rule checks against the whole change.
   - Record exactly one entry per `(rule ID, changed file)` and one per cross-rule
     check. Each entry states its key, outcome, and concrete evidence or reason.
     Cross-rule decisions also retain the compared IDs and affected paths.
   - Outcomes are `pass`, `violation`, `not_applicable`, or `blocked`.
     `pass` cites compliant code or workspace evidence. `violation` points to
     all corresponding repair items. `not_applicable` explains why the rule
     does not apply to this file or change. `blocked` names the missing decision
     or evidence. Do not infer a decision from a short, ambiguous cue.
     Workspace requirements need workspace configuration and validation evidence;
     a file-level pass cannot replace a required workspace check.
   - Continue through all practices and files, retaining every violation.
     At each practice boundary, save all accumulated decisions and the next
     unchecked practice/rule/file or comparison in native `next_steps`.
     Preserve earlier decisions when resuming; unreviewed entries remain unfinished.
3. **Repairs and blockers**
   - Give each violation a stable issue ID and the full repair context defined
     in the result payload below. Use parent lines for deleted content. List
     multiple violations separately, including multiple violations of one rule
     in one file. Keep these issue IDs in the rule decisions and outgoing message.
   - List blockers separately, each with what is unresolved and exactly what
     Gizmo must supply or obtain from the subject owner.
   - Use the explicit states `no_violations` and `no_blockers` when those lists
     have no items. Never use an empty value to imply a completed review.
   - On repair passes, account for every previous repair item as `fixed`,
     `still_violated`, or `blocked`, with fresh evidence at the new SHA.
     Inspect its code even if the repair commit did not change that file.
4. **Validation**
   - List every required command and its requirement source. For each result,
     record SHA, exact command, workspace, targets, execution outcome, and evidence.
     Execution outcomes retain the ledger vocabulary: `passed`, `failed`, `not_run`.
   - Missing execution evidence is `not_run` with a reason and a blocker.
     A failure proving a code defect produces a repair item; an unavailable
     tool or unexplained failure remains a blocker. Do not invent commands from
     catalog summaries; ask Gizmo for the missing requirement or clarification.
   - If no commands apply, record `not_required` with its source and reason.
     Unknown requirements must be resolved before review; they are not permission
     to declare validation unnecessary.
5. **Coverage and verdict**
   - State discovered file, practice, rule, and cross-rule check counts. Compare
     expected and recorded rule/file entries (`rules × changed files`) and
     cross-rule entries. Derive expected counts from the inventories before
     making judgments; do not hard-code them.
     If discovery is blocked, name the count `undetermined`
     and give the reason; never substitute zero.
   - Check exact keys as well as totals. Reject duplicates, unknown IDs, missing
     entries, and unsupported decisions. All rows being present does not mean
     all decisions are resolved: a blocked row still prevents approval.
   - State one verdict under the rules below.

**Prohibited:** save only “178 rules checked,” mark an entire practice passed,
or use an empty repairs section to imply there are no violations.

**Required:** retain every rule/file decision and every cross-rule decision.
Explicitly state `no_violations` only when no violations were found; unfinished
review still produces a blocked verdict.

### Return the result and route it

1. Derive the verdict in this order:
   - `blocked`: any required input, inventory, decision, or evidence is incomplete
     or ambiguous. Keep all known violations in the report.
   - `changes_required`: the review is complete and decisive, but code violations,
     proven validation failures, or unresolved previous repairs remain.
   - `pass`: the review is complete, every applicable rule and required validation
     is satisfied, and every previous repair is fixed. No blockers remain.
2. Persist the report before notifying Gizmo. Use native `ready` for a complete
   `pass` or `changes_required` review. Use native blocked progress for `blocked`.
   Review-task readiness means the report is complete; it is not code approval.
3. Send `review_result` with `commit_sha`, `verdict`, `issues`, and `blockers`,
   alongside its `type` tag. Include every discovered issue in the message,
   including proven validation failures and still-violated previous repairs.
   No issue limit, representative sample, summary-only response, or ledger-only
   pointer is allowed. The SHA, verdict, issue IDs, issue details, and blockers
   must agree with the saved report. Finding one issue never ends the review.
4. Use these result payloads; all listed fields are required:
   - `issues` is `kind: violations` with a nonempty `items` list, or the unit
     state `kind: no_violations` when no violations have been found.
   - Every issue has `id`, `rule`, `source`, `location`, `context`, `evidence`,
     `required_fix`, and `validation`. Each value is nonempty.
     `rule` identifies the violated catalog rule or explicit validation
     requirement; `source` cites its canonical source or project instruction.
     `location` gives the committed path and lines, or the failing command and
     workspace for a validation-only issue. `context` explains the requirement,
     the observed violation, and relevant callers or effects. `evidence` quotes
     the offending code or diagnostic at the reviewed SHA. `required_fix`
     specifies the correction and affected code. `validation` states how to
     verify the fix, including expected behavior and applicable commands.
   - `blockers` is `kind: blocked` with a nonempty `items` list, or the unit
     state `kind: no_blockers`. Each blocker has nonempty `id`, `context`, and
     `needed`: the unresolved question, its affected rule/file/check, and the
     exact input or decision Gizmo must obtain. A blocked verdict still carries
     every known issue with all its repair context.
5. Gizmo checks the inventories, decisions, and evidence before acting:
   - Apply the [task boundary](../../../../../../../CIRCUIT-BREAKER.md#keep-the-users-task-boundary).
     For review-only work, return the complete result through the hierarchy and
     stop. Verdicts and `required_fix` fields do not authorize implementation.
     The following integration and repair actions apply only within authorized
     implementation or an explicitly requested workflow exercise. Preserve
     unrelated findings in the result without assigning their repair.
   - For `pass`, verify the developer's ready checkpoint and branch head match
     the reviewed SHA, then follow normal integration and combined checks.
   - For `changes_required`, send every in-scope implementation correction to the assigned worker
     as one ordinary repair assignment. Preserve every issue's rule/source,
     location, context, evidence, required fix, and validation instructions;
     do not reduce the payload to titles or a shorter selection. Require strict
     rule compliance. Keep verifier instructions and review bookkeeping out of
     developer context.
   - For `blocked`, keep integration stopped and supply missing evidence or route
     the policy question to its subject owner. Authorized repairs may proceed, but
     they do not clear unrelated blockers.
6. A repair commit gets a new task and a complete review of all practices.
   Gizmo supplies the previous report to the verifier as assignment context.
   Do not review only the fixes. A changed catalog also requires a fresh review.

**Prohibited:** send “one type issue; see the ledger,” stop after the first
violation, or forward only the most severe issue to the assigned worker.

**Required:** finish the catalog traversal and send every issue with its full
repair context, as in the following YAML example. For authorized implementation,
Gizmo gives the assigned worker all in-scope repairs and obtains a complete review of the
replacement commit. For review-only work, Gizmo returns the complete findings.

## Complete issues example

This fictional result demonstrates two separately explained issues in different
files. The paths, code, and SHA are illustrative; it is not a review of the real
Rust catalog. A real result must contain every issue found across all practices,
with no truncation or fixed limit on the number of issues.

**Prohibited:** send only `customer-id-type` because it was found first, or send
both IDs without the code context and instructions needed to fix them.

**Required:** send both complete issues in the message to Gizmo. Each issue is
usable as an ordinary worker repair requirement without opening the verifier's
private conversation or reconstructing the problem from a title:

```yaml
type: review_result
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
verdict: changes_required
issues:
  kind: violations
  items:
    - id: customer-id-type
      rule: domain_types:nominal_values
      source: teams/dev-team/agents/rust-dev/skills/rust-dev-skill/practices/modeling/domain-types.md#required-actions
      location: app/src/invoice.rs:18-20 at the reviewed commit
      context: >-
        Domain identifiers require nominal types. Invoice.customer_id stores
        a raw String even though CustomerId exists in app/src/customer.rs:8.
        Invoice construction in app/src/orders.rs:64 therefore accepts arbitrary
        strings instead of the validated customer identity used by the domain.
      evidence: |
        pub struct Invoice {
            pub customer_id: String,
        }
      required_fix: >-
        Change Invoice.customer_id to the existing CustomerId. Update invoice
        construction in app/src/orders.rs to pass that domain value rather than
        convert it back to String. Keep external string parsing at the input
        boundary; do not add a duplicate identifier type or unchecked constructor.
      validation: >-
        Inspect the changed field and every construction site. Confirm that
        arbitrary strings cannot be assigned to customer_id and that existing
        validated customer IDs still construct invoices. Run the assignment's
        required cargo check --locked --workspace --all-targets and
        cargo test --locked --workspace from /work/invoice-types/app.
    - id: export-mode-boolean
      rule: domain_states:no_booleans
      source: teams/dev-team/agents/rust-dev/skills/rust-dev-skill/practices/modeling/domain-states.md#convert-external-records-into-owned-types
      location: app/src/export.rs:42-44 at the reviewed commit
      context: >-
        Application alternatives require named enums. ExportRequest.mode is a
        domain boolean: true writes the export, while false only previews it.
        The request is constructed in app/src/cli.rs:70 and consumed by the
        export operation. The current type hides which behavior the caller chose.
      evidence: |
        pub struct ExportRequest {
            pub mode: bool,
        }
      required_fix: >-
        Replace the domain boolean with ExportMode variants Preview and Commit.
        Update ExportRequest, its construction in app/src/cli.rs, and the export
        operation to use those variants. Convert any external CLI boolean at
        that boundary and match the domain variants when selecting behavior.
        Do not preserve the boolean through a wrapper or boolean getter.
      validation: >-
        Verify Preview produces the preview without writing an export and Commit
        performs the write. Check both CLI mappings and their existing behavior
        tests. Confirm no domain boolean remains in this request or its consumers.
        Run the assignment's required cargo check --locked --workspace --all-targets
        and cargo test --locked --workspace from /work/invoice-types/app.
blockers:
  kind: no_blockers
```

After all issues are fixed and the replacement commit passes the complete review,
a result can state that there are no remaining violations or blockers:

```yaml
type: review_result
commit_sha: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
verdict: pass
issues:
  kind: no_violations
blockers:
  kind: no_blockers
```

For a blocked review with known violations, keep the entire `issues` payload
and add the unresolved blockers. Do not replace the findings with a blocker
summary. Gizmo must receive both the repair work and the decisions still needed.

## Prohibited actions

- Do not edit code or catalogs, contact workers directly, or approve your own fixes.
- Do not replace exhaustive decisions with counts, a summary, or passing build logs.
- Do not claim the ledger automatically validates this report. Gizmo and the
  verifier must inspect its completeness and evidence explicitly.

**Prohibited:** report that a successful ledger write proves rule compliance.

**Required:** check every expected decision and its evidence, then save and
report the actual verdict.

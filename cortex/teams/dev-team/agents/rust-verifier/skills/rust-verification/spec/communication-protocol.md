# Gizmo and Rust Verifier Protocol

Gizmo sends a commit SHA. The verifier checks every cataloged practice against
every changed file, saves one complete report, and tells Gizmo the result.
Gizmo owns repairs and integration.

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

**Preferred:** send one explicit SHA. If it is missing, the verifier requests it
and waits before starting review.

### Request a review

1. Gizmo sends exactly `type: verification_request` and `commit_sha`, containing
   a full resolvable commit object ID.
2. The verifier reviews the change introduced by that commit relative to its
   first parent. A root commit adds its entire tree. Do not construct a task-wide
   base, follow a moving branch, or select only some practices.
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

**Preferred:** exchange these messages; the SHA below is fictional:

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

Use readable Markdown in `progress.extensions.rust_verification_report`.
The report has the following five sections. This is the full review record;
its short notification does not replace it.

1. **Commit and inventory**
   - State the reviewed SHA and list every changed file with its change kind:
     `added`, `modified`, `deleted`, `renamed`, or `type_changed`.
     A rename includes both paths; other changes carry only their actual path.
     Paths are relative to the assigned developer workspace.
   - List every traversed Rust `index.yaml`, in order. For each practice, record
     its owner, catalog path, canonical source file, and every ordered rule ID,
     source anchor, and loaded summary. This is one practice, one source file,
     and its complete rule set.
   - List each cross-rule check with its catalog path, compared rules and source
     citations, and loaded comparison cues. Catalog and source paths are relative
     to the library root, after resolving references from their containing YAML.
     These copied cues preserve the review's catalog snapshot.
     Use `no_checks` only when complete traversal establishes there are no check leaves.
2. **Rule decisions**
   - Record exactly one entry per `(rule ID, changed file)` and one per cross-rule
     check. Each entry states its key, outcome, and concrete evidence or reason.
   - Outcomes are `pass`, `violation`, `not_applicable`, or `blocked`.
     `pass` cites compliant code or workspace evidence. `violation` points to
     all corresponding repair items. `not_applicable` explains why the rule
     does not apply to this file or change. `blocked` names the missing decision
     or evidence. Do not infer a decision from a short, ambiguous cue.
   - Continue through all practices and files, retaining every violation.
     At each practice boundary, save progress and the next unchecked rule/file
     in native `next_steps`. Unreviewed entries remain unfinished work.
3. **Repairs and blockers**
   - Give each violation its own numbered repair item: rule/source, committed
     path and lines, observed defect, required correction, and how to verify it.
     Use parent lines for deleted content. List multiple violations separately.
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
     cross-rule entries. If discovery is blocked, name the count `undetermined`
     and give the reason; never substitute zero.
   - Check exact keys as well as totals. Reject duplicates, unknown IDs, missing
     entries, and unsupported decisions. All rows being present does not mean
     all decisions are resolved: a blocked row still prevents approval.
   - State one verdict under the rules below.

**Prohibited:** save only “178 rules checked,” mark an entire practice passed,
or use an empty repairs section to imply there are no violations.

**Preferred:** retain every rule/file decision and every cross-rule decision.
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
3. Send `review_result` with exactly `commit_sha`, `verdict`, and `summary`,
   alongside its `type` tag. The SHA and verdict must match the saved report.
   Gizmo reads the full report from the notifying verifier's existing ledger task.
4. Gizmo checks the inventories, decisions, and evidence before acting:
   - For `pass`, verify the developer's ready checkpoint and branch head match
     the reviewed SHA, then follow normal integration and combined checks.
   - For `changes_required`, send every implementation correction to rust-dev
     as one ordinary repair assignment. Include rule/source, code location,
     observed defect, correction, and validation; require strict rule compliance.
     Keep verifier instructions and review bookkeeping out of developer context.
   - For `blocked`, keep integration stopped and supply missing evidence or route
     the policy question to its subject owner. Known repairs may proceed, but
     they do not clear unrelated blockers.
5. A repair commit gets a new task and a complete review of all practices.
   Gizmo supplies the previous report to the verifier as assignment context.
   Do not review only the fixes. A changed catalog also requires a fresh review.

**Prohibited:** approve a new SHA using an earlier pass, or treat a ready review
with violations as permission to integrate.

**Preferred:** use the explicit verdict and obtain a new complete report for
every replacement commit. The following messages illustrate the three results:

```yaml
type: review_result
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
verdict: changes_required
summary: Complete review found one identity-type violation. Required tests passed. Read repair item 1.
```

```yaml
type: review_result
commit_sha: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
verdict: pass
summary: Complete review passed. Repair item 1 is fixed and required tests passed for this SHA.
```

```yaml
type: review_result
commit_sha: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
verdict: blocked
summary: Identity repair remains required. The boundary cue needs a subject-owner decision; see the blocker.
```

## Report example

This fictional miniature contains one practice, two rules, one changed file,
and no cross-rule checks. It demonstrates the format, not the real Rust catalog.
Production reports enumerate the entire actual catalog, including all checks.

**Prohibited:** copy this miniature's counts into a real review or omit its
second rule because the first already found a violation.

**Preferred:** derive the actual inventory and record each decision. Save the
complete report in the ledger; send only the result notification over the host:

```markdown
## Commit and inventory
Commit: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
Files: modified src/invoice.rs.
Indexes, in order: example/index.yaml; example/types/index.yaml.
Practice: example:types; catalog example/types/index.yaml; source example/types.md.
Rules, in order:
- example:identity — example/types.md#identity — Use nominal invoice identities.
- example:boundary — example/types.md#boundary — Convert external identities at the boundary.
Cross-rule checks: no_checks; the complete miniature catalog contains no check leaves.

## Rule decisions
- example:identity × src/invoice.rs — violation. Invoice.customer_id is String at line 18; see repair 1.
- example:boundary × src/invoice.rs — not_applicable. This domain-record module contains no external input conversion.

## Repairs and blockers
1. example:identity, example/types.md#identity, src/invoice.rs:18 at the reviewed commit.
   Observed: Invoice.customer_id stores String although CustomerId already exists.
   Correction: use CustomerId for this field and update its callers.
   Verify: inspect the committed field and callers; rerun the required workspace tests.
Blockers: no_blockers.

## Validation
Required by /work/invoice-types/AGENTS.md#validation: cargo test --locked --workspace.
SHA: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; workspace: /work/invoice-types/app.
Targets: all workspace test targets. Outcome: passed.
Evidence: developer task rust-work revision 8 records exit 0 and test output for this SHA.

## Coverage and verdict
Files: 1; practices: 1; rules: 2; cross-rule checks: 0.
Rule/file entries: expected 2 × 1 = 2; recorded 2. Exact keys match; no duplicate or missing entries.
Cross-rule entries: expected 0; recorded 0.
Verdict: changes_required. Both rules have decisions; one violation remains and there are no blockers.
```

## Prohibited actions

- Do not edit code or catalogs, contact rust-dev directly, or approve your own fixes.
- Do not replace exhaustive decisions with counts, a summary, or passing build logs.
- Do not load Rust practice Markdown to resolve a blocked cue. Ask Gizmo for the
  subject-owner decision; the verifier's Rust practice context stays index-only.
- Do not claim the ledger automatically validates this report. Gizmo and the
  verifier must inspect its completeness and evidence explicitly.

**Prohibited:** report that a successful ledger write proves rule compliance.

**Preferred:** check every expected decision and its evidence, then save and
report the actual verdict.

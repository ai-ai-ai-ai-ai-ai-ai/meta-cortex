# Agent Verification Handoff

Prime coordinates verification; the worker owns implementation and repairs;
the verifier owns read-only assessment. The
[Agent Verification skill](../agents/gizmo-prime/skills/agent-verification/SKILL.md)
owns review scope, reviewer judgment, and expected results.

## Assign and receive a review

- Use the worker's cataloged **Verifier** role for completed write work when one is declared.
- Supply the intended outcome, scope, committed result, comparison base, relevant project context, and available validation evidence.
- Let the verifier choose its method and additional context. Requirements and development rules retain their authority.
- Record review work through the existing [ledger](agent-ledger.md); a pre-integration review must be claimable before the worker task is integrated.
- Evaluate the returned findings and evidence. Prime decides the next assignment and routes authorized repairs to their owner.
- Obtain a new assessment of a repaired revision; the reviewer determines which investigations need repeating.
- Review-only requests end with findings and limitations. They do not authorize repairs.

## Review Rust architecture after verification

After Rust verification passes, Prime assigns the
[Rust architecture reviewer](../../dev-team/agents/rust-refactoring/AGENTS.md)
the same revision, task base, verification result, and affected solution context.
The reviewer applies Improve Architecture and Simplificator and returns both
assessments. Prime decides which proposals to accept within the user's scope.
Accepted changes return to the developer, followed by verification and architecture
assessment of the replacement result. A supported no-change conclusion is valid.

## Integrate the reviewed revision

Prime supplies the integration owner with the ready committed result and its
passing review, including the resolved Rust architecture assessment when required.
The evidence must apply to the revision being integrated. Changed content needs
an updated assessment; an earlier pass cannot approve an unreviewed replacement.

Use the [local feature architecture](../../delivery-team/agents/integration-agent/skills/local-feature/SKILL.md#team-architecture)
for integration and combined validation. Prime evaluates the resulting checks and
remaining issues before advancing to delivery. Preserve review and repair history
in the existing ledger; no separate review service or message schema is required.

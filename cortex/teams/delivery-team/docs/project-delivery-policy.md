# Project Delivery Policy

Delivery separates local integration from remote pull-request management. The
consuming project owns its branch, review, validation, and merge policies.

## Required actions

### Configured implementation delivery

Use the validated session `development.delivery` collected by the
[entry point](../../../AGENTS.md#development-mode) from
[development.yaml](../../../development.yaml). Apply it in both development modes:

- `create_pr` is the recommended first choice. An implementation request includes
  committing the validated feature, pushing its branch, and creating or updating
  its PR. Continue without requiring a separate PR request or approval. The PR
  role owns remote operations in multi-agent mode.
- `local_only` completes after local implementation and required validation.
  Keep work local: do not push or create/update a PR. Return the local branch,
  workspace, validation results, and any uncommitted changes. Local commits remain
  allowed unless the user says otherwise.

The recommendation is not an automatic selection. Missing or pending delivery
configuration does not authorize publishing; recover the session choice or collect
it through the entry point. Carry the resolved choice in assignments and recovery
context. Discussion and read-only review do not imply implementation or publication.

For PR delivery:

- Honor an explicit local-only, no-push, or no-PR instruction from the user or
  consuming project. Apply explicit user changes before further affected work;
  a task-specific override leaves the session preference intact. Do not retract
  already-published work unless requested.
- Resolve the repository and target from project context. If authentication,
  repository access, or a necessary target decision is unavailable, report the
  actual delivery blocker instead of declaring the feature complete locally.
- Reuse a matching open PR. Follow the consuming project's PR template and
  draft policy; create a ready-for-review PR when the implementation and required
  local validation are complete unless that policy calls for a draft.
- Finish with the PR URL, published revision, and observed check status. Attach
  the PR through the host when supported. Pending CI remains pending.
- Opening a PR does not authorize merging, releasing, or deploying it. Those
  operations retain their own user or project authorization requirements.

**Prohibited:** finish locally under `create_pr` because the user did not repeat
“open a PR,” publish under `local_only`, or infer `create_pr` from a pending prompt.

**Preferred:** under `create_pr`, validate, commit, push, update the matching PR,
and return its link with the actual check status. Under `local_only`, return the
validated local outcome without a PR handoff.

### Resolve project delivery policy

Read the project's `AGENTS.md` and its linked delivery instructions. Inspect the
actual Git remotes, target branch, PR template, and repository rules before
publishing. Keep project-specific decisions in that project's documentation.

- Resolve the assigned feature branch and target; do not assume `origin/main`.
- Identify required checks, reviews, merge methods, and cleanup expectations.
- Respect both project instructions and enforced repository rules. Report a
  conflict instead of bypassing either or silently weakening a requirement.
- Distinguish permission to publish a PR from permission to merge or deploy.
  Reuse authorization already present in the user's request and assignment.
- Ask for a missing decision only when it blocks the requested operation.
  Do not add a second approval ceremony for an already authorized action.

**Prohibited:** copy another project's squash-only, optional-review policy and
merge a PR whose target requires approval.

**Preferred:** use the target repository's allowed merge method and satisfy its
required checks and reviews before an authorized merge.

### Preserve work ownership

Local integration, PR management, and CI execution have distinct owners. Pass
ordinary branch, revision, PR, and run information to the assigning Gizmo through
the host. Gizmo decides the next assignment and passes relevant evidence; these are
work evidence, not credentials or an authorization protocol.

- The integration owner prepares and integrates the feature branch locally.
- The PR owner manages the published branch and PR lifecycle.
- CI execution follows the SRE-owned project execution guidance when needed.
- Product fixes belong to their development owner; pipeline fixes belong to SRE.
- In single-agent mode, the current agent performs these responsibilities using
  the relevant skills. Loading a role or skill does not launch another agent.

**Prohibited:** create a staging branch, custom handoff registry, and another
manager loop merely to move an integrated feature into a PR.

**Preferred:** the integration agent reports the feature branch and check results
to Team Gizmo. Under `create_pr`, Gizmo supplies that evidence to the PR agent,
which reports the outcome and remaining work back to Gizmo. Under `local_only`,
Gizmo returns the local outcome to Prime.

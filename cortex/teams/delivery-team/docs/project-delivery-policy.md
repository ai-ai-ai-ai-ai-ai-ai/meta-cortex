# Project Delivery Policy

Delivery separates local integration from remote pull-request management. The
consuming project owns its branch, review, validation, and merge policies.

## Required actions

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
ordinary branch, revision, PR, and run information through the host; these are
work evidence, not credentials or an authorization protocol.

- The integration owner prepares and integrates the feature branch locally.
- The PR owner manages the published branch and PR lifecycle.
- CI execution follows the SRE-owned project execution guidance when needed.
- Product fixes belong to their development owner; pipeline fixes belong to SRE.
- In single-agent mode, the current agent performs these responsibilities using
  the relevant skills. Loading a role or skill does not launch another agent.

**Prohibited:** create a staging branch, custom handoff registry, and another
manager loop merely to move an integrated feature into a PR.

**Preferred:** pass the integrated feature branch and check results to the PR
owner, which returns the PR outcome and remaining work.

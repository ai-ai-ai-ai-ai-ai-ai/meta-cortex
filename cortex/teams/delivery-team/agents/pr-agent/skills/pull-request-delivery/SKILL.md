---
name: pull-request-delivery
description: Publish an assigned feature branch, manage its GitHub pull request and feedback, verify required checks, and perform an authorized merge with cleanup.
---

# Pull Request Delivery

Use the host's GitHub connector or the installed `gh` CLI and Git. This skill
requires repository access and authentication for the requested operation. If
access is unavailable, report the blocker; do not invent a GitHub proxy or event
subscriber. Apply [delivery knowledge](../../../../docs/index.md) first.

## Required actions

### Publish and maintain the feature PR

1. Resolve the assigned repository, remote, feature branch, target branch, and
   authorized operation from project context. Fetch the relevant remote refs.
2. Inspect the workspace and committed feature diff. Preserve unrelated edits.
   For divergence or integration repairs, return the local work to its owner;
   do not force-push or silently change the feature's scope.
3. Push the assigned branch once per coherent implementation or repair batch.
   Resolve its actual published head after the push.
4. Find an existing PR by repository, head branch, and target before creating one.
   Update that PR instead of creating a duplicate. Follow the project's template.
   Describe the resulting behavior, checks actually run, and material limitations.
5. Return the PR URL and state. Use the host's PR attachment capability when
   available. Opening a PR completes a create-only assignment; do not infer
   authorization to merge, post unrelated comments, or deploy.

**Prohibited:** create another PR for the same feature after each repair push.

**Preferred:** publish the coherent repair to the existing PR and update its
summary and validation evidence for the new revision.

### Observe checks and route repairs

1. Resolve the required checks and review rules from the target repository and
   project instructions. Read the PR's current head and mergeability.
2. Identify the runs and check results associated with that head. Account for a
   provider's tested merge revision when applicable; an unrelated successful run
   or older head does not validate this PR.
3. Observe automatically triggered checks before requesting more execution.
   For manual validation, retries, or pipeline investigation, use
   [CI/CD Operations](../../../../../sre-team/agents/cicd-agent/skills/cicd-operations/SKILL.md).
   In multi-agent mode, request the CI/CD agent through Team Gizmo when needed.
   Keep one execution observer for an assigned run; reuse its results.
4. Wait through the existing host's status/watch tools using bounded,
   interruptible waits. Gather the whole required check set, including failed,
   cancelled, missing, or pending checks. Report blockers without calling a
   partial inventory green. Accept skipped or neutral results only when the
   project's applicable policy explicitly permits them.
5. Read actionable review feedback. Route product fixes, integration conflicts,
   and infrastructure failures to their respective owners. Do not change code
   merely to satisfy an incorrect suggestion; report the reasoning. Post replies
   or resolve threads only within the authorized review-response assignment,
   after verifying the action or explanation addresses the feedback.
6. After a repair push, refresh the head, reviews, and complete required-check
   inventory. Re-observe or rerun checks invalidated by that change. Do not use
   old success evidence to declare the replacement revision ready.

**Prohibited:** report a PR ready because one test suite passed while another
required check is missing, or retry a failing product test until it happens to pass.

**Preferred:** return all observed failures with run URLs and diagnostics, route
repairs to their owners, and verify the resulting revision's required checks.

### Merge and verify the outcome

1. Confirm merge is authorized by the user or current assignment. Refresh the
   PR head, target, checks, review state, and mergeability immediately before it.
2. If the feature head changed, reevaluate the replacement revision. If the
   target advanced, follow the project's update or merge-queue policy; send
   necessary branch integration to its owner and repeat invalidated checks.
3. Merge through GitHub using the permitted strategy and current-head guard
   where supported. Honor required reviews, environment gates, and merge queues;
   do not use administrator bypasses. A queued merge is still pending.
4. Verify GitHub reports the PR as merged. Fetch the target and verify the
   reported merge result is included there; a closed PR is not sufficient.
5. Delete the merged remote feature branch only when project cleanup policy and
   assignment scope call for it. Leave protected, shared, or still-needed
   branches intact. Return remaining local workspace cleanup to its owner.
6. Report the PR URL, evaluated head, required-check and review results, actual
   merge result, and cleanup outcome. Report cleanup failures separately from a
   successful merge; do not repeat the merge to repair cleanup.

**Prohibited:** promise success when a merge is only queued, or change the
repository's merge strategy because another project uses squash merges.

**Preferred:** follow the configured strategy, observe the actual merge result,
and state precisely which cleanup succeeded or remains outstanding.

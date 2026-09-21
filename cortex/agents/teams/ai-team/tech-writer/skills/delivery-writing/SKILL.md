---
name: delivery-writing
description: Write and maintain delivery-agent instructions and Git workflow documentation with concrete workspace context, command examples, and observable results.
---

# Delivery Writing

Apply this authoring guidance to delivery roles, skills, and practices. Use the
shared writing and executable-example prerequisites supplied by the tech-writer
role. The assigned delivery requirements remain the technical authority.

## Required actions

### Make responsibilities concrete

- Name who creates feature and worker worktrees, who starts integration, and
  who receives results.
- Describe completion and communication as ordinary task progress.
- State what each report contains: branch names, workspace paths, check results,
  or files needing correction, as applicable to the operation.
- Keep role responsibilities in the agent document and Git procedures in their
  owning skill. Update their callers when the ownership changes.

**Prohibited:** write "manage delivery and report status" without identifying
the work or recipient.

**Preferred:** write "after Team Gizmo reports that a worker finished, merge its
task branch and report the combined checks or conflicting files to Team Gizmo."

### Supply command context

- Name the working directory and branch affected by each command.
- Define command variables before use. Distinguish the original repository,
  feature worktree, and worker worktree.
- Show the command that performs the documented action. Use quoted path and
  branch variables; state whether values are examples or assignment inputs.
- Explain which steps repeat per worker and which run once per feature.

**Prohibited:** show only `git merge task/parser`, leaving the current checkout
and destination branch implicit.

**Preferred:** state that `feature_path` is the absolute path of the worktree
checked out on the feature branch and `task_branch` is the completed worker's
assigned branch name, then show:

```sh
git -C "$feature_path" merge --no-edit -- "$task_branch"
```

The surrounding procedure supplies the readiness checks and subsequent validation.

### Explain results and failure paths

- State the observable result of each operation and what to do when it fails.
- Distinguish Git success from the project's build or test results.
- Write conditional command sequences as conditional steps. Do not present
  conflict repair, abort, or cleanup as commands to run unconditionally.
- Use branches in workflow examples and reports. Describe the assigned process
  without adding revision bookkeeping or a separate coordination mechanism.

**Prohibited:** place merge, abort, and branch deletion in one unconditional
command block and label it "integration."

**Preferred:** show the merge in the normal path, abort under the conflict path,
and cleanup after the documented completion checks. Report test results separately.

## Validation

- Exercise Git examples in a disposable repository with linked worktrees and
  representative branches. Keep validation scaffolding outside the skill.
- Test each documented path, including conflicts or cleanup refusal when the
  example claims those behaviors. Verify the reason for failure.
- Verify the resulting files, branch relationships, and workspace state rather
  than reporting only command exit codes.
- Report executed examples separately from prose review and untested scenarios.
  Example validation does not authorize changes to a live project or remote.

**Prohibited:** claim the cleanup example protects pending work after checking
only that its command parses.

**Preferred:** attempt ordinary worktree removal in a disposable dirty workspace,
confirm Git refuses for that reason, and check the pending files remain.

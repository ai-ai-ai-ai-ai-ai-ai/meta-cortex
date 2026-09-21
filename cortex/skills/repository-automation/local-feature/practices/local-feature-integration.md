# Local Feature Integration

Combine isolated task branches into one validated local feature branch using
ordinary Git. Inputs are the project repository, selected base branch, feature
scope, task dependencies, and required validation commands. Branch names are
the interface for assignments, handoffs, merges, and reports.

## Required actions

### Establish the feature workspace

1. Inspect repository status and existing worktrees before changing Git state.
2. Use the user- or project-selected base branch. Otherwise use the current
   checked-out branch and report that choice. If no branch is checked out,
   resolve the base-branch choice before proceeding. Do not fetch or choose a
   remote base implicitly for local-only work.
3. Create a uniquely named feature branch and separate integration worktree
   from the base branch. Follow the host or project's branch naming convention.
   Reuse an explicitly assigned feature workspace after verifying its branch
   and ownership; do not create a nested feature for every assignment.
4. Record the feature branch, integration path, and base branch. Preserve
   unrelated dirty files in their existing checkout. If the task needs pending
   edits, establish which changes belong to it before transferring them; a new
   worktree does not copy another checkout's pending edits.

**Prohibited:** create a feature from an assumed `main`, then claim that another
checkout's pending fix is included.

**Preferred:** create the feature from the supplied base branch and leave
unrelated edits untouched. Identify any needed pending input explicitly.

### Isolate task writes

- Give each write assignment its own branch and worktree from the validated
  feature branch. Record the branch names, bounded file scope, and dependencies.
- Start dependent work after its prerequisites are integrated and validated.
  Independent tasks may start from the same feature branch and run concurrently.
- Give the integration worktree one writer. Other contributors write only in
  their assigned worktrees; working-directory changes do not isolate a session.
- Pass absolute working and library locations. An ignored framework directory
  may exist only in the original checkout; retain that resolved library path
  while source edits and tests use the assigned worktree. Do not assume ignored
  dependencies, build outputs, or secrets were copied by `git worktree add`.
- Read-only assignments need an identified source branch, not a write branch.
  Coordinate their review with its writer so it stays unchanged during review.
  They must not run commands that mutate a shared checkout.

**Prohibited:** two contributors edit the feature checkout, or a child silently
loads a missing framework relative to its new working directory.

**Preferred:** issue separate task paths and the actual library path. Start a
dependent task after its prerequisite is merged into the feature branch; give
a read-only reviewer a stable branch to inspect.

### Hand off a task branch

1. Inspect the diff and save only assigned changes on the task branch. Do not
   sweep unrelated files into its history.
2. Run required focused validation on the finished branch. If validation changes
   tracked files, review and save those changes and rerun affected checks.
3. Return the task branch, worktree, feature branch, changed scope, check commands
   and results, and unresolved limitations. Do not use revision identifiers or
   lists of individual changesets as handoff inputs.
4. Leave the worktree clean and freeze the handed-off branch until explicit
   reassignment or cleanup. Report unfinished or pending work as incomplete.

**Prohibited:** report a branch ready while tests ran before its final edit,
then keep changing it while integration is underway.

**Preferred:** hand off `task/parser` with a clean status and checks for its
finished content. Wait for reassignment before changing that branch again.

### Integrate accepted branches serially

1. Accept a branch's scope and evidence before integrating it. Select branches
   in dependency order; only one integration may run at a time.
2. Verify the assigned feature branch and clean integration worktree. Stop on
   unexpected changes or an unfinished Git operation; report the actual state
   instead of resetting it. Confirm the task branch remains frozen. If it was
   changed after review, return it for renewed review and validation.
3. Review the branch diff against the assignment. For a repair that merged the
   feature branch, distinguish already integrated changes from the task's own
   changes and inspect conflict resolutions.
4. Merge the accepted task branch by name using fast-forward when possible,
   otherwise an ordinary Git merge. Preserve branch history. Do not squash,
   cherry-pick, rebase, amend, or reset accepted feature history. If repository
   policy requires linear history, resolve that conflict before divergent work;
   do not silently substitute another strategy.
5. Verify the task branch is fully merged into the feature branch using Git's
   branch comparison, such as `git branch --merged feature/example`. Run applicable
   combined validation. Report the feature branch, merged task branches,
   commands, and outcomes. Changes to a branch invalidate affected checks.

**Prohibited:** merge a task branch while its worker is still changing it, or
let two integrations update the feature branch simultaneously.

**Preferred:** freeze and accept `task/parser` and `task/ui`. Merge each branch
by name in order, check both are fully merged, and validate the combined feature.

### Recover without discarding work

- On a merge conflict, record the conflicting paths and abort the attempted
  merge. Verify the feature branch's previous state and clean status were
  restored. If abort fails, preserve both workspaces and report the Git state.
- Return substantive conflict resolution to the owner of the affected work.
  Reassign its task branch and coordinate decisions that span scopes. The owner
  merges the feature branch into its task branch, resolves the conflict, saves
  the result, validates, and hands off that branch again. Preserve task history.
- If combined validation fails after a successful merge, report the feature
  branch as integrated but unvalidated. Pause dependent integration and cleanup.
  Assign a repair branch from the feature branch and integrate its fix through
  the same workflow; do not reset away accepted work.
- On interruption, inspect Git status and which task branches are fully merged
  before continuing. An already merged branch needs outstanding validation,
  not a replacement merge or an invented handoff recovery service.

**Prohibited:** resolve a domain conflict by choosing one side without its owner,
or reset the feature after a failing combined check and discard task branches.

**Preferred:** abort the conflict and return the task branch for repair. For a
completed merge with failing checks, retain its history and merge a repair
branch before calling the feature validated.

### Complete and clean up

1. Check that every accepted task branch is fully merged into the feature branch.
   Complete required feature validation and report failures or unrun checks
   explicitly. Keep the integration worktree clean.
2. Obtain the task owner's cleanup decision. For each finished task, verify its
   branch is fully merged, its worktree is clean, and no assignment still uses
   it. If it has new work, retain it and report that work.
3. Remove only owned, finished task worktrees with ordinary `git worktree remove`.
   Delete their branches using `git branch -d` from the feature worktree after
   checking they are fully merged. Stop on refusal; do not force cleanup.
4. Retain the feature branch and integration worktree. Return their locations,
   merged task branch names, validation results, and retained task branches.
   Local completion excludes pushing, PR creation, and merging into the base branch.

**Prohibited:** delete a task branch after merely receiving its name, or force
cleanup of a worktree containing pending follow-up work.

**Preferred:** validate the combined feature and verify every task branch is fully
merged before removing clean, finished task worktrees and branches. Keep the
feature branch available for review or separately authorized delivery.

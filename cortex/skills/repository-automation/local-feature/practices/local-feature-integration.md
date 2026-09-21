# Local Feature Integration

Keep contributions reachable in Git while combining isolated work into one
local feature branch. Inputs are the project repository, selected base,
feature scope, task dependencies, and required validation commands.

## Required actions

### Establish the feature workspace

1. Inspect repository status and existing worktrees before changing Git state.
2. Resolve the user- or project-selected base to an exact commit. If neither
   specifies a base, use the current committed `HEAD` and report that choice.
   Do not fetch or choose a remote base implicitly for local-only work.
3. Create a uniquely named feature branch and separate integration worktree
   from that commit. Follow the host or project's branch naming convention.
   Reuse an explicitly assigned feature workspace after verifying its branch,
   head, and ownership; do not create a nested feature for every assignment.
4. Record the feature branch, integration path, and base SHA in the handoff.
   Preserve unrelated dirty files in their existing checkout. If the task
   needs uncommitted input, establish which changes belong to it before
   transferring them; a new worktree contains only committed content.

**Prohibited:** create a feature from an assumed `main`, then claim that another
checkout's uncommitted fix is included.

**Preferred:** resolve the supplied base, create the feature from that SHA, and
leave unrelated edits untouched. Identify any needed uncommitted input explicitly.

### Isolate task writes

- Give each write assignment its own branch and worktree from an accepted
  feature commit. Record its base SHA, bounded file scope, and dependencies.
- Start dependent work after its prerequisites are integrated and validated.
  Independent tasks may share a base and run concurrently.
- Give the integration worktree one writer. Other contributors write only in
  their assigned worktrees; working-directory changes do not isolate a session.
- Pass absolute working and library locations. An ignored framework directory
  may exist only in the original checkout; retain that resolved library path
  while source edits and tests use the assigned worktree. Do not assume ignored
  dependencies, build outputs, or secrets were copied by `git worktree add`.
- Read-only assignments need an identified source revision, not a write branch.
  They must not run formatters or other commands that mutate a shared checkout.

**Prohibited:** two contributors edit the feature checkout, or a child silently
loads a missing framework relative to its new working directory.

**Preferred:** issue separate task paths and the actual library path. Start a
dependent task from the feature head containing its prerequisite; give a
read-only reviewer the committed revision to inspect.

### Commit and hand off a contribution

1. Inspect the diff and stage only assigned changes. Commit coherent changes
   on the task branch; do not sweep unrelated files into a commit.
2. Run the required focused validation on the handed-off committed content.
   If validation changes tracked files, review and commit those changes and
   rerun affected checks before handoff.
3. Return the task branch, worktree, base SHA, exact tip SHA, changed scope,
   check commands and results, and any unresolved limitations.
4. Leave the worktree clean and freeze the handed-off branch until explicit
   reassignment or cleanup. Report unfinished or uncommitted work as incomplete.

**Prohibited:** report "done on my branch" while tests ran before the final edit,
then keep amending commits while integration is underway.

**Preferred:** hand off a fixed tip SHA with a clean status and checks for that
content. Wait for a new assignment before making further commits.

### Integrate accepted commits serially

1. Accept a contribution's scope and evidence before integrating it. Select
   contributions in dependency order; only one integration may run at a time.
2. Verify the expected feature head, branch, and clean integration worktree.
   Stop on unexpected changes or an unfinished Git operation; report the actual
   state instead of resetting it. Verify the frozen task branch still names the
   handed-off tip, and that its base is an ancestor of both that tip and the
   feature head. Review the contribution's diff against the assignment. For a
   repair that merged accepted feature history, distinguish those already
   integrated changes from the task's own delta; inspect conflict resolutions.
3. Merge the accepted exact tip SHA using fast-forward when possible, otherwise
   an ordinary merge commit. Preserve every handed-off commit's ancestry.
   Do not squash, cherry-pick, rebase, amend, or reset accepted feature history.
   If repository policy prohibits merge commits, resolve that policy conflict
   before starting divergent work; do not silently substitute another strategy.
4. Verify the handed-off tip is an ancestor of the resulting feature head with
   `git merge-base --is-ancestor`. Record the previous and resulting feature SHAs.
5. Run applicable combined validation on that result. Report the integrated tip,
   resulting feature SHA, commands, and outcomes. Individual task checks do not
   prove the combined feature works. A changed head invalidates checks affected
   by that change.

**Prohibited:** merge a moving branch name concurrently with another integration,
or squash it and delete the only branch retaining its original commits.

**Preferred:** accept tips A and B, merge A, validate, then merge B against the
observed feature head. Check both tips' ancestry and validate the combined result.

### Recover without discarding work

- On a merge conflict, record the conflicting paths and abort the attempted
  merge. Verify the pre-merge feature head and clean status were restored.
  If abort fails, preserve both workspaces and report the Git state.
- Return substantive conflict resolution to the owner of the affected work.
  Reassign the task with the current feature SHA and coordinate decisions that
  span scopes. In its task worktree, the owner merges that feature commit,
  resolves the conflict, commits, validates, and hands off a new frozen tip.
  Preserve the original task commits and report the feature SHA used for repair.
- If combined validation fails after a successful merge, report that head as
  integrated but unvalidated. Pause dependent integration and cleanup. Repair
  through a new task based on that head; do not reset away accepted commits.
  An authorized rollback uses an explicit revert commit.
- On interruption, inspect Git status, branch heads, and ancestry before
  continuing. An already integrated tip needs outstanding validation, not a
  replacement merge or an invented handoff recovery service.

**Prohibited:** resolve a domain conflict by choosing one side without its owner,
or reset the feature after a failing combined check and discard task branches.

**Preferred:** abort the conflict and return it for repair. For a completed merge
with failing checks, retain its history and integrate a corrective commit before
calling the feature validated.

### Complete and clean up

1. Check that every accepted handoff tip remains an ancestor of the final feature
   head. Complete required feature validation at that head and report failures
   or unrun checks explicitly. Keep the integration worktree clean.
2. Obtain the task owner's cleanup decision. For each finished task, verify
   its current branch tip is integrated, its worktree is clean, and no assignment
   still uses it. If it has advanced, retain it and report the new work.
3. Remove only owned, finished task worktrees with ordinary `git worktree remove`.
   Delete their branches using `git branch -d` from the feature worktree after
   the ancestry checks. Stop on refusal; do not force removal or deletion.
4. Retain the feature branch and integration worktree. Return their locations,
   final SHA, accepted tips, validation results, and any retained task branches.
   Local completion does not include pushing, PR creation, or merging into the
   project's base branch.

**Prohibited:** delete a task branch after merely receiving its SHA, or force
cleanup of a worktree with uncommitted follow-up work.

**Preferred:** validate the combined feature, verify every current task tip is
reachable from it, then remove only clean, finished task worktrees and branches.
Keep the feature available for review or a separately authorized delivery step.

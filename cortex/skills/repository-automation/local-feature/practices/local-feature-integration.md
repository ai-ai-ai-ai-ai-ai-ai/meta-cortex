# Local Feature Integration

Use ordinary Git branches and worktrees to combine finished tasks into a
validated local feature branch. Work proceeds from task completion to integration.

## Required actions

### Set up workspaces

1. Inspect existing branches, worktrees, and pending edits. Preserve unrelated work.
2. Use the base branch selected by the user or project, otherwise the current
   checked-out branch. Resolve a missing branch choice before proceeding.
   Do not fetch implicitly for local-only work.
3. Create a feature branch and integration worktree, or reuse the explicitly
   assigned feature workspace. Follow the project's branch naming convention.
4. Create a separate task branch and worktree for each write assignment from
   the feature branch. Start dependent tasks after their prerequisites are
   integrated and validated; independent tasks may run concurrently.
5. Supply task scope, branch names, workspace paths, and validation requirements.
   Pass the actual framework library location separately: ignored libraries,
   dependencies, and pending edits are not copied into new Git worktrees.
   Read-only tasks need no write branch and must not modify shared workspaces.

**Prohibited:** assume subagent sessions automatically isolate their edits, or
create a task worktree expecting another checkout's pending edits to appear.

**Preferred:** create `task/parser` in its own worktree from the feature branch
and give its worker the correct source and library paths.

### Finish task work

- Keep changes within the assigned task branch and scope.
- Save the finished work on the branch and run the required focused checks.
  If checks change files, save those changes and rerun affected checks.
- Finish with a clean worktree and report the task result and validation outcome.
  Incomplete work or failed checks must be reported accurately.

**Prohibited:** report a task complete while its final edits remain unsaved or
its required checks have failed.

**Preferred:** finish the task branch, verify its changes, and report completion
so integration can begin.

### Integrate finished branches

1. Once a task is finished, integrate its branch in dependency order. Use one
   writer for the feature branch and merge one task branch at a time.
2. Check the integration worktree is on the feature branch and clean. Resolve
   an unfinished Git operation before attempting another merge; preserve
   unrelated changes instead of resetting them.
3. Inspect the task branch's changes against its scope. Merge it by branch name,
   using fast-forward when possible and an ordinary Git merge otherwise.
   Preserve branch history rather than squashing, cherry-picking, or rewriting
   the feature. Resolve incompatible repository merge policy before proceeding.
4. Run the relevant combined checks. Report which task branches were merged and
   the feature's validation results. Task checks alone do not validate the combination.

**Prohibited:** let workers merge concurrently into the feature branch or claim
that their separate passing checks prove the combined feature works.

**Preferred:** after `task/parser` finishes, merge it into the feature branch and
validate the result. Then integrate the next completed task in dependency order.

### Resolve integration failures

- If a merge conflicts, abort it and report the conflicting files. Have the
  owner resolve the conflict in its task worktree by merging the feature branch
  into the task branch. Once the repair and checks finish, integrate that branch.
- If combined checks fail, keep the branches and route the fix to its owner.
  Integrate the repair and rerun affected checks before dependent work or cleanup.
- If Git cannot complete or abort an operation, report its actual state and
  preserve the workspaces. Use ordinary Git to resolve it.

**Prohibited:** discard one side of a domain conflict without its owner or
remove branches while combined validation is failing.

**Preferred:** return the conflicting task for repair, then merge the repaired
branch and check the feature again.

### Complete and clean up

1. Verify finished task branches are fully merged using Git's branch comparison,
   such as `git branch --merged feature/example`. Complete feature validation.
2. Remove finished task worktrees with `git worktree remove` and their branches
   with `git branch -d` from the feature worktree. Keep any branch that still has
   work in progress or unmerged changes. Do not force cleanup if Git refuses.
3. Retain the feature branch and integration worktree. Report their locations,
   merged tasks, check results, and unfinished work. Local completion excludes
   publishing, PR creation, and merging into the base branch.

**Prohibited:** force-delete an unmerged task branch or a dirty worktree.

**Preferred:** let Git confirm branches are merged, remove only finished task
workspaces, and leave the validated feature branch available for review.

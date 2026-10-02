# Read the Assigned Git Commit

Every verifier reads committed objects without changing a checkout. This document
owns its Git commands. The communication protocol owns messages and reports;
the delivery team's local-feature practice owns commits and merges.

## Required actions

### Resolve the supplied commit

1. Take `repo_path` from the assignment's absolute consuming-project workspace.
   Take `commit_sha` from Gizmo's request. These are inputs, not example defaults.
   If either is missing, use the protocol's `need_context` or `need_commit`
   response before running dependent commands. Commands below use a POSIX shell.
2. Confirm the repository and resolve the supplied value:

   ```sh
   git -C "$repo_path" rev-parse --show-toplevel
   review_sha=$(git -C "$repo_path" rev-parse --verify --end-of-options "$commit_sha^{commit}")
   test "$review_sha" = "$commit_sha"
   git -C "$repo_path" cat-file commit "$review_sha"
   ```

   Stop on any failed command. Require the resolved full object ID to equal the
   supplied value: a branch, abbreviated SHA, or tag is not the requested full
   commit identity. Do not substitute `HEAD`. If the object is unavailable,
   send `need_commit`; Gizmo arranges object availability with the Git owner.
   The verifier does not fetch or switch branches to repair its assignment.
3. Read the commit headers before the blank line in `cat-file` output. If a
   `parent` header exists, set `parent_sha` to the first parent's full object ID
   and verify that object:

   ```sh
   git -C "$repo_path" cat-file -e "$parent_sha^{commit}"
   ```

   A merge still uses only its first parent. A commit with no parent header is
   a root commit. A missing parent object is a blocker, not a root commit;
   this distinction also applies in a shallow repository. Do not infer root
   status from a failed `review_sha^` lookup.
   Send `need_context` naming the unavailable parent and save blocked progress;
   resume only when Gizmo supplies a repository containing the required objects.

**Prohibited:** review the current checkout after a SHA lookup fails, or treat
an unavailable parent as permission to review the entire tree as newly added.

**Required:** resolve Gizmo's exact SHA, read its actual parent header, and
report missing objects before claiming a complete inventory.

### Enumerate the complete change

1. For a commit with a parent, run:

   ```sh
   git -C "$repo_path" diff --no-ext-diff --no-textconv --name-status -z --find-renames "$parent_sha" "$review_sha" --
   git -C "$repo_path" diff --no-ext-diff --no-textconv --no-color --find-renames "$parent_sha" "$review_sha" --
   ```

   For a root commit, run these commands instead:

   ```sh
   git -C "$repo_path" diff-tree --root --no-commit-id -r --no-ext-diff --no-textconv --name-status -z --find-renames "$review_sha" --
   git -C "$repo_path" diff-tree --root --no-commit-id -r -p --no-ext-diff --no-textconv --no-color "$review_sha" --
   ```

2. Consume the first command's output as NUL-delimited fields. Do not split on
   whitespace or store that byte stream in a shell variable. `A`, `M`, `D`, and
   `T` have one path; `R` followed by its similarity score has old and new paths.
   Record them as `added`, `modified`, `deleted`, `type_changed`, or `renamed`.
   Preserve spaces, tabs, and newlines in paths. Unexpected statuses require
   explanation before the inventory can be called complete.
3. Keep the second command's patch beside that inventory. Include every path,
   not only files in the worker's primary language. Do not use combined merge output or a branch-wide range
   as a substitute for the specified first-parent comparison.

**Prohibited:** parse `git diff --name-only` by spaces and lose `src/order item.rs`,
or use a merge's combined diff and miss a first-parent change.

**Required:** retain the NUL-delimited path as one inventory entry. For a rename,
retain both names and inspect the explicit first-parent patch.

### Read files from committed objects

1. Set `path` to the exact repository-relative path from the inventory. For an
   added or modified text file, read its full content at the reviewed SHA:

   ```sh
   git -C "$repo_path" cat-file blob "$review_sha:$path"
   ```

2. For a deletion, read its content from the parent. For a rename, set `old_path`
   and `new_path` from the inventory and read both sides:

   ```sh
   git -C "$repo_path" cat-file blob "$parent_sha:$path"
   ```

   ```sh
   git -C "$repo_path" cat-file blob "$parent_sha:$old_path"
   git -C "$repo_path" cat-file blob "$review_sha:$new_path"
   ```

3. Inspect type changes on both sides with exact path matching:

   ```sh
   git --literal-pathspecs -C "$repo_path" ls-tree "$parent_sha" -- "$path"
   git --literal-pathspecs -C "$repo_path" ls-tree "$review_sha" -- "$path"
   ```

   Read blob content where applicable. A symlink blob contains its target;
   do not follow a filesystem symlink. A submodule entry names a commit, not
   a text file. Retain binary and submodule changes in the inventory, inspect
   their applicable metadata, and report any evidence needed for a decision.
   Do not claim that a failed blob read checked their content.
4. Read relevant callers, owning types, and earlier repair locations with the
   same committed-object commands, even when those paths are unchanged. Cite
   lines from that revision; deleted content uses parent lines. Never replace
   these reads with `cat` of a moving checkout.

**Prohibited:** inspect the renamed file from disk and quote lines containing
uncommitted edits as evidence about Gizmo's SHA.

**Required:** read the old committed path from the parent and the new path from
the reviewed commit. Keep an unreadable object as an explicit blocker.

### Finish without changing Git state

1. Apply every catalog rule and save the complete report under the communication
   protocol. A successful Git command establishes available evidence, not compliance.
2. Return the reviewed SHA, full findings, and blockers to Gizmo. The verifier
   creates no code commit or checkpoint; its read-only ledger result is the handoff.
3. If validation needs a checkout, ask Gizmo to have the integration owner prepare
   the exact revision and the assigned validation owner run the required commands.
   Do not check out the SHA, reset, clean, stage, commit, merge, or modify the
   developer's workspace. Existing matching validation evidence can be reused.

**Prohibited:** check out the reviewed SHA in the developer's worktree to run
tests, then commit a report to make the read-only task ready.

**Required:** inspect objects in place, record the report in the ledger, and
request missing exact-revision test evidence through Gizmo.

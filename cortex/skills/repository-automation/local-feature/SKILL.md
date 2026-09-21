---
name: local-feature
description: Manage local Git feature branches, isolated task worktrees, branch handoffs, integration, and safe cleanup. Use for local repository changes; excludes publishing and pull requests.
---

# Local Feature Work

Produce a validated local feature branch using ordinary Git and the host's
coordination tools. This skill is independent of languages and agent roles.

## Required actions

- Read [local feature integration](practices/local-feature-integration.md)
  before creating task worktrees, handing off task branches, or integrating changes.
- Use the [rule map](knowledge-graph.md) to locate individual decisions when
  reviewing or changing this practice.

**Prohibited:** treat a request to prepare local changes as permission to push
them and open a pull request.

**Preferred:** return the validated local feature branch. Perform publishing only
under a separate, authorized workflow.

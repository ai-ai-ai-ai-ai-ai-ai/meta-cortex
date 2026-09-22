# Delivery Team

Team Gizmo uses this catalog for local integration and GitHub pull-request
assignments. Apply the [delivery knowledge](docs/index.md). In single-agent mode,
the current agent uses the relevant role and skill directly.

## Agent catalog

- **[Integration agent](agents/integration-agent/AGENTS.md)**
  - Status: implemented role instructions.
  - Creates assigned local feature and task workspaces.
  - Integrates finished task branches, validates the combined feature, and performs
    local cleanup.
  - Returns branch and validation evidence to Team Gizmo.
  - Excludes product implementation, task coordination, remote publishing,
    pull requests, and merging the feature into the base branch.

- **[PR agent](agents/pr-agent/AGENTS.md)**
  - Status: implemented role instructions and Pull Request Delivery skill.
  - Publishes assigned feature branches and creates or updates their GitHub PRs.
  - Tracks checks and feedback, performs authorized merges, and verifies cleanup.
  - Returns PR, revision, validation, and merge evidence to Team Gizmo.
  - Excludes application repairs, local branch integration, CI infrastructure,
    deployments, and release-pipeline design.

## Assignment boundaries

Keep local integration with the integration agent and remote PR mechanics with
the PR agent. Request the SRE CI/CD agent for pipeline execution or repairs when
needed. Required checks, reviews, merge strategy, and cleanup follow the consuming
project; this team does not prescribe a target branch or build system.

**Prohibited:** require every PR to launch integration and CI/CD agents even when
an integrated branch and matching validation results are already available.

**Preferred:** assign the missing delivery work and reuse existing branch and
run evidence after verifying that it applies to the current PR.

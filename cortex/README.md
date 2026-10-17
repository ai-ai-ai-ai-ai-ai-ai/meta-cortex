# Using Meta-Cortex

Meta-Cortex coordinates agents to turn ideas and requirements into working
software in your project. Your AI host supplies the models and execution tools.

## Project context

The framework's [entry point](AGENTS.md) establishes the consuming project as
the workspace for development tasks.

- **Project repository**
  - Holds the code, requirements, and project-specific instructions.
  - Owns the implementation and validation work.
- **Framework library**
  - Holds reusable agent instructions, skills, practices, and configuration.
  - Changes only when the task concerns that guidance or configuration.

Document links resolve relative to their containing document.
Source paths and development commands resolve in the consuming project or its
assigned worktree.

## Agent coordination

Give your host a development task with the framework entry point loaded.
The host launches Gizmo Prime, which directly launches and manages the
workers and independent verifiers needed for the task. The
[agent instructions](teams/AGENTS.md) define this hierarchy, and the
[coordination architecture](teams/gizmo-team/docs/coordination-state-machine.md)
owns its decisions and handoffs.

At the start of each new session, the host collects a
[delivery choice](AGENTS.md#development-delivery) through an available host UI
or conversation, using the same answer validation:

- `create_pr` (recommended) commits and pushes the validated feature and creates
  or updates its PR.
- `local_only` keeps implementation and required validation local.

The [delivery policy](teams/delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery)
defines completion for each outcome. The host validates an explicit choice already
supplied in the session without asking again. Tasks, follow-ups, and delegated
agents inherit it; an explicit user change applies before further affected work.
A new conversation collects delivery again. Cancelled or pending collection stops
dependent work. If no interaction channel is allowed, the host reports the blocker.
Choose only the active host from the
[host reference catalog](teams/gizmo-team/docs/hosts/index.yaml) for its mappings.

- **Gizmo Prime**
  - Owns scope, acceptance criteria, and the overall outcome.
  - Directly coordinates bounded specialist and verifier assignments across teams.
  - Delegates mechanical execution, including setup, edits, checks, and publication.
  - Evaluates results, assigns corrections, and accepts the combined delivery.
- **Team agents**
  - Apply relevant skills to implement and validate their assignments.
  - Report evidence and unresolved blockers only to their assigning Gizmo Prime.
    Prime decides further assignments and passes evidence between agents.
- **[Integration agent](teams/delivery-team/agents/integration-agent/AGENTS.md)**
  - Manages feature worktrees and merges completed task branches.
- **[PR agent](teams/delivery-team/agents/pr-agent/AGENTS.md)**
  - Publishes feature branches, manages PR feedback and checks, and performs authorized merges.
- **[CI/CD agent](teams/sre-team/agents/cicd-agent/AGENTS.md)**
  - Runs project-defined checks, repairs assigned pipeline infrastructure, and executes
    authorized project deployment procedures.

Each launch includes the [assignment context](teams/AGENTS.md#assignment-context):
project and library locations, team documentation, applicable circuit breakers,
and the agent’s role instructions. The receiving agent reads that context before
starting work; parent-session memory is not assumed.
Agents read the project's instructions and relevant code before acting.
Work continues until the requested outcome is supported by evidence.

The [SRE team](teams/sre-team/AGENTS.md) owns portable infrastructure,
container builds, Kubernetes workloads, and cloud-native operations. Its
specialized skills are:

- [Docker](teams/sre-team/agents/docker-specialist/skills/docker-skill/SKILL.md) for deliberate
  image inputs, secret boundaries, and real BuildKit cache evidence.
- [Kubernetes](teams/sre-team/agents/kubernetes-specialist/skills/kubernetes-skill/SKILL.md) for
  workloads that stay within the cluster runtime boundary.
- [Cloud-Native](teams/sre-team/agents/kubernetes-specialist/skills/cloud-native-skill/SKILL.md) for
  bounded, observable infrastructure and operational changes, loaded by the
  Kubernetes specialist for cloud-native assignments.

## PR delivery and CI/CD

With `create_pr`, implementation continues through PR creation or update without
a separate request. With `local_only`, it completes locally. You can override the
delivery choice for a task or change the session preference explicitly. Request
additional operations such as addressing feedback, checking CI, merging, or
executing an existing deployment procedure when needed. Gizmo Prime assigns only
the specialists needed for the requested work.

[Project delivery policy](teams/delivery-team/docs/project-delivery-policy.md) covers discovery of branch,
review, merge, and cleanup policy. [Project execution policy](teams/sre-team/docs/project-execution-policy.md)
covers discovery of execution commands and deployment procedures. Both follow the
consuming project's instructions and actual workflow definitions.

For example, one project may document `task check`, another `make verify`, and
another `just test`; the agents use the documented entry point. Meta-Cortex
introduces no build-system configuration schema or universal command adapter.
Release pipelines remain project-owned. The CI/CD agent can execute an existing
one when requested, but the framework does not define its release process.

- **Prohibited:** copy a project's Taskfile commands, squash-only policy, or release
  workflow into the generic framework and apply it to every consumer.

- **Required:** discover this project's supported operations, execute the requested
  scope, and report observed PR, run, merge, or deployment outcomes.

## Circuit breaker

The entry point loads the [circuit breaker](CIRCUIT-BREAKER.md) before roles and
skills. Every assignment carries it. Agents check proposed mechanisms before
implementation; Prime checks assignments and results. The global policy
owns precedence, scope checks, recovery, and preservation of product security.
Subject-specific rules live in the owning teams’ `CIRCUIT-BREAKER.md`
documents, linked from the global policy and each affected agent.

**Prohibited:** an ordinary handoff grows into encrypted agent channels and
persistent authority receipts.

**Required:** use the host's handoff tools and review the result against the
assignment. Use a focused second review for a concrete dispute, without a
permanent observer agent.

## Execution configuration

The [development form](development.yaml) defines the session delivery question. The
[user-input skill](teams/gizmo-team/agents/gizmo-prime/skills/user-input/SKILL.md)
includes a generic YAML form helper, an example, and usage instructions. It
uses Bun and the shared workspace dependencies installed by Framework / Initialize.

- Initialization installs missing mise in `~/.meta-cortex/mise` (`$HOME\.meta-cortex\mise` on Windows).
- Mise installs missing Bun in `~/.meta-cortex/bun` and Vale in `~/.meta-cortex/vale`.
- Runtime versions live in [mise.toml](mise.toml).
- Repositories, worktrees, and individual skills reuse these installations.
- Initialization uses these managed copies and ignores tools on the user's `PATH`.
- The entry point configures `PATH` for framework scripts in a POSIX shell.
- The helper validates data locally and returns typed questions in protocol version 2.
- The agent presents questions through native input or conversation and validates replies.
- Answers stay in session context.

In PowerShell, set the managed tool paths from the framework library directory:

```powershell
$metaCortexHome = if ($env:META_CORTEX_HOME) { $env:META_CORTEX_HOME } else { Join-Path $HOME '.meta-cortex' }
$env:PATH = "$metaCortexHome\mise\bin;$metaCortexHome\bun\bin;$metaCortexHome\vale\bin;$env:PATH"
bun scripts/src/ts/check-library-root.ts
```

Windows uses native `.exe` tools, with no WSL or Git Bash requirement.

**Prohibited:** use `export PATH=...` in PowerShell and assume Bun is configured.

**Required:** set `$env:PATH` and run the library-root check as above.

### Assignment execution settings

[meta-cortex.toml](meta-cortex.toml) sets `host.max_total_agents`, the scheduling
ceiling including the host agent and Prime. It does not require or allocate
that many host slots. The [capacity assessment](teams/gizmo-team/docs/agent-configuration.md#check-host-capacity)
preserves the hierarchy and queues work within available capacity.
Speed comes from the host session.

The launching agent assesses model and effort for each assignment using the
host's supported controls or known inherited settings under the
[selection policy](teams/gizmo-team/docs/agent-configuration.md#choose-settings-for-the-assignment).
Prime reassesses those choices when scope changes or results need repair.
The policy covers supported session updates and replacement handoffs that
preserve work. No manual role-model tuning is required.

- **Prohibited:** assign all tasks one fixed model and effort regardless of complexity.
- **Required:** assess available settings and their limits for the assignment,
  use supported controls or known inheritance, and reassess when evidence changes.

## Agent skills

Each agent’s `AGENTS.md` links its skills. Each skill’s `SKILL.md` contains its
instructions and prerequisites. Gizmo Prime assigns work by responsibility;
the assigned agent loads its own guidance.
The tech writer owns [skill organization](teams/ai-team/agents/tech-writer/AGENTS.md#skill-organization),
including placement and updates to callers when guidance moves.
Each practice has one canonical owner.

Skills live under their owning agents. An agent may use another agent’s skill
by linking to its canonical copy from its own instructions. There is no common
skill category or library-root skill directory.

The [tech writer](teams/ai-team/agents/tech-writer/AGENTS.md) owns Context
Engineering and Code Practice Writing for documentation and programming examples.

## Team documentation

Teams live directly under `teams/`. Each team groups its agents in `agents/`;
the Gizmo team contains the single coordinator, Gizmo Prime. Shared subject knowledge lives in
each owning team’s `docs/`. Its `index.yaml` contains only navigation links and
brief topic summaries. Skill catalogs branch into subject and namespace indexes
so focused assignments load only relevant rule summaries and related checks.
Rules, explanations, and examples remain in descriptively named Markdown documents.
The [development documentation catalog](teams/dev-team/docs/index.yaml)
links language-independent programming rules. The
[security documentation catalog](teams/security-team/docs/index.yaml)
links shared secret-handling requirements. Agents link relevant knowledge and
skills directly; there is no global knowledge directory or selection registry.

The framework's instructions remain generic.
Project-specific requirements and architecture belong to the consuming project.

## Documentation checks

Run from the library root to check its Markdown files:

```sh
bun run docs:check
```

Vale checks prose with bundled styles. Remark checks Markdown structure and local
links, including heading anchors. Two small plugins check Cortex article and
practice-index rules. Supply file paths, directories, or quoted globs to check
selected project documentation. See the
[context-engineering skill](teams/ai-team/agents/tech-writer/skills/context-engineering/SKILL.md#executable-audits)
for the checks and their limits.

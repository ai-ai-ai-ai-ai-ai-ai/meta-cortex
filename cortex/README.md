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
At the start of each new session, the current agent asks for a [development mode](AGENTS.md#development-mode)
using the host's native input UI:

- `single_agent` keeps implementation, checks, and delivery in the current thread
  and agent, with the relevant team docs, circuit breakers, and skills.
- `multi_agent` launches Gizmo Prime, which launches Team Gizmo and the team
  subagents needed for the task.

The agent waits for a submitted answer before starting development work. New
tasks and follow-ups in the same conversation retain the session’s mode; a new
conversation asks again. Delegated agents inherit the choice. Cancelling configuration stops
the task; a missing native UI is reported as a blocker. Codex uses
`request_user_input_async` when available; the host controls whether choices
appear as buttons or a dropdown.

The [agent instructions](teams/AGENTS.md) define the coordination workflow.
In multi-agent mode:

- **Gizmo Prime**
  - Owns the overall outcome.
  - Directs Team Gizmo.
- **Team Gizmo**
  - Coordinates bounded assignments across teams.
  - Checks results and routes corrections to their owners.
- **Team agents**
  - Apply relevant skills to implement and validate their assignments.
  - Return evidence and unresolved blockers.
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

Request the desired operation: publishing a PR, addressing feedback, checking CI,
merging, or executing an existing deployment procedure. In single-agent mode,
the current agent applies the relevant delivery and CI/CD skills. In multi-agent
mode, Team Gizmo assigns only the specialists needed for the requested work.

[Project delivery policy](teams/delivery-team/docs/project-delivery-policy.md) covers discovery of branch,
review, merge, and cleanup policy. [Project execution policy](teams/sre-team/docs/project-execution-policy.md)
covers discovery of execution commands and deployment procedures. Both follow the
consuming project's instructions and actual workflow definitions.

For example, one project may document `task check`, another `make verify`, and
another `just test`; the agents use the documented entry point. Meta-Cortex
introduces no build-system configuration schema or universal command adapter.
Release pipelines remain project-owned. The CI/CD agent can execute an existing
one when requested, but the framework does not define its release process.

**Prohibited:** copy a project's Taskfile commands, squash-only policy, or release
workflow into the generic framework and apply it to every consumer.

**Preferred:** discover this project's supported operations, execute the requested
scope, and report observed PR, run, merge, or deployment outcomes.

## Circuit breaker

The entry point loads the [circuit breaker](CIRCUIT-BREAKER.md) before roles and
skills. Every assignment carries it. Agents check proposed mechanisms before
implementation; coordinators check assignments and results. The global policy
owns precedence, scope checks, recovery, and preservation of product security.
Subject-specific rules live in the owning teams’ `CIRCUIT-BREAKER.md`
documents, linked from the global policy and each affected agent.

**Prohibited:** an ordinary handoff grows into encrypted agent channels and
persistent authority receipts.

**Preferred:** use the host's handoff tools and review the result against the
assignment. Use a focused second review for a concrete dispute, without a
permanent observer agent.

## Execution configuration

The [development form](development.yaml) defines the session-mode question. The
[user-input skill](teams/gizmo-team/agents/gizmo/skills/user-input/SKILL.md)
includes a generic YAML form helper, an example, and usage instructions. It
requires Bun 1.3.14 and the library's workspace dependencies; install once from
the library root with `bun install --frozen-lockfile --ignore-scripts`. The helper
validates data locally, while the current agent calls the host's native question
tool. Answers stay in session context rather than a repository configuration file.

[meta-cortex.toml](meta-cortex.toml) selects the model and reasoning effort for
each delegated role in multi-agent mode. Single-agent mode keeps the current
host settings. The [configuration rules](AGENTS.md#agent-configuration) define how
the host applies those settings.

1. Check that the configured models and reasoning efforts are supported by your host.
2. Adjust the role settings to match your intended execution setup.
3. Start the task through a host capable of running the configured roles.
   - Unsupported settings or missing execution capabilities are reported as blockers.
   - Agents must not silently substitute another configuration.

## Agent skills

Each agent’s `AGENTS.md` links its skills. Each skill’s `SKILL.md` contains its
instructions and prerequisites. Team Gizmo assigns work by responsibility;
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
the Gizmo team contains both coordinators. Shared subject knowledge lives in
each owning team’s `docs/`. Its `index.md` contains only navigation links and
brief topic summaries. Rules, explanations, and examples live in descriptively
named documents.
The [development documentation catalog](teams/dev-team/docs/index.md)
links language-independent programming rules. The
[security documentation catalog](teams/security-team/docs/index.md)
links shared secret-handling requirements. Agents link relevant knowledge and
skills directly; there is no global knowledge directory or selection registry.

The framework's instructions remain generic.
Project-specific requirements and architecture belong to the consuming project.

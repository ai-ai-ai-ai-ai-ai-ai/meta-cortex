# Meta-Cortex

Meta-Cortex is a composable development platform. Its agents, rules, skills,
and configuration form one framework. Projects include it as an AI library.
The host supplies models, tools, and the execution environment. Agents turn
requirements into working software through the host's agent execution tools.
The [coordination architecture](teams/gizmo-team/docs/coordination-state-machine.md)
describes the framework architecture and the outcomes connecting those responsibilities.

## Required actions

### Entry point

For each new user task, follow this order:

1. Read the [circuit breaker](CIRCUIT-BREAKER.md) before other framework documents.
   Carry its policy and resolved path through every assignment.
2. Establish the [project context](#project-context).
3. Resolve the session's [delivery choice](#development-delivery) before planning,
   implementation, or an agent launch.
4. Read [meta-cortex.toml](meta-cortex.toml) and apply the
   [agent configuration rules](teams/gizmo-team/docs/agent-configuration.md),
   including the host capacity preflight.
5. Read the [team instructions](teams/AGENTS.md). Launch Gizmo Prime through the
   host's agent execution tool with the task context. Prime launches Team Gizmo;
   Team Gizmo assigns the workers and verifiers needed for the task.

**Prohibited:** begin implementation in the host thread or launch Prime before
reading the circuit breaker, establishing context, and validating delivery.

**Required:** resolve both roots and delivery, check host capacity, then launch
Prime under the coordination hierarchy. Report an unavailable required host
capability as a blocker.

### Development delivery

The host agent uses the
[user-input skill](teams/gizmo-team/agents/gizmo/skills/user-input/SKILL.md)
with [development.yaml](development.yaml) to validate
`answers["development.delivery"]`.

#### Collect the delivery choice

- At the start of a new user-facing session, collect `development.delivery`
  through an available interaction channel under that skill.
- Validate a choice explicitly supplied in the current session. Do not ask the
  user to repeat it.
- Wait for a validated answer before dependent development work or agent launches.
- Do not infer delivery from an earlier session, repository settings, or a
  preselected host option.
- If collection is cancelled, unavailable, invalid, or pending, stop dependent work.

**Prohibited:** treat the preselected `create_pr` option as a submitted answer
and begin implementation while delivery is still pending.

**Required:** validate the user's explicit `create_pr` choice, then launch the
coordinated work with that delivery outcome in its assignment.

#### Apply delivery

- **`create_pr`** commits and pushes the validated feature and creates or updates
  its PR. This is the recommended first option.
- **`local_only`** completes implementation and required validation locally.

The [project delivery policy](teams/delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery)
owns completion and publication requirements.

**Prohibited:** finish after local implementation when delivery is `create_pr`.

**Required:** carry the validated `create_pr` choice through implementation,
review, integration, and PR publication; report the PR and observed checks.

#### Retain and change delivery

A session is the current user-facing conversation or thread.

- Retain delivery across tasks, follow-ups, turns, and context compaction.
  Include it in continuation context and every assignment.
- Delegated agents inherit the validated choice and never collect it again.
- Collect delivery for a new user-facing conversation. If it is lost in the
  current session, recover it from context or ask only for that missing choice.
- Keep delivery in session context. Do not persist it as a model setting,
  rewrite `meta-cortex.toml`, or save answers in the repository.
- Apply an explicit user change before further affected work and pass it to
  active agents. A task-specific override leaves the session preference intact.

**Prohibited:** ask for delivery again on every follow-up, or publish after the
user explicitly changes delivery to `local_only`.

**Required:** reuse validated delivery on follow-ups. Apply a task's explicit
local-only override to that task and retain the session preference for later work.

### Project context

Identify both roots before planning development work:

- **Library root**
  - Run from this file's directory; continue only if it succeeds:

    ```sh
    export PATH="${META_CORTEX_HOME:-$HOME/.meta-cortex}/bun/bin:$PATH" &&
    bun scripts/src/ts/check-library-root.ts
    ```

  - In PowerShell, use the native managed Bun path and check the exit code:

    ```powershell
    $metaCortexHome = if ($env:META_CORTEX_HOME) { $env:META_CORTEX_HOME } else { Join-Path $HOME '.meta-cortex' }
    $env:PATH = "$metaCortexHome\bun\bin;$env:PATH"
    bun scripts/src/ts/check-library-root.ts
    if ($LASTEXITCODE -ne 0) { throw 'Meta-Cortex library-root check failed.' }
    ```

    **Prohibited:** continue after the library-root check returns a nonzero exit code.

    **Required:** stop on failure; run subsequent framework commands only after
    the check succeeds. See [execution configuration](README.md#execution-configuration)
    for all managed tool paths.

  - Supplies Meta-Cortex instructions, roles, skills, and configuration.
  - Use this PATH for subsequent framework script commands. Supply it again when
    the host starts a new shell for each tool call.
  - Initialization installs mise, Bun, Vale, and the shared workspace dependencies. If they are missing,
    rerun Framework / Initialize; individual skills do not reinstall them.
- **Project root**
  - The consuming repository that owns the user's development task.
  - Identify it from the host workspace and the project's instructions.

Apply the consuming project's context throughout the task:

- Apply [consuming project context](teams/gizmo-team/docs/project-context.md)
  before planning or work, including repository and nested `.cortex/` scopes.
- Resolve Markdown links and YAML catalog paths relative to their containing file.
- Follow [catalog loading](teams/ai-team/agents/tech-writer/skills/context-engineering/practices/knowledge-graphs.md#load-only-selected-branches)
  for authoring and implementation. Verifiers choose their investigation and
  context under the [review contract](teams/gizmo-team/agents/gizmo/skills/agent-verification/SKILL.md).
- Resolve source paths, manifests, tests, and commands against the consuming
  project or assigned project worktree.
- Pass the library location separately from each task worktree. An ignored
  installed library may remain in the original checkout.
- Interpret "the project" and "the repository" in skills as the consuming project.
- Map architectural examples to the project's actual packages and paths while
  preserving their rules.
- Implement changes and run validation within the assigned project scope.
- Pass project context, configuration rules, configuration file location, and
  team directory through every delegation. Each assigned agent loads the skills
  linked from its own instructions and follows their `SKILL.md` files.

**Prohibited:** treat an installed `.meta-cortex/` directory as the project root
and run the consuming project's tests against library paths.

**Required:** identify the consuming repository as the project root and the
installed framework as the library root. Read the project's instructions, run
its tests in its worktree, and pass both roots in assignments.

## Cortex context format

Read the [YAML context authoring entry point](teams/ai-team/agents/tech-writer/skills/context-engineering/AGENTS.yaml)
as text before changing Cortex context declarations. Context Engineering owns
these instructions and the
[authoring examples](teams/ai-team/agents/tech-writer/skills/context-engineering/examples/context/authoring.context.yaml).
The [shared Effect schema](scripts/src/ts/context-schema.ts) owns structural
validation; `bun run context:check` checks discovered `AGENTS.yaml` and
`*.context.yaml` files plus their static references. Run it from the library root.
Subject declarations belong beside their owning context. Agents read them as
text and interpret their wording within the active assignment. Validation never
executes ShellCommand strings. Existing Markdown instructions remain authoritative.

**Prohibited:** change the shared schema while assigned only to write context,
or use context declarations as an application workflow.

**Required:** author the assigned context with existing schema fields and run
`bun run context:check`; report a missing capability for a separate assignment.

## Prohibited actions

- Do not assume the project root is the library root or its immediate parent.
- Do not change the Meta-Cortex library unless the task concerns its rules,
  skills, roles, or configuration.

**Prohibited:** edit the installed framework to fix an unrelated application
endpoint in the consuming project.

**Required:** change the application's owning code in its project worktree.
Change the framework only when the task concerns its own rules, skills, roles,
or configuration.

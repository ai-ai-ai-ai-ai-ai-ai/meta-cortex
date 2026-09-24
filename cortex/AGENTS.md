# Meta-Cortex

Meta-Cortex is a composable development platform. Its agents, rules, skills,
and configuration form one framework. Projects include it as an AI library.
The host supplies models, tools, and the execution environment. Agents turn
requirements into working software in the current thread or through the host's
agent execution tools.

## Required actions

### Entry point

For each new user task, follow this order:

1. Read the [circuit breaker](CIRCUIT-BREAKER.md) before other framework documents.
   Carry its policy and resolved path through every assignment.
2. Establish the [project context](#project-context).
3. Resolve the session's [mode and delivery choices](#development-mode) before
   planning, implementation, or an agent launch.
4. In `multi_agent` mode, read [meta-cortex.toml](meta-cortex.toml) and apply the
   [agent configuration rules](teams/gizmo-team/docs/agent-configuration.md).
5. In `multi_agent` mode, read the [team instructions](teams/AGENTS.md). Launch
   Gizmo Prime through the host's agent execution tool and pass the task context.
   The team instructions govern later launches and coordination.

**Prohibited:** launch Gizmo Prime as soon as a task arrives, before reading the
circuit breaker or resolving the session choices.

**Preferred:** read the circuit breaker, identify both roots, collect the session
choices, then follow the selected execution path.

### Development mode

The current agent uses the
[native user-input skill](teams/gizmo-team/agents/gizmo/skills/user-input/SKILL.md)
with [development.yaml](development.yaml). The two validated answers are
`answers["development.mode"]` and `answers["development.delivery"]`.

#### Collect the choices

- At the start of a new user-facing session, collect `development.mode` and
  `development.delivery` through the native input UI.
- Validate a choice explicitly supplied in the current session. Do not ask the
  user to repeat it.
- Wait for both validated answers before choosing execution or delivery.
- Do not infer an answer from an earlier session, repository settings, or a
  preselected host option.
- If configuration is cancelled, unavailable, invalid, or pending, stop dependent
  development work. Do not launch Gizmos while either question is pending.

**Prohibited:** treat the preselected `create_pr` option as a submitted answer
and begin implementation while delivery is still pending.

**Preferred:** validate the user's mode answer, collect and validate delivery,
then begin work under both selected choices.

#### Apply the selected paths

- **`single_agent`**
  - Use the current agent and thread. Do not spawn Gizmos, workers, reviewers,
    or integration subagents.
  - Read the relevant team and role instructions, team docs, circuit breakers,
    and skills locally. Use the [assignment context](teams/AGENTS.md#assignment-context)
    requirements.
  - Perform implementation, validation, and delivery in this thread. Keep the
    current host model and settings. Technical requirements still apply;
    delegation and coordinator routing requirements apply only in multi-agent mode.
- **`multi_agent`**
  - Use the existing Gizmo workflow and configured role settings.
- **`create_pr`**
  - This is the recommended first delivery option. Follow the
    [project delivery policy](teams/delivery-team/docs/project-delivery-policy.md#configured-implementation-delivery)
    to complete and publish the work.
- **`local_only`**
  - Keep work local under the same delivery policy.

**Prohibited:** select `single_agent`, then continue assigning work to Gizmo
workers or stop after implementation when the validated delivery is `create_pr`.

**Preferred:** with `single_agent` and `create_pr`, load the required context
locally, implement and verify the change, and publish its PR in this thread.

#### Retain and change session choices

A session is the current user-facing conversation or thread.

- Retain both choices across tasks, follow-ups, turns, and context compaction.
  Include them in continuation context and every assignment.
- Do not ask again for each task or delegated agent. A delegated agent inherits
  the parent session's choices.
- Collect both choices again for a new user-facing conversation. If one choice
  is lost in the current session, ask only for that missing choice.
- Keep choices in session context. Do not persist them as model settings,
  rewrite `meta-cortex.toml`, or save answers in the repository.
- Apply an explicit user change before further affected work. Retain the other
  choice and pass the change to active agents.
- When switching to `single_agent`, stop delegated agents before continuing.
  A task-specific override does not replace the session preference.

**Prohibited:** ask for both choices again on a follow-up, or keep delegated
agents running after the user switches to `single_agent`.

**Preferred:** reuse both validated choices on follow-ups. If the user changes
the mode to `single_agent`, stop delegated work, retain delivery, and continue
in this thread.

### Project context

Identify both roots before planning development work:

- **Library root**
  - Run from this file's directory; continue only if both commands succeed:

    ```sh
    bun install --frozen-lockfile --ignore-scripts &&
      bun scripts/src/ts/check-library-root.ts
    ```

  - Supplies Meta-Cortex instructions, roles, skills, and configuration.
- **Project root**
  - The consuming repository that owns the user's development task.
  - Identify it from the host workspace and the project's instructions.

Apply the consuming project's context throughout the task:

- Read its `AGENTS.md` and applicable directory instructions, requirements,
  and architecture before planning.
- Resolve Markdown links relative to the document containing them.
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

**Preferred:** identify the consuming repository as the project root and the
installed framework as the library root. Read the project's instructions, run
its tests in its worktree, and pass both roots in assignments.

## Prohibited actions

- Do not assume the project root is the library root or its immediate parent.
- Do not change the Meta-Cortex library unless the task concerns its rules,
  skills, roles, or configuration.

**Prohibited:** edit the installed framework to fix an unrelated application
endpoint in the consuming project.

**Preferred:** change the application's owning code in its project worktree.
Change the framework only when the task concerns its own rules, skills, roles,
or configuration.

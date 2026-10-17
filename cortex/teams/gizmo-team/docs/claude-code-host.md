# Claude Code host integration

Load only for active Claude Code mechanics. Shared
[agent configuration](agent-configuration.md) owns selection, capacity, and evidence;
[User Input](../agents/gizmo-prime/skills/user-input/SKILL.md) owns validation.
Official sources checked 2026-10-16; no live Claude launch was tested.

## Delegation and context

Nested subagents default to three layers below main;
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` changes that depth. Check the installed
version and effective environment before relying on this default.
[Environment reference](https://code.claude.com/docs/en/env-vars)
describes the setting and earlier defaults.

Non-forks start fresh; forks inherit conversation, model, and tools but cannot
spawn forks. In non-interactive sessions, background children outliving their
launcher report to main. Preserve coordinator reporting; otherwise report the blocker.
[Subagent guidance](https://code.claude.com/docs/en/sub-agents)
owns those distinctions. Native [agent teams](https://code.claude.com/docs/en/agent-teams#limitations)
allow no nested teams; they do not implement Cortex's hierarchy by themselves.

- **Prohibited:** assign Prime a fork and assume it can launch worker forks.

- **Required:** choose an eligible Prime subagent with actual `Agent` access so
  it can launch specialists directly within the effective depth and shared capacity ceiling.

## Assignment settings

For non-forks, an invocation's model normally precedes the definition, then
`CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. Since v2.1.292, invocation
`effort` can override definition effort; `CLAUDE_CODE_EFFORT_LEVEL` overrides both.
[`/tasks`](https://code.claude.com/docs/en/sub-agents#choose-a-model)
can show the running subagent's model and configured effort.

`CLAUDE_CODE_SUBAGENT_MODEL_FORCE` can enforce a model despite the normal order.
Inspect these [environment overrides](https://code.claude.com/docs/en/env-vars)
before relying on requested settings.

- **Prohibited:** claim an invocation overrode an enforced model or effort.

- **Required:** inspect effective overrides and available execution evidence;
  report requested settings separately from confirmed settings.

## Question availability

Non-fork subagents lack `AskUserQuestion` under the documented
[tool filters](https://code.claude.com/docs/en/sub-agents#available-tools).
Inspect the actual tool pool before mapping a question; use the shared User
Input handoff to the host when no permitted user channel exists.

- **Prohibited:** assume adding `AskUserQuestion` to a non-fork definition grants it.

- **Required:** route the pending field and retained state to the assigning
  coordinator when the tool is unavailable.

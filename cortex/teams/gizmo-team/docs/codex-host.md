# Codex host integration

Load only for the active Codex host. Shared
[agent configuration](agent-configuration.md) owns selection, capacity, and evidence;
[User Input](../agents/gizmo-prime/skills/user-input/SKILL.md) owns collection and validation.
Official sources checked 2026-10-16; tool schemas and runtime capabilities vary
by client. These mappings do not establish live model or tier confirmation.

## Settings and capacity

Codex resolves model and effort from explicit spawn values, then `[agents]`
defaults, then the parent. Selecting a model without effort uses that model's
default effort. A custom agent file can override the resolved settings; setting
only its model preserves the already-resolved effort. Inspect effective agent
configuration before treating a requested combination as applied.
[Official subagent guidance](https://learn.chatgpt.com/docs/agent-configuration/subagents#custom-agents)
describes these precedence rules.

`agents.max_concurrent_threads_per_session` counts spawned threads, excluding the
primary; `agents.enabled` controls delegation. Include the primary when comparing
that limit with Cortex's total ceiling.
[Configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
owns the current keys. Codex configuration is TOML: an authorized edit uses a
maintained document editor/parser, preserves unrelated content, and is reparsed.
Do not use regex replacement or duplicate tables.

## Exposed tool mappings

Use the active execution tool's parameter schema. If it exposes `model` and
`reasoning_effort`, use its supported values. Where its contract says
`fork_turns="all"` inherits settings and rejects overrides, use
`fork_turns="none"` with complete assignment context for explicit controls.
This conditional example is not a universal Codex CLI interface.

For an exposed question tool, map the helper's neutral fields to that tool's
actual arguments and retain `prompt.name` with its reply identifier.
`request_user_input` and `request_user_input_async` may expose different schemas
and availability restrictions; inspect the tool rather than copying its name.

# Codex host integration

Load this reference only when using Codex-specific mechanics. The
[user-input skill](../agents/gizmo/skills/user-input/SKILL.md) owns answer
collection and validation; [agent configuration](agent-configuration.md) owns
capacity and execution policy. The installed host's tool contract takes
precedence over the examples here.

## Map a question to Codex

For an available `request_user_input_async` tool with `questions`, `title`, and
`options` arguments, map the helper's `prompt.question` to the question title.
For a choice, copy `prompt.options`; for text or integer input, omit options.
Retain `prompt.name` locally and bind the returned call/question identifier to
that field. It is not an extra tool argument. Match replies by that identifier,
then submit the value to the helper with the bound name and retained state.

Other tools, including `request_user_input`, can have different schemas and
mode restrictions. Read the actual tool contract. Use the common skill's
conversation path when native input is unavailable or unsuitable and the host
permits asking in chat. Do not open a second question while the first is pending.

Where ending a turn dismisses an asynchronous question, keep the turn active
with interruptible waits of at most 50 seconds. Process replies between waits.
A timeout is not an answer or cancellation. End only after the native request
has resolved or is known to be closed; preserve its validated state.

- **Prohibited:** send the whole neutral `prompt` object as Codex tool arguments,
  or submit a preselected choice as the user's answer.

- **Required:** map the question to the exposed tool schema, retain its field
  binding, and validate the actual reply through the shared helper.

## Inspect or change capacity settings

The current [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
defines `agents.max_concurrent_threads_per_session` as the concurrent spawned
thread limit, excluding the primary thread, and `agents.enabled` as multi-agent
enablement. Verify support in the installed version and resolve effective
configuration layers and profiles before proposing an edit. The saved setting
does not establish the running session's limit.

For a necessary approved change, convert the desired total to spawned capacity
by excluding the primary thread. Include coordinators among spawned threads.
Do not automatically set this to the framework ceiling. Include any enablement
change in the concrete approval proposal. Preserve a sufficient saved limit;
if it differs from active metadata, investigate activation requirements instead
of repeatedly rewriting it.

Codex configuration is TOML. Use a maintained TOML parser and document editor,
preserving unrelated values and comments. Do not edit it with regular
expressions, string replacement, or a duplicate table. If a suitable editor is
unavailable, report that limitation. Reparse an approved edit and follow the
installed host's restart requirements. Recheck active capacity on resumption.

- **Prohibited:** set spawned capacity to twenty because Cortex permits twenty
  total agents, or silently enable agents while changing the limit.

- **Required:** include the primary agent correctly, propose only the needed
  settings, and follow the common approval and active-capability checks.

## Launch with supported settings and context

Read the current model catalog and parameter schema from the available agent
tool. Where it accepts `model` and `reasoning_effort`, pass the selected exact
identifiers there. Some Codex tools inherit settings with `fork_turns="all"`
and reject overrides in that mode. In that case, use `fork_turns="none"` with
the complete [assignment context](../../AGENTS.md#assignment-context), or another
supported combination. The framework does not keep a second model catalog.

Use the host's documented speed inheritance and runtime metadata. An advertised
service tier such as `priority` describes support; it does not establish the
user's current selection or prove that a child inherited it. Keep requested
settings separate from confirmed execution settings.

- **Prohibited:** pass explicit overrides with a context fork that rejects them,
  or report a tier as verified from the advertised catalog alone.

- **Required:** use a supported launch combination and report what the host
  actually confirms, including unavailable runtime metadata.
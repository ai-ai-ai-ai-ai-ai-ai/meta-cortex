<script lang="ts">
  import type { AgentSelection } from "./agent-tree";
  import type { Task } from "./contracts";
  import { TaskPresentation } from "./task-presentation";
  import { FlowPresentation } from "./workflow";
  import ProgressSummary from "./ProgressSummary.svelte";
  let {
    selection,
    close,
    openTask,
    openHistory,
  }: {
    selection: AgentSelection;
    close: () => void;
    openTask: (task: Task) => void;
    openHistory: (task: Task) => void;
  } = $props();
  let task = $derived(selection.task.task);
  let presentation = $derived(new TaskPresentation(task));
  function focusClose(element: HTMLButtonElement) {
    element.focus();
  }
</script>

<aside class="agent-inspector" aria-label={`${selection.group.name()} details`}>
  <header>
    <div>
      <span class="eyebrow">AGENT DETAILS</span>
      <h2>{selection.group.name()}</h2>
    </div>
    <button
      class="icon-button"
      aria-label="Close agent details"
      onclick={close}
      use:focusClose>×</button
    >
  </header>
  <div class="inspector-content">
    <div class="inspector-state">
      <span class="status" data-state={presentation.status()}
        >{presentation.status()}</span
      ><span>Attempt {task.attempt} · {selection.group.summary()}</span>
    </div>
    <ProgressSummary counts={selection.group.counts()} />
    <h3>{task.objective}</h3>
    <p class="inspector-summary">
      {task.progress.summary || "No progress summary recorded."}
    </p>
    {#if presentation.reason()}<p class="block-reason">
        {presentation.reason()}
      </p>{/if}
    <section>
      <h4>Recorded tasks <span>{selection.group.tasks.length}</span></h4>
      <div class="inspector-tasks">
        {#each selection.group.tasks as item (item.task.id)}<button
            class:current={item.task.id === task.id}
            onclick={() => openTask(item.task)}
            ><span
              class="state-mark small"
              data-state={new TaskPresentation(item.task).status()}
              aria-hidden="true"
            ></span><span>{item.task.id}</span><small
              >{new TaskPresentation(item.task).status()}</small
            ></button
          >{/each}
      </div>
    </section>
    {#if task.progress.checks.length > 0}<section>
        <h4>Recorded checks</h4>
        {#each task.progress.checks as check, index (index)}<details
            class="inspector-check"
          >
            <summary
              ><span
                class="state-mark small"
                data-state={check.outcome}
                aria-hidden="true"
              ></span><code>{check.command}</code><span class="check-outcome"
                >{check.outcome}</span
              ></summary
            >
            <pre>{check.evidence}</pre>
          </details>{/each}
      </section>{/if}
    <section>
      <h4>Git evidence</h4>
      <dl>
        <dt>Branch</dt>
        <dd>
          {#if task.workspace.kind === "git"}<code>{task.workspace.branch}</code
            >{:else}Read only{/if}
        </dd>
        <dt>Checkpoint</dt>
        <dd>
          <code title={presentation.checkpoint()}
            >{presentation.checkpoint().slice(0, 12)}</code
          >
        </dd>
        <dt>Integration</dt>
        <dd>
          <code title={presentation.integration()}
            >{presentation.integration().slice(0, 12)}</code
          >
        </dd>
      </dl>
      {#each [...selection.task.checkpoints, ...selection.task.integrations] as commit (`${commit.revision}:${commit.commit}`)}<div
          class="commit-evidence"
        >
          <code>{commit.commit.slice(0, 8)}</code><span
            >{commit.actor.role}</span
          ><time>{new Date(commit.at).toLocaleDateString()}</time>
        </div>{/each}
    </section>
    {#if task.progress.findings.length > 0}<details class="inspector-notes">
        <summary>Findings · {task.progress.findings.length}</summary
        >{#each task.progress.findings as finding, index (index)}<p>
            {finding}
          </p>{/each}
      </details>{/if}
    {#if task.progress.next_steps.length > 0}<details class="inspector-notes">
        <summary>Next steps · {task.progress.next_steps.length}</summary
        >{#each task.progress.next_steps as step, index (index)}<p>
            {step}
          </p>{/each}
      </details>{/if}
    <section>
      <h4>Recent history</h4>
      {#each selection.task.milestones.slice(0, 5) as event (event.revision)}<div
          class="inspector-event"
        >
          <span>{FlowPresentation.action(event)}</span><small
            >{event.actor.role}</small
          ><time
            >{new Date(event.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}</time
          >
        </div>{/each}{#if selection.task.history_end === "More"}<p
          class="muted"
        >
          Older events are available in full history.
        </p>{/if}
    </section>
    <div class="inspector-actions">
      <button class="button" onclick={() => openHistory(task)}
        >↶ Open full history</button
      ><button class="text-button" onclick={() => openTask(task)}
        >View full task record →</button
      >
    </div>
    <details class="inspector-notes recorded-snapshot">
      <summary>All recorded fields</summary>
      <pre>{JSON.stringify(task, null, 2)}</pre>
    </details>
  </div>
</aside>

<script lang="ts">
  import { AgentContribution, TreeExpansion, PanelKind } from "./agent-tree";
  import type { AgentSelection, AgentPanel } from "./agent-tree";
  import { TaskPresentation } from "./task-presentation";
  let {
    group,
    identity,
    select,
    panel,
  }: {
    group: AgentContribution;
    identity: string;
    select: (selection: AgentSelection) => void;
    panel: AgentPanel;
  } = $props();
  let expansion = $state(new TreeExpansion());
  function toggle() {
    expansion = expansion.toggle();
  }
</script>

<li class="tree-agent" data-state={group.status()}>
  <div class="agent-row">
    <button
      class="disclosure"
      aria-label={`Expand ${group.name()} tasks`}
      aria-expanded={expansion.ariaExpanded()}
      onclick={toggle}><span aria-hidden="true">›</span></button
    >
    <button
      class="agent-select"
      class:selected={panel.kind === PanelKind.Agent &&
        panel.origin.startsWith(identity)}
      id={identity}
      onclick={() => select({ group, task: group.latest(), origin: identity })}
    >
      <span class="state-mark" data-state={group.status()} aria-hidden="true"
      ></span>
      <div class="agent-title">
        <strong
          >{group.name()}{#if group.tasks.length > 1}<small
              >{group.tasks.length} tasks</small
            >{/if}</strong
        ><span title={group.latest().task.objective}
          >{group.latest().task.objective}</span
        >
      </div>
      <span class="status" data-state={group.status()}>{group.status()}</span>
      {#if group.checkpoint() !== "Unrecorded"}<code
          class="row-commit"
          title={group.checkpoint()}>{group.checkpoint().slice(0, 7)}</code
        >{:else}<span class="row-commit muted">—</span>{/if}
    </button>
  </div>
  {#if expansion.ariaExpanded()}
    <ul class="task-children">
      {#each group.tasks as item (item.task.id)}<li>
          <button
            id={`${identity}:${item.task.id}`}
            onclick={() =>
              select({
                group,
                task: item,
                origin: `${identity}:${item.task.id}`,
              })}
            ><span
              class="state-mark small"
              data-state={new TaskPresentation(item.task).status()}
              aria-hidden="true"
            ></span>
            <div>
              <strong title={`${item.task.id} · ${item.task.objective}`}
                >{item.task.objective}</strong
              >
            </div>
            <span
              class="status"
              data-state={new TaskPresentation(item.task).status()}
              >{new TaskPresentation(item.task).childStatus()}</span
            ></button
          >
        </li>{/each}
    </ul>
  {/if}
</li>

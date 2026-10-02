<script lang="ts">
  import type { TaskFlow } from "./contracts";
  import { AgentTree } from "./agent-tree";
  import type { AgentSelection, AgentPanel } from "./agent-tree";
  import TreeDelegation from "./TreeDelegation.svelte";
  let {
    tasks,
    select,
    panel,
  }: {
    tasks: ReadonlyArray<TaskFlow>;
    select: (selection: AgentSelection) => void;
    panel: AgentPanel;
  } = $props();
  let tree = $derived(new AgentTree(tasks));
</script>

<section class="execution-tree" aria-label="Agent execution tree">
  {#each tree.groups() as delegation (delegation.name())}
    <TreeDelegation {delegation} {select} {panel} />
  {/each}
  {#if tasks.length === 0}<div class="empty-state">
      <h2>No tasks on this page</h2>
      <p>Tasks will appear here after they are recorded in Turso.</p>
    </div>{/if}
</section>

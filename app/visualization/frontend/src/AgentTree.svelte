<script lang="ts">
  import * as Card from "$lib/components/ui/card";
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

<Card.Root
  class="execution-tree @container gap-0 overflow-hidden rounded-[7px] border border-border bg-tree py-0 shadow-none"
  role="region"
  aria-label="Agent execution tree"
>
  {#each tree.groups() as delegation (delegation.name())}
    <TreeDelegation {delegation} {select} {panel} />
  {/each}
  {#if tasks.length === 0}<div
      class="empty-state px-6 py-[60px] text-center [&_h2]:text-xl [&_p]:my-[15px] [&_p]:text-xs [&_p]:text-muted-foreground"
    >
      <h2>No tasks on this page</h2>
      <p>Tasks will appear here after they are recorded in Turso.</p>
    </div>{/if}
</Card.Root>

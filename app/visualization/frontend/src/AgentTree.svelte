<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import type { TaskFlow } from "./contracts";
  import { AgentTree } from "./agent-tree";
  import type { AgentSelection, AgentPanel } from "./agent-tree";
  import TreeDelegation from "./TreeDelegation.svelte";
  import ReportingBranch from "./ReportingBranch.svelte";
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
  class="execution-tree @container gap-0 overflow-hidden rounded-[7px] border border-border bg-tree bg-linear-[140deg] from-tree to-sidebar py-0 shadow-none ring-0"
  role="region"
  aria-label="Agent execution tree"
>
  {#if tasks.length > 0}
    <p
      class="border-b border-border px-4 py-3 text-[10px] leading-relaxed text-muted-foreground"
    >
      Recorded reporting relationships and activity on this loaded page.
      Descendant progress excludes each coordinator’s own activities.
    </p>
    <ul class="m-0 list-none p-0">
      {#each tree.groups() as node (node.id().serialize())}
        <ReportingBranch {node} {select} {panel} />
      {/each}
    </ul>
    {#if tree.historical().length > 0}
      <h3 class="border-y border-border px-4 py-3 text-xs font-semibold">
        Historical · reporting unrecorded
      </h3>
      {#each tree.historical() as delegation (delegation.name())}
        <TreeDelegation {delegation} {select} {panel} />
      {/each}
    {/if}
  {/if}
  {#if tasks.length === 0}<div
      class="empty-state px-6 py-[60px] text-center [&_h2]:text-xl [&_p]:my-[15px] [&_p]:text-xs [&_p]:text-muted-foreground"
    >
      <h2 class="font-bold">No tasks on this page</h2>
      <p>Tasks will appear here after they are recorded in Turso.</p>
    </div>{/if}
</Card.Root>

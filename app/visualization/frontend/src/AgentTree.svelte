<script lang="ts">
  import type { TaskFlow } from "./contracts";
  import { ReportingHierarchy } from "./agent-tree";
  import type { TaskSelection } from "./agent-tree";
  import ReportingBranch from "./ReportingBranch.svelte";
  import TreeAgent from "./TreeAgent.svelte";
  interface AgentTreeProperties {
    tasks: ReadonlyArray<TaskFlow>;
    select: (selection: TaskSelection) => void;
  }
  let { tasks, select }: AgentTreeProperties = $props();
  let tree = $derived(new ReportingHierarchy(tasks));
</script>

<section aria-label="Recorded reporting hierarchy" class="space-y-4">
  <p class="text-sm text-muted-foreground">
    Reporting and activity on this loaded page. Descendant counts exclude each
    coordinator’s own activities.
  </p>
  {#each tree.roots() as node (node.id())}<ReportingBranch
      {node}
      {select}
    />{/each}
  {#if tree.historical().length > 0}
    <h3 class="font-semibold">Historical · reporting unrecorded</h3>
    {#each tree.historical() as delegation (delegation.name())}
      <p>Created by · {delegation.name()}</p>
      {#each Array.from(delegation.workers.values()) as group (group.name())}<TreeAgent
          {group}
          {select}
        />{/each}
    {/each}
  {/if}
  {#if tasks.length === 0}<p>No tasks on this page.</p>{/if}
</section>

<script lang="ts">
  import type { TaskFlow } from "./contracts";
  import { AgentTree } from "./agent-tree";
  import type { AgentSelection, AgentPanel } from "./agent-tree";
  import TreeAgent from "./TreeAgent.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
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
    <details class="delegation" open>
      <summary
        ><svg
          class="team-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          ><circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path
            d="M2 20v-3c0-3 3-5 7-5s7 2 7 5v3zm15 0v-3c0-1.6-.6-3.1-1.7-4.2 4.2-.5 7.7 1.2 7.7 4.2v3z"
          /></svg
        >
        <div>
          <strong>{delegation.name()}</strong><span
            >{delegation.tasks().length} recorded tasks · task creator</span
          >
        </div>
        <ProgressSummary counts={delegation.counts()} /></summary
      >
      <ul class="agent-children">
        {#each Array.from(delegation.workers.values()) as group (group.name())}<TreeAgent
            {group}
            identity={`agent:${delegation.name()}:${group.name()}`}
            {select}
            {panel}
          />{/each}
      </ul>
    </details>
  {/each}
  {#if tasks.length === 0}<div class="empty-state">
      <h2>No tasks on this page</h2>
      <p>Tasks will appear here after they are recorded in Turso.</p>
    </div>{/if}
</section>

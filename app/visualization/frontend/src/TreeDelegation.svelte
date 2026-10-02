<script lang="ts">
  import { TreeExpansion } from "./agent-tree";
  import type { Delegation, AgentSelection, AgentPanel } from "./agent-tree";
  import TreeAgent from "./TreeAgent.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  let {
    delegation,
    select,
    panel,
  }: {
    delegation: Delegation;
    select: (selection: AgentSelection) => void;
    panel: AgentPanel;
  } = $props();
  let expansion = $state(new TreeExpansion().toggle());
  let identity = $derived(
    `delegation:${encodeURIComponent(delegation.name())}`,
  );
  function toggle() {
    expansion = expansion.toggle();
  }
</script>

<section class="delegation" aria-label={delegation.name()}>
  <div class="delegation-header">
    <button
      class="delegation-toggle"
      aria-label={delegation.name()}
      aria-expanded={expansion.ariaExpanded()}
      aria-controls={identity}
      onclick={toggle}
    >
      <svg
        class="team-icon"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" />
        <path
          d="M2 20v-3c0-3 3-5 7-5s7 2 7 5v3zm15 0v-3c0-1.6-.6-3.1-1.7-4.2 4.2-.5 7.7 1.2 7.7 4.2v3z"
        />
      </svg>
      <span class="team-title">
        <strong>{delegation.name()}</strong>
        <span>{delegation.tasks().length} recorded tasks · task creator</span>
      </span>
    </button>
    <ProgressSummary counts={delegation.counts()} />
  </div>
  <ul class="agent-children" id={identity} hidden={!expansion.ariaExpanded()}>
    {#each Array.from(delegation.workers.values()) as group (group.name())}
      <TreeAgent
        {group}
        identity={`agent:${delegation.name()}:${group.name()}`}
        {select}
        {panel}
      />
    {/each}
  </ul>
</section>

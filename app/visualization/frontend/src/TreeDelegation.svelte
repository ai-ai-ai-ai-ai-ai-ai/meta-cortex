<script lang="ts">
  import { Button } from "$lib/components/ui/button";
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

<section
  class="delegation border-b border-border last:border-b-0"
  aria-label={delegation.name()}
>
  <div
    class="delegation-header grid min-h-[67px] grid-cols-[minmax(0,1fr)] items-center gap-x-[15px] gap-y-3 bg-delegation px-4 py-[13px] @min-[620px]:grid-cols-[minmax(0,1fr)_245px]"
  >
    <Button
      variant="ghost"
      class="delegation-toggle group h-auto whitespace-normal aria-expanded:bg-transparent aria-expanded:text-foreground min-h-10 min-w-0 justify-start gap-[15px] bg-transparent p-0 text-left hover:bg-transparent"
      aria-label={delegation.name()}
      aria-expanded={expansion.ariaExpanded()}
      aria-controls={identity}
      onclick={toggle}
    >
      <span
        aria-hidden="true"
        class="w-2.5 shrink-0 text-[19px] text-muted-foreground before:content-['⌄'] group-aria-[expanded=false]:before:content-['›']"
      ></span>
      <svg
        class="team-icon size-[23px] shrink-0 text-team"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" />
        <path
          d="M2 20v-3c0-3 3-5 7-5s7 2 7 5v3zm15 0v-3c0-1.6-.6-3.1-1.7-4.2 4.2-.5 7.7 1.2 7.7 4.2v3z"
        />
      </svg>
      <span
        class="team-title min-w-0 [&_strong]:block [&_strong]:text-[15px] [&_strong]:font-semibold [&_span]:mt-[5px] [&_span]:block [&_span]:text-[11px] [&_span]:text-muted-foreground"
      >
        <strong>{delegation.name()}</strong>
        <span>{delegation.tasks().length} recorded tasks · task creator</span>
      </span>
    </Button>
    <ProgressSummary
      counts={delegation.counts()}
      class="ml-[25px] w-auto @min-[620px]:ml-auto @min-[620px]:w-[245px]"
    />
  </div>
  <ul
    class="agent-children m-0 list-none pl-5 max-[800px]:pl-[18px]"
    id={identity}
    hidden={!expansion.ariaExpanded()}
  >
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

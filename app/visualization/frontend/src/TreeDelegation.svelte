<script lang="ts">
  import * as Collapsible from "$lib/components/ui/collapsible";
  import type { Option } from "effect";
  import type { Delegation, AgentSelection } from "./agent-tree";
  import TreeAgent from "./TreeAgent.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  interface TreeDelegationProperties {
    delegation: Delegation;
    select: (selection: AgentSelection) => void;
    selection: Option.Option<AgentSelection>;
  }
  let { delegation, select, selection }: TreeDelegationProperties = $props();
  let identity = $derived(
    `delegation:${encodeURIComponent(delegation.name())}`,
  );
</script>

<Collapsible.Root open>
  {#snippet child({ props })}
    <section
      {...props}
      class="delegation border-b border-border last:border-b-0"
      aria-label={delegation.name()}
    >
      <div
        class="delegation-header grid min-h-[67px] grid-cols-[minmax(0,1fr)] items-center gap-x-[15px] gap-y-3 bg-delegation px-4 py-[13px] @min-[620px]:grid-cols-[minmax(0,1fr)_245px]"
      >
        <Collapsible.Trigger
          class="delegation-toggle group flex items-center h-auto whitespace-normal data-[state=open]:bg-transparent data-[state=open]:text-foreground min-h-10 min-w-0 justify-start gap-[15px] bg-transparent p-0 text-left hover:bg-transparent"
          aria-label={delegation.name()}
        >
          <span
            aria-hidden="true"
            class="w-2.5 shrink-0 text-[19px] text-muted-foreground before:content-['⌄'] group-data-[state=closed]:before:content-['›']"
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
            <span
              >Created by · {delegation.tasks().length} recorded activities · reporting
              unrecorded</span
            >
          </span>
        </Collapsible.Trigger>
        <ProgressSummary
          counts={delegation.counts()}
          class="ml-[25px] w-auto @min-[620px]:ml-auto @min-[620px]:w-[245px]"
        />
      </div>
      <Collapsible.Content hiddenUntilFound={false}>
        <ul
          class="agent-children m-0 list-none pl-5 max-[800px]:pl-[18px]"
          id={identity}
        >
          {#each Array.from(delegation.workers.values()) as group (group.name())}
            <TreeAgent
              {group}
              identity={`agent:${delegation.name()}:${group.name()}`}
              {select}
              {selection}
            />
          {/each}
        </ul>
      </Collapsible.Content>
    </section>
  {/snippet}
</Collapsible.Root>

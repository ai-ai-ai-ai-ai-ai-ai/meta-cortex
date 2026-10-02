<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ActivityKind, TreeExpansion } from "./agent-tree";
  import type { ReportingNode, AgentSelection, AgentPanel } from "./agent-tree";
  import TreeAgent from "./TreeAgent.svelte";
  import ReportingBranch from "./ReportingBranch.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  let {
    node,
    select,
    panel,
  }: {
    node: ReportingNode;
    select: (selection: AgentSelection) => void;
    panel: AgentPanel;
  } = $props();
  let expansion = $state(new TreeExpansion().toggle());
  let identity = $derived(`reporting:${node.id()}`);
  function toggle() {
    expansion = expansion.toggle();
  }
</script>

{#if node.children.length === 0 && node.activity.kind === ActivityKind.Recorded}
  <TreeAgent group={node.activity.group} {identity} {select} {panel} />
{:else}
  <li class="border-b border-border last:border-b-0">
    <div
      class="grid min-h-[67px] grid-cols-[minmax(0,1fr)] items-center gap-x-[15px] gap-y-3 bg-delegation px-4 py-[13px] @min-[620px]:grid-cols-[minmax(0,1fr)_245px]"
    >
      <Button
        variant="ghost"
        class="group h-auto min-h-10 min-w-0 justify-start gap-[15px] whitespace-normal bg-transparent p-0 text-left hover:bg-transparent aria-expanded:bg-transparent aria-expanded:text-foreground"
        aria-label={node.name()}
        aria-expanded={expansion.ariaExpanded()}
        aria-controls={identity}
        onclick={toggle}
      >
        <span
          aria-hidden="true"
          class="w-2.5 shrink-0 text-[19px] text-muted-foreground before:content-['⌄'] group-aria-[expanded=false]:before:content-['›']"
        ></span>
        <svg
          class="size-[23px] shrink-0 text-team"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path
            d="M2 20v-3c0-3 3-5 7-5s7 2 7 5v3zm15 0v-3c0-1.6-.6-3.1-1.7-4.2 4.2-.5 7.7 1.2 7.7 4.2v3z"
          />
        </svg>
        <span
          class="min-w-0 [&_strong]:block [&_strong]:text-[15px] [&_strong]:font-semibold [&_span]:mt-[5px] [&_span]:block [&_span]:text-[11px] [&_span]:text-muted-foreground"
        >
          <strong>{node.name()}</strong>
          {#if node.activity.kind === ActivityKind.Recorded}<span
              >{node.activity.group.tasks.length} own activities · loaded page</span
            >
          {:else}<span>No activity on this page</span>{/if}
        </span>
      </Button>
      {#if node.activity.kind === ActivityKind.Recorded && node.children.length > 0}
        <div class="ml-[25px] @min-[620px]:ml-auto @min-[620px]:w-[245px]">
          <p class="mb-1.5 text-[9px] text-muted-foreground">
            Descendant activities · loaded page
          </p>
          <ProgressSummary counts={node.descendantCounts()} class="w-full" />
        </div>
      {/if}
    </div>
    <div id={identity} hidden={!expansion.ariaExpanded()}>
      {#if node.activity.kind === ActivityKind.Recorded}
        <p class="px-5 pt-2 text-[9px] text-muted-foreground">Own activities</p>
        <ul class="m-0 list-none pl-5 max-[800px]:pl-[18px]">
          <TreeAgent
            group={node.activity.group}
            identity={`${identity}:own`}
            {select}
            {panel}
          />
        </ul>
      {/if}
      <ul
        class="m-0 list-none border-l border-tree-line pl-5 max-[800px]:pl-[18px]"
      >
        {#each node.children as child (child.id())}
          <ReportingBranch node={child} {select} {panel} />
        {/each}
      </ul>
    </div>
  </li>
{/if}

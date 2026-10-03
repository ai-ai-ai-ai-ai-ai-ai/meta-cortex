<script lang="ts">
  import * as Collapsible from "$lib/components/ui/collapsible";
  import { Button } from "$lib/components/ui/button";
  import {
    ActivityKind,
    SelectionKind,
    type ReportingNode,
    type TaskSelection,
  } from "./agent-tree";
  import ReportingBranch from "./ReportingBranch.svelte";
  import TreeAgent from "./TreeAgent.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  interface ReportingBranchProperties {
    node: ReportingNode;
    select: (selection: TaskSelection) => void;
  }
  let { node, select }: ReportingBranchProperties = $props();
</script>

<Collapsible.Root open class="space-y-2">
  <div class="flex flex-wrap items-center gap-2">
    <Collapsible.Trigger>
      {#snippet child({ props })}<Button variant="outline" {...props}
          >{node.name()}</Button
        >{/snippet}
    </Collapsible.Trigger>
    {#if node.activity.kind === ActivityKind.Recorded}
      {@const group = node.activity.group}
      <Button
        variant="ghost"
        onclick={() =>
          select({ kind: SelectionKind.Activity, task: group.latest() })}
        >{group.summary()} · own activities</Button
      >
    {:else}<span class="text-sm text-muted-foreground"
        >No activity on this page</span
      >{/if}
  </div>
  <Collapsible.Content class="space-y-4 border-l pl-4">
    {#if node.activity.kind === ActivityKind.Recorded}<TreeAgent
        group={node.activity.group}
        {select}
      />{/if}
    {#if node.children.length > 0}
      <p class="text-sm text-muted-foreground">
        Descendant activities · loaded page
      </p>
      <ProgressSummary counts={node.descendantCounts()} />
      {#each node.children as child (child.id())}<ReportingBranch
          node={child}
          {select}
        />{/each}
    {/if}
  </Collapsible.Content>
</Collapsible.Root>

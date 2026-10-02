<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Handle, Position } from "@xyflow/svelte";
  import type { NodeProps } from "@xyflow/svelte";
  import type { DiagramNode } from "./workflow";
  import { ActivityKind } from "./agent-tree";
  let { data }: NodeProps<DiagramNode> = $props();
</script>

<Card.Root
  class="workflow-node overflow-visible block w-[230px] min-h-28 rounded-[7px] border border-node-border bg-node px-4 py-3 shadow-none ring-0 data-[state=integrated]:border-primary/60 data-[state=working]:border-working/60 data-[state=blocked]:border-blocked/70 data-[state=ready]:border-ready/70 [&_strong]:my-[7px] [&_strong]:block [&_strong]:text-xs [&_strong]:[overflow-wrap:anywhere] [&_p]:text-[10px] [&_p]:leading-normal [&_p]:text-muted-foreground [&_p]:[overflow-wrap:anywhere]"
  data-state={data.state}
>
  <Handle type="target" position={Position.Top} />
  <span class="node-kind text-[9px] tracking-[1px] text-primary uppercase"
    >{data.kind}</span
  >
  <strong>{data.title}</strong>
  <p>{data.subtitle}</p>
  {#if data.activity === ActivityKind.Absent}
    <p class="mt-2.5">No activity on this page</p>
  {:else}
    <div
      class="node-footer mt-2.5 flex justify-between text-[9px] text-muted-foreground"
    >
      <span>{data.state}</span><span>{data.tasks.length} tasks</span>
    </div>
  {/if}
  <Handle type="source" position={Position.Bottom} />
</Card.Root>

<script lang="ts">
  import { Progress } from "$lib/components/ui/progress";
  import { cn } from "$lib/utils";
  import type { FlowCount, FlowState } from "./contracts";
  interface ProgressSummaryProperties {
    counts: ReadonlyArray<FlowCount>;
    class?: string;
  }
  let { counts, class: className = "" }: ProgressSummaryProperties = $props();
  const order: FlowState[] = [
    "integrated",
    "completed",
    "working",
    "blocked",
    "ready",
    "queued",
    "cancelled",
  ];
  let total = $derived(counts.reduce((sum, item) => sum + item.count, 0));
  let finished = $derived(
    counts
      .filter(
        (item) => item.state === "integrated" || item.state === "completed",
      )
      .reduce((sum, item) => sum + item.count, 0),
  );
  let visible = $derived(
    order.flatMap((state) =>
      counts.filter((item) => item.state === state && item.count > 0),
    ),
  );
  let percent = $derived(Math.round((finished / Math.max(1, total)) * 100));
</script>

<div
  class={cn(
    "progress-overview min-w-0 w-[270px] max-w-full shrink-0",
    className,
  )}
>
  <div
    class="progress-states flex flex-wrap gap-x-[5px] gap-y-1 text-[11px] leading-[1.4] text-progress [&>span:not(:last-child)]:after:text-muted-foreground [&>span:not(:last-child)]:after:content-['·'] [&>span:not(:last-child)]:after:ml-1"
  >
    {#each visible as item (item.state)}<span data-state={item.state}
        >{item.count} {item.state}</span
      >{/each}
  </div>
  <div
    class="progress-meter mt-[7px] flex items-center gap-2.5 [&>span]:min-w-7 [&>span]:text-right [&>span]:text-[11px] [&>span]:text-progress"
  >
    <Progress
      class="h-1.5 flex-1 rounded-[3px] bg-meter [&>[data-slot=progress-indicator]]:rounded-[3px]"
      aria-label="Finished tasks"
      value={finished}
      max={Math.max(1, total)}
    />
    <span title={`${finished} / ${total} integrated or completed`}
      >{percent}%</span
    >
  </div>
</div>

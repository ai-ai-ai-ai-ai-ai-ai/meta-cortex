<script lang="ts">
  import { Progress } from "$lib/components/ui/progress";
  import { cn } from "$lib/utils";
  import type { FlowCount } from "./contracts";
  import { ProgressPresentation } from "./progress-presentation";
  let {
    counts,
    class: className = "",
  }: { counts: ReadonlyArray<FlowCount>; class?: string } = $props();
  let progress = $derived(new ProgressPresentation(counts));
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
    {#each progress.visible() as item (item.state)}<span data-state={item.state}
        >{item.count} {item.state}</span
      >{/each}
  </div>
  <div
    class="progress-meter mt-[7px] flex items-center gap-2.5 [&>span]:min-w-7 [&>span]:text-right [&>span]:text-[11px] [&>span]:text-progress"
  >
    <Progress
      class="h-1.5 flex-1 rounded-[3px] bg-meter [&>[data-slot=progress-indicator]]:rounded-[3px]"
      aria-label="Integrated tasks"
      value={progress.integrated()}
      max={Math.max(1, progress.total())}
    />
    <span title={`${progress.integrated()} / ${progress.total()} integrated`}
      >{progress.percent()}%</span
    >
  </div>
</div>

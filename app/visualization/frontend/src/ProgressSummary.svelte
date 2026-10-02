<script lang="ts">
  import type { FlowCount } from "./contracts";
  import { ProgressPresentation } from "./progress-presentation";
  let { counts }: { counts: ReadonlyArray<FlowCount> } = $props();
  let progress = $derived(new ProgressPresentation(counts));
</script>

<div class="progress-overview">
  <div class="progress-states">
    {#each progress.visible() as item (item.state)}<span data-state={item.state}
        >{item.count} {item.state}</span
      >{/each}
  </div>
  <div class="progress-meter">
    <progress
      aria-label="Integrated tasks"
      value={progress.integrated()}
      max={Math.max(1, progress.total())}
    ></progress>
    <span title={`${progress.integrated()} / ${progress.total()} integrated`}
      >{progress.percent()}%</span
    >
  </div>
</div>

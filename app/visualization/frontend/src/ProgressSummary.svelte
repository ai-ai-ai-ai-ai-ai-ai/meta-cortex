<script lang="ts">
  import { Progress } from "$lib/components/ui/progress";
  import type { FlowCount } from "./contracts";
  import { summarizeCounts } from "./progress-presentation";
  interface ProgressSummaryProperties {
    counts: ReadonlyArray<FlowCount>;
  }
  let { counts }: ProgressSummaryProperties = $props();
  let progress = $derived(summarizeCounts(counts));
</script>

<div class="space-y-2 text-sm">
  <p>{progress.finished} finished / {progress.total} activities</p>
  <Progress
    value={progress.finished}
    max={Math.max(1, progress.total)}
    aria-label="Finished activities"
  />
  <p class="text-muted-foreground">
    {#each progress.visible as count (count.state)}{count.state}: {count.count} ·
    {/each}
  </p>
</div>

<script lang="ts">
  import {
    GitCommitHorizontal,
    CircleCheck,
    CircleAlert,
    ChevronRight,
  } from "@lucide/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import type { TaskFlow } from "./contracts";
  import { TaskPresentation } from "./task-presentation";
  import { WorkflowEvidence } from "./workflow-evidence";

  interface ContributionProperties {
    flow: TaskFlow;
    select: (flow: TaskFlow) => void;
  }
  let { flow, select }: ContributionProperties = $props();
  let task = $derived(flow.task);
  let display = $derived(TaskPresentation.describe(task));
  let evidence = $derived(new WorkflowEvidence([flow]));
  let checks = $derived(task.common.progress.checks);
  let passed = $derived(
    checks.filter((check) => check.outcome === "passed").length,
  );
  let failed = $derived(
    checks.filter((check) => check.outcome === "failed").length,
  );
</script>

<article
  aria-label={`Contribution ${task.common.id}`}
  class="rounded-lg border"
>
  <Button
    variant="ghost"
    class="h-auto w-full gap-4 p-4 text-left whitespace-normal"
    aria-label={`Open task ${task.common.id}`}
    aria-describedby={`contribution-${task.common.id}`}
    onclick={() => select(flow)}
  >
    <span
      id={`contribution-${task.common.id}`}
      class="grid min-w-0 flex-1 gap-2"
    >
      <span class="flex flex-wrap items-center gap-2">
        <span class="font-semibold">{TaskPresentation.workerName(flow)}</span>
        <Badge
          variant="secondary"
          class={TaskPresentation.tones[display.status]}
          >{display.statusLabel}</Badge
        >
      </span>
      <span class="line-clamp-1 font-medium">{task.common.objective}</span>
      <span class="line-clamp-1 font-normal text-muted-foreground">
        {display.reason ||
          task.common.progress.summary ||
          "No result recorded yet."}
      </span>
      <span
        class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-normal text-muted-foreground"
      >
        <span class="inline-flex items-center gap-1.5">
          <GitCommitHorizontal class="size-3.5" />{evidence.changes.length}
          {#if evidence.changes.length === 1}commit{:else}commits{/if}
          {#if evidence.partial}(recent){/if}
        </span>
        {#if passed}<span
            class="inline-flex items-center gap-1.5 text-emerald-800"
            ><CircleCheck class="size-3.5" />{passed} passed</span
          >{/if}
        {#if failed}<span
            class="inline-flex items-center gap-1.5 text-destructive"
            ><CircleAlert class="size-3.5" />{failed} failed</span
          >{/if}
        {#if checks.length > passed + failed}<span
            >{checks.length - passed - failed} not run</span
          >{/if}
        {#if checks.length === 0}<span>No checks recorded</span>{/if}
      </span>
    </span>
    <ChevronRight class="size-4 text-muted-foreground" />
  </Button>
</article>

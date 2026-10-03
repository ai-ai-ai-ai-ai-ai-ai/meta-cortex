<script lang="ts">
  import {
    Bot,
    GitCommitHorizontal,
    CircleCheck,
    CircleAlert,
    ArrowUpRight,
  } from "@lucide/svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Accordion from "$lib/components/ui/accordion";
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

<article aria-label={`Contribution ${task.common.id}`}>
  <Card.Root size="sm">
    <Card.Header class="gap-2">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <Bot class="size-4 text-muted-foreground" />
        <span class="font-medium">{TaskPresentation.workerName(flow)}</span>
        <Badge
          variant="secondary"
          class={TaskPresentation.tones[display.status]}
          >{display.statusLabel}</Badge
        >
        <span class="ml-auto text-xs text-muted-foreground"
          >{task.common.id}</span
        >
      </div>
      <Card.Title class="text-lg leading-snug break-words"
        >{task.common.objective}</Card.Title
      >
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if display.reason}
        <p class="flex items-start gap-2 rounded-md bg-muted p-3 text-sm">
          <CircleAlert class="mt-0.5 size-4 shrink-0" />{display.reason}
        </p>
      {/if}
      <div class="grid gap-5 lg:grid-cols-2">
        <section class="space-y-2" aria-label="Recorded result">
          <h3 class="text-xs font-medium text-muted-foreground">
            Recorded result
          </h3>
          <p class="line-clamp-3 font-medium leading-relaxed">
            {task.common.progress.summary || "No result recorded yet."}
          </p>
          <ul class="space-y-2 text-sm text-muted-foreground">
            {#each task.common.progress.findings.slice(0, 2) as finding, index (index)}
              <li class="line-clamp-2">{finding}</li>
            {/each}
          </ul>
        </section>
        <section class="space-y-2 border-l pl-4" aria-label="Success criteria">
          <h3 class="text-xs font-medium text-muted-foreground">
            Required outcome
          </h3>
          <ul class="list-disc space-y-2 pl-4 text-sm">
            {#each task.common.acceptance.slice(0, 2) as criterion, index (index)}
              <li><p class="line-clamp-3">{criterion}</p></li>
            {:else}<li>No acceptance criteria recorded.</li>{/each}
          </ul>
          {#if task.common.dependencies.length}
            <p class="text-xs text-muted-foreground">
              Depends on: {task.common.dependencies.join(", ")}
            </p>
          {/if}
        </section>
      </div>

      {#if display.status !== "integrated" && display.status !== "completed" && display.status !== "cancelled" && task.common.progress.next_steps.length}
        <div class="space-y-1 text-sm">
          <h3 class="font-medium">Next step</h3>
          <p class="line-clamp-2 text-muted-foreground">
            {task.common.progress.next_steps[0]}
          </p>
        </div>
      {/if}

      <section class="space-y-3 border-t pt-4" aria-label="Git evidence">
        <h3 class="flex items-center gap-2 text-sm font-medium">
          <GitCommitHorizontal class="size-4" />Git evidence
          <span class="font-normal text-muted-foreground"
            >{evidence.changes.length} unique {#if evidence.changes.length === 1}commit{:else}commits{/if}</span
          >
        </h3>
        {#each evidence.changes.slice(0, 2) as change (change.commit)}
          <div class="space-y-2 rounded-md bg-muted/50 p-3">
            <code class="text-sm font-medium" title={change.commit}
              >{change.commit.slice(0, 8)}</code
            >
            {#each [...change.events].reverse() as entry (`${entry.kind}:${entry.record.revision}`)}
              <div class="space-y-1 text-xs">
                <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="font-medium">{entry.kind}</span>
                  <span>{TaskPresentation.agentName(entry.record.actor)}</span>
                  <time class="ml-auto text-muted-foreground"
                    >{new Date(entry.record.at).toLocaleString()}</time
                  >
                </div>
                <p class="line-clamp-2 text-muted-foreground">
                  Ledger note: {entry.note || "No description recorded."}
                </p>
              </div>
            {/each}
          </div>
        {:else}<p class="text-sm text-muted-foreground">
            No commits in this observation.
          </p>{/each}
        {#if evidence.changes.length > 2}<p
            class="text-xs text-muted-foreground"
          >
            {evidence.changes.length - 2} more {#if evidence.changes.length === 3}commit{:else}commits{/if}
            in all evidence.
          </p>{/if}
        {#if evidence.partial}<p class="text-xs text-muted-foreground">
            Recent events only. Older commits may be available in full history.
          </p>{/if}
      </section>

      <div
        class="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
      >
        <div class="flex flex-wrap items-center gap-3 text-sm">
          {#if checks.length === 0}<span class="text-muted-foreground"
              >No checks recorded</span
            >{/if}
          {#if passed}<span
              class="inline-flex items-center gap-1.5 text-emerald-800"
              ><CircleCheck class="size-4" />Checks: {passed} passed</span
            >{/if}
          {#if failed}<span
              class="inline-flex items-center gap-1.5 text-destructive"
              ><CircleAlert class="size-4" />Checks: {failed} failed</span
            >{/if}
          {#if checks.length > passed + failed}<span
              class="text-muted-foreground"
              >{checks.length - passed - failed} not run</span
            >{/if}
        </div>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Open task ${task.common.id}`}
          onclick={() => select(flow)}>All evidence<ArrowUpRight /></Button
        >
      </div>
      <Accordion.Root type="multiple">
        <Accordion.Item value="context">
          <Accordion.Trigger
            >Full requirements, findings &amp; checks</Accordion.Trigger
          >
          <Accordion.Content class="space-y-5">
            {#each [{ label: "Acceptance criteria", values: task.common.acceptance }, { label: "Findings", values: task.common.progress.findings }, { label: "Last recorded next steps", values: task.common.progress.next_steps }] as section (section.label)}
              {#if section.values.length}<section class="space-y-2">
                  <h4 class="font-medium">{section.label}</h4>
                  <ul class="list-disc space-y-2 pl-4 text-muted-foreground">
                    {#each section.values as value, index (index)}<li
                        class="break-words"
                      >
                        {value}
                      </li>{/each}
                  </ul>
                </section>{/if}
            {/each}
            <p class="break-words">{task.common.progress.summary}</p>
            {#each checks as check, index (index)}
              <section class="space-y-2">
                <h4 class="font-medium">
                  {check.outcome} ·
                  <code class="break-all">{check.command}</code>
                </h4>
                <pre
                  class="whitespace-pre-wrap break-words text-xs text-muted-foreground">{check.evidence}</pre>
              </section>
            {/each}
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="lifecycle">
          <Accordion.Trigger
            >Lifecycle · {evidence.activity.length} recorded events</Accordion.Trigger
          >
          <Accordion.Content class="space-y-4">
            <ol class="space-y-4 border-l pl-4">
              {#each [...evidence.activity].reverse() as entry (entry.record.revision)}
                <li class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-medium capitalize"
                      >{entry.record.kind}</span
                    ><span
                      >{TaskPresentation.agentName(entry.record.actor)}</span
                    ><time class="text-xs text-muted-foreground"
                      >{new Date(entry.record.at).toLocaleString()}</time
                    >
                  </div>
                  <p class="break-words text-muted-foreground">
                    {entry.record.note}
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Attempt {entry.record.attempt} · revision {entry.record
                      .revision}
                  </p>
                </li>
              {:else}<li class="text-muted-foreground">
                  No lifecycle events in this observation.
                </li>{/each}
            </ol>
            {#if evidence.partial}<p class="text-xs text-muted-foreground">
                Older events are available through All evidence → History.
              </p>{/if}
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
    </Card.Content>
  </Card.Root>
</article>

<script lang="ts">
  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge";
  import type { TaskFlow } from "./contracts";
  import { AttemptEvidence, WorkTiming } from "./execution-presentation";
  import { TaskPresentation } from "./task-presentation";
  let { flow }: { flow: TaskFlow } = $props();
</script>

<section aria-label="Attempts and delivered work" class="space-y-3">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <h3 class="font-semibold">Attempts &amp; delivered work</h3>
    <span class="text-xs text-muted-foreground"
      >{flow.attempts.length} shown · {flow.task.common.attempt} total task attempts</span
    >
  </div>
  <Accordion.Root type="multiple">
    {#each flow.attempts as attempt (attempt.attempt)}
      <Accordion.Item value={String(attempt.attempt)}>
        <Accordion.Trigger>
          <span class="min-w-0 space-y-2">
            <span class="flex flex-wrap items-center gap-2"
              >Attempt {attempt.attempt}
              {#if attempt.worker.kind === "recorded"}<span
                  class="text-muted-foreground"
                  >{TaskPresentation.agentName(attempt.worker.agent)}</span
                >{/if}
              <Badge variant="outline"
                >{AttemptEvidence.outcomes[attempt.last_event]}</Badge
              >
            </span>
            <span class="line-clamp-2 block font-normal text-muted-foreground"
              >{AttemptEvidence.summary(attempt)}</span
            >
          </span>
        </Accordion.Trigger>
        <Accordion.Content class="space-y-4">
          <p class="text-xs text-muted-foreground">
            {#if attempt.started.kind === "recorded"}Started {WorkTiming.date(
                attempt.started.at,
              )} · {WorkTiming.duration(attempt.started.at, attempt.updated_at)}
              recorded span{:else}Start not in loaded history{/if}
            · Last update {WorkTiming.date(attempt.updated_at)}
          </p>
          {#if attempt.progress.kind === "recorded"}
            <p class="max-w-4xl leading-relaxed">
              {attempt.progress.progress.summary}
            </p>
            {#each [{ label: "Findings", items: attempt.progress.progress.findings }, { label: "Next steps", items: attempt.progress.progress.next_steps }] as section (section.label)}
              {#if section.items.length}<div class="space-y-2">
                  <h4 class="font-medium">{section.label}</h4>
                  <ul class="list-inside list-disc space-y-1">
                    {#each section.items as item, index (index)}<li>
                        {item}
                      </li>{/each}
                  </ul>
                </div>{/if}
            {/each}
            {#each attempt.progress.progress.checks as check, index (index)}<p
                class="break-words"
              >
                <Badge variant="secondary">{check.outcome}</Badge>
                {check.command}<span class="block text-muted-foreground"
                  >{check.evidence}</span
                >
              </p>{/each}
          {/if}
          <div class="space-y-2">
            {#each AttemptEvidence.commits(flow, attempt) as commit (`${commit.revision}:${commit.commit}`)}
              <p class="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                <code title={commit.commit}>{commit.commit.slice(0, 8)}</code
                ><span
                  >Recorded by {TaskPresentation.agentName(commit.actor)}</span
                ><span class="text-muted-foreground"
                  >{WorkTiming.date(commit.at)}</span
                >
              </p>
            {:else}<p class="text-xs text-muted-foreground">
                No commit recorded in this attempt.
              </p>{/each}
          </div>
        </Accordion.Content>
      </Accordion.Item>
    {:else}<p class="py-3 text-sm text-muted-foreground">
        No claimed attempts in the loaded history.
      </p>{/each}
  </Accordion.Root>
  {#if flow.history_end === "More"}<p class="text-xs text-muted-foreground">
      Showing attempts from the latest 100 events. Open full history for older
      evidence.
    </p>{/if}
</section>

<script lang="ts">
  import { OctagonAlert } from "@lucide/svelte";
  import type { FeatureSummary } from "./contracts";
  import { Journal, JournalEntry } from "./journal";
  import { ToneClasses } from "./presentation";
  import PullRequestChip from "./PullRequestChip.svelte";
  interface Props {
    summaries: ReadonlyArray<FeatureSummary>;
    now: number;
    truncated: boolean;
  }
  let { summaries, now, truncated }: Props = $props();
  let journal = $derived.by(() => {
    const frame = { summaries, now };
    return new Journal(frame);
  });
</script>

{#snippet card(summary: FeatureSummary)}
  {@const frame = { summary, now }}
  {@const entry = new JournalEntry(frame)}
  {@const status = entry.status()}
  {@const attention = summary.totals.condition === "attention"}
  <article
    aria-label={summary.feature.objective}
    class={[
      "space-y-3 rounded-xl border bg-card px-5 py-4 shadow-xs",
      { "border-l-4 border-l-status-blocked": attention },
    ]}
  >
    <h3 class="text-[15px] leading-snug font-semibold text-pretty">
      {summary.feature.objective}
    </h3>
    <div
      class="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 text-xs"
    >
      <p class="flex min-w-0 flex-wrap items-center gap-2">
        <span
          class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium {ToneClasses
            .SOFT[status.tone]}"
          ><status.icon class="size-3" aria-hidden="true" />{status.label}</span
        >
        {#each summary.pull_requests as request (request.url)}
          <PullRequestChip {request} />
        {/each}
        <span class="truncate font-mono text-muted-foreground"
          >{summary.feature.id}</span
        >
      </p>
      <p
        class="text-[13px] text-muted-foreground sm:text-right"
        data-testid="feature-sentence"
      >
        {entry.sentence()}
        {#each entry.quiet() as quiet (quiet)}
          <span class="whitespace-nowrap text-status-stalled">· {quiet}</span>
        {/each}
      </p>
    </div>

    {#if entry.reasons().length > 0}
      <ul class="space-y-1 text-sm text-status-blocked">
        {#each entry.reasons() as reason (reason)}
          <li class="flex items-start gap-1.5">
            <OctagonAlert class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{reason}</span>
          </li>
        {/each}
      </ul>
    {/if}

    <div
      role="img"
      aria-label={`${summary.feature.id} progress: ${entry.progress()}`}
      class="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      {#each entry.segments() as segment (segment.label)}
        <span
          class="h-full {ToneClasses.FILL[segment.tone]}"
          style:width={`${segment.share * 100}%`}
        ></span>
      {/each}
    </div>

    {#if entry.outcomes().length > 0}
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          class="mr-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
          >Delivers</span
        >
        <ul class="contents" aria-label={`${summary.feature.id} outcomes`}>
          {#each entry.outcomes() as outcome (outcome.task)}
            <li
              class="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 font-mono text-xs"
              title={outcome.look.label}
            >
              {outcome.task}
              <outcome.look.icon
                class="size-3 {ToneClasses.TEXT[outcome.look.tone]}"
                aria-label={outcome.look.label}
              />
            </li>
          {/each}
        </ul>
        {#if entry.hiddenOutcomes() > 0}
          <span class="text-xs text-muted-foreground"
            >+{entry.hiddenOutcomes()} more</span
          >
        {/if}
      </div>
    {/if}
  </article>
{/snippet}

<section aria-labelledby="journal-title" class="space-y-6">
  <header class="space-y-1">
    <h1 id="journal-title" class="text-2xl font-semibold tracking-tight">
      Features
    </h1>
    <p class="flex flex-wrap gap-x-3 text-sm text-muted-foreground">
      {#each journal.conditions() as condition (condition.label)}
        <span
          ><span class="font-medium {ToneClasses.TEXT[condition.tone]}"
            >{condition.count}</span
          >
          {condition.label}</span
        >
      {/each}
      <span>· {journal.held()} tasks held by agents</span>
    </p>
  </header>

  {#if summaries.length === 0}
    <div class="rounded-xl border border-dashed p-12 text-center">
      <h2 class="font-medium">No features recorded yet</h2>
      <p class="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        When Gizmo Prime records a feature and its tasks in the ledger, it
        appears here and updates live.
      </p>
    </div>
  {:else}
    <ol class="space-y-0">
      {#each journal.days() as day, position (day.key)}
        <li aria-labelledby={`journal-day-${position}`}>
          <h2 id={`journal-day-${position}`} class="sr-only">
            {day.label}
            {day.date}
          </h2>
          <ul>
            {#each day.entries as summary, index (summary.feature.id)}
              {@const frame = { summary, now }}
              {@const tone = new JournalEntry(frame).status().tone}
              <li
                class="grid grid-cols-[5.5rem_1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[8.5rem_1.25rem_minmax(0,1fr)]"
              >
                <div class="pt-3">
                  {#if index === 0}
                    <span
                      aria-hidden="true"
                      class="inline-flex flex-wrap items-baseline gap-x-1 rounded-lg border bg-card px-2.5 py-1 text-sm shadow-xs"
                      ><span class="font-medium">{day.label}</span
                      >{#if day.date !== ""}<span class="text-muted-foreground"
                          >· {day.date}</span
                        >{/if}</span
                    >
                  {/if}
                </div>
                <div class="relative flex justify-center" aria-hidden="true">
                  <span class="absolute inset-y-0 w-px bg-border"></span>
                  <span
                    class="relative mt-5 size-3 rounded-full border-2 bg-background {ToneClasses
                      .RING[tone]}"
                  ></span>
                </div>
                <div class="min-w-0 pb-3">
                  {@render card(summary)}
                </div>
              </li>
            {/each}
          </ul>
        </li>
      {/each}
    </ol>
    {#if truncated}
      <p class="text-xs text-muted-foreground">
        Showing the first 100 recorded features by ID.
      </p>
    {/if}
  {/if}
</section>

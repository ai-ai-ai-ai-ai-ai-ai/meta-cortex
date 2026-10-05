<script lang="ts">
  import type { FeatureSummary } from "./contracts";
  import { ChevronRight } from "@lucide/svelte";
  import { FeatureLook, RecordedTime } from "./observability";
  import PullRequests from "./PullRequests.svelte";
  interface Props {
    summary: FeatureSummary;
    selected: string;
    select: (summary: FeatureSummary) => void;
  }
  let { summary, selected, select }: Props = $props();
  let look = $derived(new FeatureLook(summary));
</script>

<article
  class="feature-menu-card"
  class:selected={selected === summary.feature.id}
>
  <button
    class="menu-select"
    onclick={() => select(summary)}
    aria-pressed={selected === summary.feature.id}
    aria-label={`Preview ${look.title()}`}
  >
    <strong class="menu-title" title={look.title()}>{look.title()}</strong>
    {#each look.started() as at (at)}<time
        class="menu-start"
        datetime={new RecordedTime(at).iso()}
        title={`${new RecordedTime(at).full()} · ${RecordedTime.ZONE}`}
        >{new RecordedTime(at).card()}</time
      >{/each}
  </button>
  <details class="feature-description">
    <summary
      ><ChevronRight size={11} /><span>{summary.feature.objective}</span
      ></summary
    >
  </details>
  <div
    class="brief-progress"
    aria-label={`${summary.totals.completion.finished} of ${summary.totals.completion.total} tasks finished`}
  >
    <div class="brief-progress-count">
      <b>{summary.totals.completion.finished}</b><span
        >/ {summary.totals.completion.total}</span
      ><span>finished</span>
    </div>
    <div class="menu-segments" aria-hidden="true">
      {#each look.segments() as kind, index (index)}<span
          class={`menu-segment ${kind}`}
        ></span>{/each}
    </div>
    <div class="brief-progress-note">
      <span>{look.open()} open</span><span
        >{summary.totals.completion.cancelled} cancelled</span
      >
    </div>
  </div>
  <div class="card-footer">
    <span>Available</span>
    <span>{look.signals().join(" · ")}</span><PullRequests
      requests={summary.pull_requests}
    /><span>{summary.actors.length} roles</span>
  </div>
</article>

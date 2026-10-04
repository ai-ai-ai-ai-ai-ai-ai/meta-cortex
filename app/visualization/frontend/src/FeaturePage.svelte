<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { FeatureSummary } from "./contracts";
  import { Search } from "@lucide/svelte";
  import { DashboardApi } from "./api";
  import { WorkflowController, DetailKind } from "./workflow-state.svelte";
  import { FeatureLook, FeatureFilter, Screen } from "./observability";
  import FeatureCard from "./FeatureCard.svelte";
  import FeatureBriefing from "./FeatureBriefing.svelte";
  import WorkflowPage from "./WorkflowPage.svelte";
  interface Props {
    summaries: ReadonlyArray<FeatureSummary>;
    truncated: boolean;
  }
  let { summaries, truncated }: Props = $props();
  let query = $state("");
  let filter = $state(FeatureFilter.All);
  let selected = $state("");
  let screen = $state(Screen.Features);
  let task = $state("");
  const detail = new WorkflowController(new DashboardApi());
  let filtered = $derived(
    summaries.filter(
      (summary) =>
        new FeatureLook(summary).matches(filter) &&
        `${summary.feature.id} ${summary.feature.objective} ${summary.feature.branch}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
  );
  let current = $derived(
    filtered
      .filter((summary) => summary.feature.id === selected)
      .concat(filtered)
      .slice(0, 1),
  );
  let detailKey = $derived(
    current
      .map(
        (summary) =>
          `${summary.feature.id}:${JSON.stringify(summary.totals.activity)}`,
      )
      .join(""),
  );
  $effect(() => {
    switch (detailKey) {
      case "":
        return;
      default:
        untrack(() => {
          for (const summary of current) detail.read(summary.feature.id);
        });
    }
  });
  onDestroy(() => detail.stop());
  function select(summary: FeatureSummary): void {
    selected = summary.feature.id;
  }
  function open(id: string): void {
    task = id;
    screen = Screen.Workflow;
  }
</script>

{#each detail.failures as failure (failure.message)}<div
    role="alert"
    class="notice"
  >
    {failure.message}
    {#each current as summary (summary.feature.id)}<button
        class="small-control"
        onclick={() => detail.read(summary.feature.id)}>Retry workflow</button
      >{/each}
  </div>{/each}
{#if screen === Screen.Workflow && detail.state.kind === DetailKind.Loaded}
  {#each current as summary (summary.feature.id)}<WorkflowPage
      {summary}
      workflow={detail.state.workflow}
      initialTask={task}
      back={() => (screen = Screen.Features)}
    />{/each}
{:else}
  <div class="page-heading">
    <div>
      <h1>Features</h1>
      <p>
        {summaries.length} features · {summaries.reduce(
          (count, summary) => count + summary.totals.completion.total,
          0,
        )} tasks
      </p>
    </div>
    <span class="snapshot">Recorded in Turso</span>
  </div>
  <div class="browse-controls">
    <div class="state-filters" aria-label="Filter feature state">
      {#each Object.values(FeatureFilter) as item (item)}<button
          class="state-filter"
          aria-pressed={filter === item}
          onclick={() => (filter = item)}
          >{item}<small
            >{summaries.filter((summary) =>
              new FeatureLook(summary).matches(item),
            ).length}</small
          ></button
        >{/each}
    </div>
    <label class="search-wrap"
      ><Search size={14} /><input
        aria-label="Find a feature"
        type="search"
        placeholder="Find a feature…"
        bind:value={query}
      /></label
    >
  </div>
  <div class="result-note">
    <span>{filtered.length} features</span><span>Latest updates first</span>
  </div>
  {#if truncated}<p class="notice">
      Showing the 100 most recently active features.
    </p>{/if}
  {#if filtered.length}<div class="split">
      <div class="split-list" role="group" aria-label="Choose a feature">
        {#each filtered as summary (summary.feature.id)}<FeatureCard
            {summary}
            selected={current.map((item) => item.feature.id).join("")}
            {select}
          />{/each}
      </div>
      <div aria-live="polite">
        {#if detail.state.kind === DetailKind.Loaded}{#each current as summary (summary.feature.id)}<FeatureBriefing
              {summary}
              workflow={detail.state.workflow}
              {open}
            />{/each}{:else if detail.state.kind === DetailKind.Failed}<div
            class="empty"
            role="alert"
          >
            <p>{detail.state.failure.message}</p>
            {#each current as summary (summary.feature.id)}<button
                class="small-control"
                onclick={() => detail.read(summary.feature.id)}
                >Retry workflow</button
              >{/each}
          </div>{:else}<div class="feature-preview loading" role="status">
            Reading workflow…
          </div>{/if}
      </div>
    </div>
  {:else}<div class="empty">
      <h2>
        {#if summaries.length}No matching features{:else}No features recorded
          yet{/if}
      </h2>
      <p>Feature records appear here when work is saved in Workbench.</p>
    </div>{/if}
{/if}

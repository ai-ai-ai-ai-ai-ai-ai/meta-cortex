<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type {
    FeatureCard,
    FeatureSummary,
    FeatureWorkflow,
  } from "./contracts";
  import { Search } from "@lucide/svelte";
  import { DashboardApi } from "./api";
  import { WorkflowController, DetailKind } from "./workflow-state.svelte";
  import { CatalogLook, FilterMatch } from "./feature-availability";
  import {
    FeatureUpgrade,
    UpgradeKind,
    type UpgradeRequest,
  } from "./feature-upgrade.svelte";
  import {
    FeatureFilter,
    Screen,
    WorkflowOpeningKind,
    type WorkflowOpening,
  } from "./observability";
  import FeatureMenuCard from "./FeatureCard.svelte";
  import FeatureBriefing from "./FeatureBriefing.svelte";
  import WorkflowPage from "./WorkflowPage.svelte";
  interface Props {
    summaries: ReadonlyArray<FeatureCard>;
    truncated: boolean;
    refresh: () => void;
  }
  let { summaries, truncated, refresh }: Props = $props();
  let query = $state("");
  let filter = $state(FeatureFilter.All);
  let selected = $state("");
  let screen = $state(Screen.Features);
  let opening = $state<WorkflowOpening>({ kind: WorkflowOpeningKind.Feature });
  const detail = new WorkflowController(new DashboardApi());
  const upgrade = new FeatureUpgrade(new DashboardApi());
  let filtered = $derived(
    summaries.filter(
      (summary) =>
        new CatalogLook(summary).match(filter) === FilterMatch.Included &&
        new CatalogLook(summary)
          .searchText()
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
  );
  let current = $derived(
    filtered
      .filter((summary) => new CatalogLook(summary).id() === selected)
      .concat(filtered)
      .slice(0, 1),
  );
  let currentSummaries = $derived(
    current.flatMap((card) => new CatalogLook(card).summaries()),
  );
  let detailKey = $derived(
    current.map((card) => new CatalogLook(card).detailKey()).join(""),
  );
  $effect(() => {
    const key = detailKey;
    untrack(() => readSelection(key));
  });
  function readSelection(key: string): void {
    switch (key) {
      case "":
        detail.clear();
        return;
      default:
        break;
    }
    detail.clear();
    for (const card of current) {
      switch (card.kind) {
        case "current":
          detail.read(card.summary.feature.id);
          break;
        case "upgrade_required":
        case "unavailable":
          break;
      }
    }
  }
  onDestroy(() => {
    detail.stop();
    upgrade.stop();
  });
  function select(summary: FeatureSummary): void {
    selected = summary.feature.id;
    screen = Screen.Features;
  }
  function selectCard(card: FeatureCard): void {
    selected = new CatalogLook(card).id();
    screen = Screen.Features;
  }
  function opened(workflow: FeatureWorkflow): void {
    selected = workflow.feature;
    detail.show(workflow);
    screen = Screen.Workflow;
    opening = { kind: WorkflowOpeningKind.Feature };
    refresh();
  }
  function upgradeSelected(card: FeatureCard): void {
    const request: UpgradeRequest = {
      feature: new CatalogLook(card).id(),
      opened,
    };
    upgrade.open(request);
  }
  function open(request: WorkflowOpening): void {
    opening = request;
    screen = Screen.Workflow;
  }
</script>

{#each detail.failures as failure (failure.message)}<div
    role="alert"
    class="notice"
  >
    {failure.message}
    {#each currentSummaries as summary (summary.feature.id)}<button
        class="small-control"
        onclick={() => detail.read(summary.feature.id)}>Retry workflow</button
      >{/each}
  </div>{/each}
{#if screen === Screen.Workflow && detail.state.kind === DetailKind.Loaded && currentSummaries.length > 0}
  {#each currentSummaries as summary (summary.feature.id)}<WorkflowPage
      {summary}
      workflow={detail.state.workflow}
      {opening}
      back={() => (screen = Screen.Features)}
    />{/each}
{:else}
  <div class="page-heading">
    <div>
      <h1>Features</h1>
      <p>
        {summaries.length} features · {summaries
          .flatMap((card) => new CatalogLook(card).summaries())
          .reduce(
            (count, summary) => count + summary.totals.completion.total,
            0,
          )} readable tasks
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
            >{summaries.filter(
              (summary) =>
                new CatalogLook(summary).match(item) === FilterMatch.Included,
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
        {#each filtered as card (new CatalogLook(card).id())}
          {#if card.kind === "current"}
            <FeatureMenuCard
              summary={card.summary}
              selected={current
                .map((item) => new CatalogLook(item).id())
                .join("")}
              {select}
            />
          {:else}
            <article
              class="feature-menu-card"
              class:selected={current
                .map((item) => new CatalogLook(item).id())
                .join("") === new CatalogLook(card).id()}
            >
              <button
                class="menu-select"
                onclick={() => selectCard(card)}
                aria-label={`Preview ${new CatalogLook(card).id()}`}
                aria-pressed={current
                  .map((item) => new CatalogLook(item).id())
                  .join("") === new CatalogLook(card).id()}
              >
                <strong class="menu-title">{new CatalogLook(card).id()}</strong>
              </button>
              <div class="card-footer">
                {#if card.kind === "upgrade_required"}Upgrade required{:else}Unavailable{/if}
              </div>
            </article>
          {/if}
        {/each}
      </div>
      <div aria-live="polite">
        {#each current as card (new CatalogLook(card).id())}
          {#if card.kind === "upgrade_required"}
            <article
              class="feature-preview"
              aria-label="Selected feature upgrade"
            >
              <h2>{card.feature.id}</h2>
              <p>{card.feature.objective}</p>
              <p>Storage version {card.storage_version}</p>
              <p>
                Upgrade this feature’s database to open its recorded workflow.
              </p>
              {#if upgrade.state.kind === UpgradeKind.Failed && upgrade.state.feature === card.feature.id}
                <p role="alert">{upgrade.state.failure.message}</p>
              {/if}
              {#if upgrade.state.kind === UpgradeKind.Opened && upgrade.state.workflow.feature === card.feature.id}
                <p role="status">Upgrade complete. Refreshing this feature…</p>
                <button class="small-control" onclick={refresh}
                  >Refresh feature</button
                >
              {:else}
                <button
                  class="small-control"
                  disabled={upgrade.state.kind === UpgradeKind.Pending}
                  onclick={() => upgradeSelected(card)}
                >
                  {#if upgrade.state.kind === UpgradeKind.Pending}Upgrading…{:else}Upgrade
                    and open{/if}
                </button>
              {/if}
            </article>
          {:else if card.kind === "unavailable"}
            <article
              class="feature-preview"
              aria-label="Selected unavailable feature"
            >
              <h2>{card.feature}</h2>
              <p>Unavailable</p>
              <p>{card.message}</p>
            </article>
          {:else if detail.state.kind === DetailKind.Loaded}{#each currentSummaries as summary (summary.feature.id)}<FeatureBriefing
                {summary}
                workflow={detail.state.workflow}
                {open}
              />{/each}{:else if detail.state.kind === DetailKind.Failed}<div
              class="empty"
              role="alert"
            >
              <p>{detail.state.failure.message}</p>
              {#each currentSummaries as summary (summary.feature.id)}<button
                  class="small-control"
                  onclick={() => detail.read(summary.feature.id)}
                  >Retry workflow</button
                >{/each}
            </div>{:else}<div class="feature-preview loading" role="status">
              Reading workflow…
            </div>{/if}
        {/each}
      </div>
    </div>
  {:else}<div class="empty">
      <h2>
        {#if summaries.length}No matching features{:else}No features recorded
          yet{/if}
      </h2>
      <p>
        {#if summaries.length}Try another search or filter.{:else}No feature
          databases were found. Feature records appear here when work is saved
          in Workbench.{/if}
      </p>
    </div>{/if}
{/if}

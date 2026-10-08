<script lang="ts">
  import { guide } from "virtual:agent-guide";
  import AgentGuideView from "./AgentGuideView.svelte";
  import { GuideNavigation } from "./guide-state.svelte";
  import { GuideRoute } from "./agent-guide";
  import { onMount } from "svelte";
  import { Effect } from "effect";
  import { CircleAlert, Network, Pause, Play, RefreshCw } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { RepositoryNavigation } from "./repository-navigation.svelte";
  import type { RepositoryCard } from "./contracts";
  import RepositoryPage from "./RepositoryPage.svelte";
  import { Clock, LiveMode, LiveRefresh } from "./dashboard-state.svelte";
  import { TimeLook } from "./presentation";
  import FeaturePage from "./FeaturePage.svelte";

  const navigation = new GuideNavigation();
  const repositories = new RepositoryNavigation();
  let dashboard = $derived(repositories.reading());
  const live = new LiveRefresh();
  const clock = new Clock();
  let time = $derived(new TimeLook(clock.now));

  onMount(() => {
    repositories.catalog.read();
    const stopClock = clock.run();
    return () => {
      stopClock();
      repositories.stop();
    };
  });
  function focus(node: HTMLElement): void {
    node.focus();
  }
  $effect(() => live.run(Effect.sync(() => dashboard.refresh())));
</script>

<div class="app">
  <header class="topbar">
    <span
      class="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"
      aria-hidden="true"><Network class="size-4" /></span
    >
    <nav aria-label="Main navigation" class="mr-auto flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onclick={() => navigation.dashboard()}
        aria-current={navigation.route === GuideRoute.Dashboard}
        >Homeostat</Button
      >
      <Button
        variant="ghost"
        size="sm"
        onclick={() => navigation.guide()}
        aria-current={navigation.route === GuideRoute.Guide}>Agent guide</Button
      >
    </nav>
    {#if navigation.route === GuideRoute.Dashboard}
      <p
        class="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"
        role="status"
      >
        {#if live.mode === LiveMode.Live}
          <span class="relative flex size-2" aria-hidden="true">
            <span
              class="absolute inline-flex size-full animate-ping rounded-full bg-status-integrated opacity-60"
            ></span>
            <span
              class="relative inline-flex size-2 rounded-full bg-status-integrated"
            ></span>
          </span>
          Live
        {:else}
          Paused
        {/if}
        {#each dashboard.received() as received (received)}
          · updated {time.relative(received)}
        {/each}
      </p>
      <Button
        variant="ghost"
        size="sm"
        class="h-7"
        onclick={() => live.toggle()}
        aria-label={live.label()}
      >
        {#if live.mode === LiveMode.Live}<Pause
            aria-hidden="true"
          />Pause{:else}<Play aria-hidden="true" />Resume{/if}
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="h-7"
        disabled={dashboard.busy()}
        onclick={() => dashboard.refresh()}
        aria-label="Refresh now"
      >
        <span class="inline-flex" class:animate-spin={dashboard.busy()}
          ><RefreshCw aria-hidden="true" /></span
        >
        Refresh
      </Button>
    {/if}
  </header>

  <main class="page">
    {#if navigation.route === GuideRoute.Guide}
      <AgentGuideView {guide} />
    {:else}
      {#each dashboard.failures() as failure (failure.message)}
        <div
          role="alert"
          class="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <CircleAlert class="size-4 text-destructive" aria-hidden="true" />
          <p class="flex-1">
            {failure.message}
            {#each dashboard.received() as received (received)}
              <span class="text-muted-foreground"
                >Showing the last successful read from {time.relative(
                  received,
                )}.</span
              >
            {/each}
          </p>
          <Button
            variant="outline"
            size="sm"
            class="min-h-[44px]"
            onclick={() => dashboard.refresh()}>Retry</Button
          >
        </div>
      {/each}

      {#each repositories.selected() as selection (selection.card.repository.repository_id)}
        {#if selection.read.featurePages().length === 0}<nav
            class="repository-back"
            tabindex="-1"
            use:focus
            aria-label="Repository navigation"
          >
            <Button variant="ghost" onclick={() => repositories.back()}
              >Back to repositories</Button
            ><span class="repository-identity"
              >{selection.card.repository.name}<code
                >{selection.card.repository.repository_id}</code
              ></span
            >
          </nav>{/if}
        {#each selection.read.featurePages() as summaries, index (index)}
          <FeaturePage
            {summaries}
            repository={selection.card.repository}
            back={() => repositories.back()}
            truncated={selection.read.truncated()}
            refresh={() => dashboard.refresh()}
          />
        {:else}
          {#if dashboard.failures().length === 0}<div
              role="status"
              class="empty"
            >
              Reading repository features…
            </div>{/if}
        {/each}
      {:else}
        {#each repositories.catalog.repositoryPages() as cards, index (index)}
          <RepositoryPage
            repositories={cards.records}
            end={cards.end}
            select={(card: RepositoryCard) => repositories.select(card)}
            refresh={() => dashboard.refresh()}
          />
        {:else}
          {#if dashboard.failures().length === 0}
            <div
              role="status"
              class="space-y-4"
              aria-label="Reading repositories"
            >
              <div class="h-8 w-48 animate-pulse rounded-md bg-muted"></div>
              {#each [1, 2, 3] as placeholder (placeholder)}<div
                  class="h-20 animate-pulse rounded-xl bg-muted"
                ></div>{/each}
              <span class="sr-only">Reading recorded repositories…</span>
            </div>
          {/if}
        {/each}
      {/each}
    {/if}
  </main>
</div>

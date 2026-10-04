<script lang="ts">
  import { onMount } from "svelte";
  import { Effect } from "effect";
  import { CircleAlert, Network, Pause, Play, RefreshCw } from "@lucide/svelte";
  import { Button } from "$lib/components/ui/button";
  import { DashboardApi } from "./api";
  import {
    Clock,
    LiveMode,
    LiveRefresh,
    ReadController,
  } from "./dashboard-state.svelte";
  import { TimeLook } from "./presentation";
  import FeaturePage from "./FeaturePage.svelte";

  interface Props {
    onguide: () => void;
  }
  let { onguide }: Props = $props();

  const dashboard = new ReadController(new DashboardApi());
  const live = new LiveRefresh();
  const clock = new Clock();
  let time = $derived(new TimeLook(clock.now));

  onMount(() => {
    dashboard.read();
    const stopClock = clock.run();
    return () => {
      stopClock();
      dashboard.stop();
    };
  });
  $effect(() => live.run(Effect.sync(() => dashboard.refresh())));
</script>

<div class="app">
  <header class="topbar">
    <span
      class="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground"
      aria-hidden="true"><Network class="size-4" /></span
    >
    <span class="mr-auto text-sm font-semibold">Workbench</span>
    <Button variant="ghost" size="sm" onclick={onguide}>Agent guide</Button>
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
  </header>

  <main class="page">
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
        <Button variant="outline" size="sm" onclick={() => dashboard.refresh()}
          >Retry</Button
        >
      </div>
    {/each}

    {#each dashboard.featurePages() as summaries, index (index)}
      <FeaturePage {summaries} truncated={dashboard.truncated()} />
    {:else}
      {#if dashboard.failures().length === 0}
        <div role="status" class="space-y-4" aria-label="Reading the ledger">
          <div class="h-8 w-48 animate-pulse rounded-md bg-muted"></div>
          {#each [1, 2, 3] as placeholder (placeholder)}
            <div class="h-36 animate-pulse rounded-xl bg-muted"></div>
          {/each}
          <span class="sr-only">Reading recorded work…</span>
        </div>
      {/if}
    {/each}
  </main>
</div>

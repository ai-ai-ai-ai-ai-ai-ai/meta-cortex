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
  import JournalPage from "./JournalPage.svelte";

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

<div class="min-h-dvh bg-background">
  <header
    class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur md:px-8"
  >
    <span
      class="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"
      aria-hidden="true"><Network class="size-4" /></span
    >
    <span class="mr-auto text-sm font-semibold">Meta-Cortex</span>
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
      class="h-10"
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
      class="h-10"
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

  <main class="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-8">
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

    {#each dashboard.journals() as summaries, index (index)}
      <JournalPage
        {summaries}
        now={clock.now}
        truncated={dashboard.truncated()}
      />
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

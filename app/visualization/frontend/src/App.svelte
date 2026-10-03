<script lang="ts">
  import { onMount } from "svelte";
  import { Effect } from "effect";
  import {
    RefreshCw,
    Radio,
    Workflow as WorkflowIcon,
    ArrowRight,
    GitBranch,
  } from "@lucide/svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Accordion from "$lib/components/ui/accordion";
  import * as Table from "$lib/components/ui/table";
  import { Separator } from "$lib/components/ui/separator";
  import { Button } from "$lib/components/ui/button";
  import { DashboardController, LoadKind } from "./dashboard-state.svelte";
  import { DashboardApi } from "./api";
  import type { TaskV2, TaskFlow } from "./contracts";
  import Navigation from "./Navigation.svelte";
  import Workflow from "./Workflow.svelte";
  import RecordedTask from "./RecordedTask.svelte";

  const dashboard = new DashboardController(new DashboardApi());
  const inspector = new DashboardController(new DashboardApi());
  let record = $state<{ task: TaskV2; flow?: TaskFlow } | null>(null);
  let sheetOpen = $state(false);
  let showingHistory = $state(false);
  let autoRefresh = $state(false);
  const refresh = Effect.sync(() => dashboard.refresh());
  onMount(() => {
    dashboard.load({ kind: "Initial" });
    return () => {
      dashboard.stop();
      inspector.stop();
    };
  });
  function navigate(feature: string) {
    sheetOpen = false;
    dashboard.load({ kind: "Workflow", feature, page: 0 });
  }
  function choose(selection: { task: TaskV2; flow?: TaskFlow }) {
    inspector.stop();
    record = selection;
    showingHistory = false;
    sheetOpen = true;
  }
  function history(task: TaskV2) {
    record = { task };
    inspector.features = dashboard.features;
    inspector.load({
      kind: "History",
      query: { feature: task.common.feature, task: task.common.id },
      page: 0,
    });
    showingHistory = true;
    sheetOpen = true;
  }
  $effect(() => {
    switch (dashboard.state.kind) {
      case LoadKind.Loading:
      case LoadKind.Failed:
        return;
      case LoadKind.Ready: {
        const reply = dashboard.state.reply;
        switch (reply.content.kind) {
          case "Task":
            choose({ task: reply.content.value });
            dashboard.load({
              kind: "Workflow",
              feature: reply.content.value.common.feature,
              page: 0,
            });
            return;
          case "History":
            inspector.features = dashboard.features;
            inspector.state = dashboard.state;
            inspector.reply = reply;
            showingHistory = true;
            sheetOpen = true;
            dashboard.load({
              kind: "Workflow",
              feature: dashboard.currentFeature(),
              page: 0,
            });
            return;
          case "Workflow":
          case "Features":
            return;
        }
      }
    }
  });
  $effect(() => {
    switch (inspector.state.kind) {
      case LoadKind.Loading:
      case LoadKind.Failed:
        return;
      case LoadKind.Ready:
        switch (inspector.state.reply.content.kind) {
          case "Task":
            choose({ task: inspector.state.reply.content.value });
            return;
          case "History":
          case "Features":
          case "Workflow":
            return;
        }
    }
  });
  $effect(() => {
    switch (autoRefresh) {
      case false:
        return;
      case true:
        return Effect.runCallback(
          Effect.forever(
            Effect.sleep("10 seconds").pipe(Effect.andThen(refresh)),
          ),
        );
    }
  });
</script>

{#snippet loadStatus(controller: DashboardController)}
  {#if controller.state.kind === LoadKind.Loading}<p
      role="status"
      class="text-sm text-muted-foreground"
    >
      Reading recorded work…
    </p>
  {:else if controller.state.kind === LoadKind.Failed}<div
      role="alert"
      class="flex flex-wrap items-center gap-3 rounded-md border p-4 text-sm"
    >
      <p>{controller.state.failure.message}</p>
      <Button
        variant="outline"
        onclick={() => controller.load(controller.state.request)}>Retry</Button
      >
    </div>{/if}
{/snippet}
{#snippet paging(controller: DashboardController)}
  {#if controller.reply && controller.reply.content.kind !== "Task"}
    {@const reply = controller.reply}
    {@const page = reply.selection.page}
    {@const content = reply.content}
    <footer
      class="flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground"
    >
      <span>Page {page + 1} · up to 100 records per page</span>
      <div class="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0 || controller.state.kind === LoadKind.Loading}
          onclick={() => controller.page(page - 1)}>Previous</Button
        >
        <Button
          variant="outline"
          size="sm"
          disabled={controller.state.kind === LoadKind.Loading ||
            (content.kind === "Workflow" &&
              content.value.tasks.end === "Complete") ||
            ((content.kind === "Features" || content.kind === "History") &&
              content.value.end === "Complete")}
          onclick={() => controller.page(page + 1)}>Next</Button
        >
      </div>
    </footer>
  {/if}
{/snippet}

<Sidebar.Provider>
  <Navigation
    features={dashboard.features}
    selected={dashboard.currentFeature()}
    {navigate}
    overview={() => dashboard.load({ kind: "Features", page: 0 })}
  />
  <Sidebar.Inset class="min-w-0">
    <header
      class="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background px-4"
    >
      <Sidebar.Trigger /><Separator orientation="vertical" class="h-4" />
      <span class="mr-auto truncate text-sm text-muted-foreground"
        >Workbench / {dashboard.currentFeature() || "All workflows"}</span
      >
      <Button
        variant="ghost"
        size="sm"
        aria-pressed={autoRefresh}
        aria-label="Auto-refresh every 10 seconds"
        onclick={() => (autoRefresh = !autoRefresh)}
        ><Radio />Auto {#if autoRefresh}on{:else}off{/if}</Button
      >
      <Button
        variant="outline"
        size="sm"
        aria-label="Refresh"
        disabled={dashboard.state.kind === LoadKind.Loading}
        onclick={() => dashboard.refresh()}
        ><RefreshCw
        />{#if dashboard.reply && dashboard.state.kind === LoadKind.Loading}<span
            role="status">Reading…</span
          >{:else}Refresh{/if}</Button
      >
    </header>
    <div class="space-y-6 p-4 md:p-6">
      {#if !dashboard.reply || dashboard.state.kind === LoadKind.Failed}{@render loadStatus(
          dashboard,
        )}{/if}
      {#if dashboard.reply}
        {@const reply = dashboard.reply}
        {#if reply.content.kind === "Features"}
          <div>
            <h1 class="text-2xl font-semibold tracking-tight">All workflows</h1>
            <p class="mt-1 text-sm text-muted-foreground">
              Your recorded work, from agent assignment to integration. Choose a
              workflow to inspect its lifecycle.
            </p>
          </div>
          <div class="rounded-md border">
            <Table.Root aria-label="Workflows"
              ><Table.Header
                ><Table.Row
                  ><Table.Head>Workflow</Table.Head><Table.Head
                    >Branch</Table.Head
                  ><Table.Head><span class="sr-only">Open</span></Table.Head
                  ></Table.Row
                ></Table.Header
              ><Table.Body>
                {#each reply.content.value.records as feature (feature.id)}<Table.Row
                  >
                    <Table.Cell class="whitespace-normal"
                      ><Button
                        variant="link"
                        class="h-auto p-0 text-left"
                        onclick={() => navigate(feature.id)}
                        ><WorkflowIcon />{feature.id}</Button
                      >
                      <p class="mt-1 max-w-xl text-sm text-muted-foreground">
                        {feature.objective}
                      </p></Table.Cell
                    >
                    <Table.Cell
                      class="whitespace-normal break-all text-xs text-muted-foreground"
                      ><span class="inline-flex items-center gap-1"
                        ><GitBranch
                          class="size-3 shrink-0"
                        />{feature.branch}</span
                      ></Table.Cell
                    >
                    <Table.Cell
                      ><Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Open workflow ${feature.id}`}
                        onclick={() => navigate(feature.id)}
                        ><ArrowRight /></Button
                      ></Table.Cell
                    >
                  </Table.Row>{:else}<Table.Row
                    ><Table.Cell colspan={3} class="py-16 text-center"
                      ><h2 class="font-medium">No workflows recorded yet</h2>
                      <p class="mt-2 text-sm text-muted-foreground">
                        Work recorded by Meta-Cortex will appear here. Refresh
                        to check the ledger.
                      </p></Table.Cell
                    ></Table.Row
                  >{/each}
              </Table.Body></Table.Root
            >
          </div>
          {@render paging(dashboard)}
        {:else if reply.content.kind === "Workflow"}
          {#key reply.content.value.feature.id}<Workflow
              flow={reply.content.value}
              select={(flow: TaskFlow) => choose({ task: flow.task, flow })}
            />{/key}
          {@render paging(dashboard)}
          <p class="text-xs text-muted-foreground">
            Read only · Turso · Observed {new Date(
              reply.content.value.observed_at,
            ).toLocaleString()}
          </p>
        {/if}
      {/if}
    </div>
  </Sidebar.Inset>
</Sidebar.Provider>

<Sheet.Root bind:open={sheetOpen}>
  <Sheet.Content class="overflow-y-auto data-[side=right]:sm:max-w-xl">
    <Sheet.Header>
      <Sheet.Title
        >{#if showingHistory && (inspector.state.request.kind === "History" || inspector.state.request.kind === "Task")}{inspector
            .state.request.query.task}{:else}{record?.task.common.id ??
            "Recorded history"}{/if}</Sheet.Title
      >
      <Sheet.Description
        >Task lifecycle, contributions and recorded evidence.</Sheet.Description
      >
    </Sheet.Header>
    <div class="space-y-4 px-4 pb-4">
      {#if showingHistory}
        {@render loadStatus(inspector)}
        {#if inspector.state.kind === LoadKind.Ready && inspector.state.reply.content.kind === "History"}
          <h2 class="font-semibold">Recorded history</h2>
          {@render paging(inspector)}
          <Accordion.Root type="multiple">
            {#each inspector.state.reply.content.value.records as event (event.task.common.revision)}
              <Accordion.Item value={String(event.task.common.revision)}
                ><Accordion.Trigger
                  >{event.kind} · {event.actor.team} / {event.actor.role} · attempt
                  {event.task.common.attempt} · revision {event.task.common
                    .revision}</Accordion.Trigger
                ><Accordion.Content>
                  <p>{event.note}</p>
                  <p class="my-2 text-xs text-muted-foreground">
                    {new Date(event.task.common.last_update).toLocaleString()}
                  </p>
                  <Button
                    variant="link"
                    onclick={() => choose({ task: event.task })}
                    >View task snapshot</Button
                  >
                  <pre
                    class="whitespace-pre-wrap break-all text-xs">{JSON.stringify(
                      event,
                      null,
                      2,
                    )}</pre>
                </Accordion.Content></Accordion.Item
              >
            {/each}
          </Accordion.Root>
          {#if inspector.state.reply.selection.view.kind === "History"}
            {@const query = inspector.state.reply.selection.view.query}
            <Button
              variant="outline"
              onclick={() => inspector.load({ kind: "Task", query })}
              >Latest task record</Button
            >
          {/if}
        {/if}
      {:else if record}<RecordedTask
          task={record.task}
          flow={record.flow}
          {history}
        />{/if}
    </div>
  </Sheet.Content>
</Sheet.Root>

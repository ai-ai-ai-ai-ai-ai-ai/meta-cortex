<script lang="ts">
  import { onMount } from "svelte";
  import type { ChangeEventHandler } from "svelte/elements";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import * as Accordion from "$lib/components/ui/accordion";
  import { Button } from "$lib/components/ui/button";
  import { DashboardController, LoadKind } from "./dashboard-state.svelte";
  import { DashboardApi } from "./api";
  import { SelectionKind, type TaskSelection } from "./agent-tree";
  import type { TaskV2 } from "./contracts";
  import DataTable from "./DataTable.svelte";
  import { reportingRows } from "./agent-tree";
  import { Progress } from "$lib/components/ui/progress";
  import { summarizeCounts } from "./progress-presentation";
  import RecordedTask from "./RecordedTask.svelte";
  const dashboard = new DashboardController(new DashboardApi());
  let selected = $state<TaskSelection | null>(null);
  let sheetOpen = $state(false);
  let showingHistory = $state(false);
  onMount(() => {
    dashboard.load({ kind: "Initial" });
    return () => dashboard.stop();
  });
  function choose(selection: TaskSelection) {
    selected = selection;
    showingHistory = false;
    sheetOpen = true;
  }
  function history(task: TaskV2) {
    dashboard.load({
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
      case LoadKind.Ready:
        switch (dashboard.state.reply.content.kind) {
          case "Task":
            selected = {
              kind: SelectionKind.Task,
              task: dashboard.state.reply.content.value,
            };
            showingHistory = false;
            sheetOpen = true;
            return;
          case "History":
            showingHistory = true;
            sheetOpen = true;
            return;
          case "Features":
          case "Workflow":
            return;
        }
    }
  });
  const changeFeature: ChangeEventHandler<HTMLSelectElement> = (event) =>
    dashboard.load({
      kind: "Workflow",
      feature: event.currentTarget.value,
      page: 0,
    });
  let record = $derived.by(() => {
    switch (selected?.kind) {
      case SelectionKind.Task:
        return { task: selected.task, flow: undefined };
      case SelectionKind.Activity:
        return { task: selected.task.task, flow: selected.task };
      case undefined:
        return undefined;
    }
  });
  let pageEnd = $derived.by(() => {
    switch (dashboard.state.kind) {
      case LoadKind.Loading:
      case LoadKind.Failed:
        return "Complete";
      case LoadKind.Ready:
        switch (dashboard.state.reply.content.kind) {
          case "Task":
            return "Complete";
          case "Workflow":
            return dashboard.state.reply.content.value.tasks.end;
          case "Features":
          case "History":
            return dashboard.state.reply.content.value.end;
        }
    }
  });
</script>

{#snippet loadStatus()}
  {#if dashboard.state.kind === LoadKind.Loading}<p>Reading recorded work…</p>
  {:else if dashboard.state.kind === LoadKind.Failed}<p>
      {dashboard.state.failure.message}
    </p>
    <Button onclick={() => dashboard.load(dashboard.state.request)}
      >Retry</Button
    >{/if}
{/snippet}

{#snippet paging()}
  {#if dashboard.state.kind === LoadKind.Ready}
    {@const page = dashboard.state.reply.selection.page}
    <footer class="flex items-center gap-3">
      <span>Page {page + 1}</span>
      <Button
        variant="outline"
        disabled={page === 0}
        onclick={() => dashboard.page(page - 1)}>Previous</Button
      >
      <Button
        variant="outline"
        disabled={pageEnd === "Complete"}
        onclick={() => dashboard.page(page + 1)}>Next</Button
      >
    </footer>
  {/if}
{/snippet}

<Sheet.Root bind:open={sheetOpen}>
  <main class="mx-auto max-w-6xl space-y-6 p-6">
    <header class="flex flex-wrap items-center gap-3">
      <h1 class="mr-auto text-2xl font-semibold">Workbench</h1>
      <NativeSelect.Root
        aria-label="Features"
        value={dashboard.currentFeature()}
        onchange={changeFeature}
      >
        <NativeSelect.Option value="" disabled
          >Choose a feature</NativeSelect.Option
        >
        {#each dashboard.features as feature (feature.id)}<NativeSelect.Option
            value={feature.id}
            title={`${feature.objective} · Branch ${feature.branch}`}
            >{feature.id}</NativeSelect.Option
          >{/each}
      </NativeSelect.Root>
      <Button
        variant="outline"
        onclick={() => dashboard.load({ kind: "Features", page: 0 })}
        >Features</Button
      >
      <Button
        variant="outline"
        onclick={() => dashboard.load(dashboard.state.request)}>Refresh</Button
      >
    </header>
    <p class="text-sm text-muted-foreground">
      Read only · Turso · refresh to observe changes
    </p>
    {#if !sheetOpen}{@render loadStatus()}{/if}
    {#if dashboard.state.kind === LoadKind.Ready}
      {@const reply = dashboard.state.reply}
      {#if reply.content.kind === "Features"}
        <h2 class="text-xl font-semibold">Choose a feature</h2>
        <p>
          Choose a recorded feature above to view its objective, branch and
          activities.
        </p>
      {:else if reply.content.kind === "Workflow"}
        {@const flow = reply.content.value}
        {@const progress = summarizeCounts(flow.counts)}
        <h2 class="text-xl font-semibold">{flow.feature.id}</h2>
        <p>{flow.feature.objective}</p>
        <p>
          Branch · {flow.feature.branch} · Worktree · {flow.feature.worktree} · version
          {flow.feature.version}
        </p>
        <p class="text-sm text-muted-foreground">
          Observed · {new Date(flow.observed_at).toLocaleString()}
        </p>
        <p>
          Feature total · {progress.finished}/{progress.total} finished · {progress.visible
            .map((item) => `${item.count} ${item.state}`)
            .join(" · ")}
        </p>
        <Progress
          value={progress.finished}
          max={Math.max(1, progress.total)}
          aria-label="Feature progress"
        />
        <p class="text-sm text-muted-foreground">
          Recorded reporting links · own and descendant activities on this
          loaded page. Historical activities use Created by when reporting is
          unrecorded.
        </p>
        {#key dashboard.currentFeature()}
          <DataTable rows={reportingRows(flow.tasks.records)} select={choose} />
        {/key}
      {:else if reply.content.kind === "Task" || reply.content.kind === "History"}
        <Button
          variant="outline"
          onclick={() =>
            dashboard.load({
              kind: "Workflow",
              feature: dashboard.currentFeature(),
              page: 0,
            })}>Back to workflow</Button
        >
        <Sheet.Trigger>
          {#snippet child({ props })}<Button variant="outline" {...props}
              >Open recorded details</Button
            >{/snippet}
        </Sheet.Trigger>
      {/if}
      {#if reply.content.kind !== "Task" && reply.content.kind !== "History"}{@render paging()}{/if}
    {/if}
  </main>
  <Sheet.Content class="overflow-y-auto">
    <Sheet.Header>
      <Sheet.Title
        >{#if showingHistory && dashboard.state.request.kind === "History"}{dashboard
            .state.request.query.task}{:else}{record?.task.common.id ??
            "Recorded history"}{/if}</Sheet.Title
      >
      <Sheet.Description
        >Recorded task fields and ledger evidence.</Sheet.Description
      >
    </Sheet.Header>
    <div class="space-y-4 px-4 pb-4">
      {@render loadStatus()}
      {#if showingHistory && dashboard.state.kind === LoadKind.Ready && dashboard.state.reply.content.kind === "History"}
        <h2 class="font-semibold">Recorded history</h2>
        {@render paging()}
        <Accordion.Root type="multiple">
          {#each dashboard.state.reply.content.value.records as event (event.task.common.revision)}
            <Accordion.Item value={String(event.task.common.revision)}
              ><Accordion.Trigger
                >{event.kind} · {event.actor.team} / {event.actor.role} · attempt
                {event.task.common.attempt} · revision {event.task.common
                  .revision}</Accordion.Trigger
              ><Accordion.Content
                ><p>{event.note}</p>
                <p>
                  {new Date(event.task.common.last_update).toLocaleString()}
                </p>
                <Button
                  variant="link"
                  onclick={() =>
                    choose({ kind: SelectionKind.Task, task: event.task })}
                  >View task snapshot</Button
                >
                <pre class="whitespace-pre-wrap break-all">{JSON.stringify(
                    event,
                    null,
                    2,
                  )}</pre></Accordion.Content
              ></Accordion.Item
            >
          {/each}
        </Accordion.Root>
        {#if dashboard.state.request.kind === "History"}
          {@const query = dashboard.state.request.query}
          <Button
            variant="outline"
            onclick={() => dashboard.load({ kind: "Task", query })}
            >Latest task record</Button
          >
        {/if}
      {:else if record && !showingHistory}<RecordedTask
          task={record.task}
          flow={record.flow}
          {history}
        />{/if}
    </div>
  </Sheet.Content>
</Sheet.Root>

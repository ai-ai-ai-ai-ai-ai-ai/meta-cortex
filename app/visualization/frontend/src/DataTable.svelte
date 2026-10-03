<script lang="ts">
  import {
    createTable,
    createColumnHelper,
    tableFeatures,
    rowExpandingFeature,
    createExpandedRowModel,
    FlexRender,
    renderSnippet,
    type Row,
  } from "@tanstack/svelte-table";
  import { ChevronDown, ChevronRight, Bot, ListTodo } from "@lucide/svelte";
  import * as Table from "$lib/components/ui/table";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { Progress } from "$lib/components/ui/progress";
  import { WorkTiming } from "./execution-presentation";
  import { TaskPresentation } from "./task-presentation";
  import type { ReportingTree } from "./agent-tree";
  import type { TaskFlow } from "./contracts";
  interface DataTableProperties {
    root: ReportingTree;
    select: (flow: TaskFlow) => void;
  }
  let { root, select }: DataTableProperties = $props();
  const features = tableFeatures({
    rowExpandingFeature,
    expandedRowModel: createExpandedRowModel(),
  });
  type TableRow = Row<typeof features, ReportingTree>;
  function expansionLabel(row: TableRow): string {
    switch (row.getIsExpanded()) {
      case true:
        return `Collapse ${row.original.data.label}`;
      case false:
        return `Expand ${row.original.data.label}`;
    }
  }
  function initialExpanded(): Record<string, boolean> {
    return Object.fromEntries(
      root
        .descendants()
        .filter((node) => node.data.expandInitially)
        .map((node) => [node.data.id, true]),
    );
  }
  const helper = createColumnHelper<typeof features, ReportingTree>();
  const columns = helper.columns([
    helper.accessor("data.label", {
      header: "Reporting / activity",
      cell: ({ row }) => renderSnippet(identity, row),
    }),
    helper.accessor("data.status", {
      header: "Status",
      cell: ({ row }) => renderSnippet(status, row),
    }),
    helper.accessor("data.ownCounts", {
      header: "Progress",
      cell: ({ row }) => renderSnippet(progress, row),
    }),
    helper.accessor("data.checkpoint", {
      header: "Attempts / commits",
      cell: ({ row }) => renderSnippet(evidence, row),
    }),
  ]);
  const table = createTable({
    features,
    get data() {
      return root.children ?? [];
    },
    columns,
    initialState: { expanded: initialExpanded() },
    getRowId: (row) => row.data.id,
    getSubRows: (row) => row.children,
  });
</script>

{#snippet identity(row: TableRow)}
  {@const activity = row.original.data.activities[0]}
  <div
    class="flex min-w-0 items-center gap-2"
    style:padding-inline-start={`${row.depth}rem`}
  >
    {#if row.getCanExpand()}<Button
        variant="ghost"
        size="icon-sm"
        aria-label={expansionLabel(row)}
        aria-expanded={row.getIsExpanded()}
        onclick={row.getToggleExpandedHandler()}
        >{#if row.getIsExpanded()}<ChevronDown />{:else}<ChevronRight
          />{/if}</Button
      >{/if}
    {#if row.getCanExpand()}<Bot
        class="size-4 shrink-0 text-muted-foreground"
      />{:else}<ListTodo class="size-4 shrink-0 text-muted-foreground" />{/if}
    <div class="min-w-0">
      {#if activity}<Button
          variant="link"
          class="h-auto max-w-full justify-start p-0 text-left"
          aria-label={`Open task ${activity.task.common.id}`}
          onclick={() => select(activity)}
        >
          <span class="truncate">{row.original.data.label}</span>
        </Button>
        <p
          class="max-w-sm truncate text-xs text-muted-foreground"
          title={activity.task.common.objective}
        >
          {activity.task.common.objective}
        </p>
        {#if row.original.data.summary}<p
            class="mt-1 max-w-lg truncate text-xs"
            title={row.original.data.summary}
          >
            {row.original.data.summary}
          </p>{/if}
        {#if row.original.data.attempt}<p
            class="mt-1 text-xs text-muted-foreground"
          >
            {WorkTiming.date(row.original.data.attempt.updated_at)}
          </p>{/if}
      {:else}<span
          class="block truncate font-medium"
          title={row.original.data.label}>{row.original.data.label}</span
        >
        {#if row.original.data.summary}<p
            class="mt-1 max-w-sm truncate text-xs text-muted-foreground"
            title={row.original.data.summary}
          >
            {row.original.data.summary}
          </p>{/if}
      {/if}
    </div>
  </div>
{/snippet}
{#snippet status(row: TableRow)}
  {@const activity = row.original.data.activities[0]}
  {#if row.original.data.attempt}<Badge variant="outline"
      >{row.original.data.status}</Badge
    >
  {:else if activity}<Badge
      variant="secondary"
      class={TaskPresentation.tones[TaskPresentation.status(activity.task)]}
      >{row.original.data.status}</Badge
    >
  {:else if row.original.data.past.length}<span
      class="text-xs text-muted-foreground">Earlier attempts</span
    >
  {:else if row.original.data.status}<span
      class="text-xs text-muted-foreground"
      title={row.original.data.status}>Reporting only</span
    >{/if}
{/snippet}
{#snippet progress(row: TableRow)}
  <div class="space-y-2 text-xs">
    {#if row.original.data.total && !row.original.data.attempt}<Progress
        value={row.original.data.finished}
        max={row.original.data.total}
        aria-label={`${row.original.data.label} task progress`}
      />{/if}
    {#if row.original.data.ownCounts}<p>
        Own · {row.original.data.ownCounts}
      </p>{/if}
    {#if row.original.data.descendantCounts}<p class="text-muted-foreground">
        Team · {row.original.data.descendantCounts}
      </p>{/if}
  </div>
{/snippet}
{#snippet evidence(row: TableRow)}
  {@const data = row.original.data}
  <div class="space-y-1 text-xs text-muted-foreground">
    {#if data.activities.length || data.past.length}
      <p>
        {data.attemptCount}
        {#if data.attemptCount === 1}attempt{:else}attempts{/if}
      </p>
      <p>
        {data.commitCount} linked {#if data.commitCount === 1}commit{:else}commits{/if}
      </p>
      {#if data.activities.some((flow) => flow.history_end === "More") || data.past.some(({ flow }) => flow.history_end === "More")}<span
          >Recent history only</span
        >{/if}
    {/if}
    {#if !data.attempt && data.checkpoint !== "Unrecorded"}<span
        class="font-mono">{data.checkpoint}</span
      >{/if}
  </div>
{/snippet}
<div class="rounded-md border">
  <Table.Root
    class="table-fixed [&_th:first-child]:w-1/2"
    aria-label="Recorded reporting and activities"
  >
    <Table.Header
      >{#each table.getHeaderGroups() as group (group.id)}<Table.Row
          >{#each group.headers as header (header.id)}<Table.Head
              >{#if !header.isPlaceholder}<FlexRender
                  {header}
                />{/if}</Table.Head
            >{/each}</Table.Row
        >{/each}</Table.Header
    >
    <Table.Body
      >{#each table.getRowModel().rows as row (row.id)}<Table.Row
          >{#each row.getAllCells() as cell (cell.id)}<Table.Cell
              class="whitespace-normal"><FlexRender {cell} /></Table.Cell
            >{/each}</Table.Row
        >{:else}<Table.Row
          ><Table.Cell colspan={columns.length}
            >No recorded activities on this page.</Table.Cell
          ></Table.Row
        >{/each}</Table.Body
    >
  </Table.Root>
</div>

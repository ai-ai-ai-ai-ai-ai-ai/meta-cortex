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
      header: "Checkpoint",
      cell: ({ getValue }) => renderSnippet(checkpoint, getValue()),
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
      {:else}<span class="font-medium">{row.original.data.label}</span>{/if}
    </div>
  </div>
{/snippet}
{#snippet status(row: TableRow)}
  {@const activity = row.original.data.activities[0]}
  {#if activity}<Badge
      variant="secondary"
      class={TaskPresentation.tones[TaskPresentation.status(activity.task)]}
      >{row.original.data.status}</Badge
    >
  {:else if row.original.data.status}<span
      class="text-xs text-muted-foreground"
      title={row.original.data.status}>Reporting only</span
    >{/if}
{/snippet}
{#snippet progress(row: TableRow)}
  <div class="text-xs">
    {#if row.original.data.ownCounts}<p>
        Own · {row.original.data.ownCounts}
      </p>{/if}
    {#if row.original.data.descendantCounts}<p class="text-muted-foreground">
        Team · {row.original.data.descendantCounts}
      </p>{/if}
  </div>
{/snippet}
{#snippet checkpoint(value: string)}<span
    class="font-mono text-xs text-muted-foreground">{value}</span
  >{/snippet}
<div class="rounded-md border">
  <Table.Root aria-label="Recorded reporting and activities">
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
              ><FlexRender {cell} /></Table.Cell
            >{/each}</Table.Row
        >{:else}<Table.Row
          ><Table.Cell colspan={columns.length}
            >No recorded activities on this page.</Table.Cell
          ></Table.Row
        >{/each}</Table.Body
    >
  </Table.Root>
</div>

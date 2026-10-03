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
  import { ChevronDown, ChevronRight } from "@lucide/svelte";
  import * as Table from "$lib/components/ui/table";
  import { Button } from "$lib/components/ui/button";
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
    helper.accessor("data.status", { header: "Own status" }),
    helper.accessor("data.ownCounts", { header: "Own activities" }),
    helper.accessor("data.descendantCounts", {
      header: "Descendant activities · loaded page",
    }),
    helper.accessor("data.workspace", { header: "Workspace / branch" }),
    helper.accessor("data.checkpoint", { header: "Checkpoint" }),
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
        size="icon"
        aria-label={expansionLabel(row)}
        aria-expanded={row.getIsExpanded()}
        onclick={row.getToggleExpandedHandler()}
        >{#if row.getIsExpanded()}<ChevronDown />{:else}<ChevronRight
          />{/if}</Button
      >{/if}
    {#if activity}<Button
        variant="link"
        class="h-auto min-w-0 shrink whitespace-normal text-left"
        aria-label={`Open task ${activity.task.common.id}`}
        onclick={() => select(activity)}>{row.original.data.label}</Button
      >{:else}{row.original.data.label}{/if}
  </div>
{/snippet}
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

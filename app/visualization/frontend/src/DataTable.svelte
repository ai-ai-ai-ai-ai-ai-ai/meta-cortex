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
  import type { ReportingTableRow, TaskSelection } from "./agent-tree";
  interface DataTableProperties {
    rows: ReportingTableRow[];
    select: (selection: TaskSelection) => void;
  }
  let { rows, select }: DataTableProperties = $props();
  const features = tableFeatures({
    rowExpandingFeature,
    expandedRowModel: createExpandedRowModel(),
  });
  type TableRow = Row<typeof features, ReportingTableRow>;
  function expansionLabel(row: TableRow): string {
    switch (row.getIsExpanded()) {
      case true:
        return `Collapse ${row.original.label}`;
      case false:
        return `Expand ${row.original.label}`;
    }
  }
  function initialExpanded(): Record<string, boolean> {
    const expanded: Record<string, boolean> = {};
    const pending = [...rows];
    for (const row of pending) {
      switch (row.expandInitially) {
        case true:
          expanded[row.id] = true;
          break;
        case false:
          break;
      }
      pending.push(...row.subRows);
    }
    return expanded;
  }
  const helper = createColumnHelper<typeof features, ReportingTableRow>();
  const columns = helper.columns([
    helper.accessor("label", {
      header: "Reporting / activity",
      cell: ({ row }) => renderSnippet(identity, row),
    }),
    helper.accessor("status", { header: "Own status" }),
    helper.accessor("ownCounts", { header: "Own activities" }),
    helper.accessor("descendantCounts", {
      header: "Descendant activities · loaded page",
    }),
    helper.accessor("workspace", { header: "Workspace / branch" }),
    helper.accessor("checkpoint", { header: "Checkpoint" }),
  ]);
  const table = createTable({
    features,
    get data() {
      return rows;
    },
    columns,
    initialState: { expanded: initialExpanded() },
    getRowId: (row) => row.id,
    getSubRows: (row) => row.subRows,
  });
</script>

{#snippet identity(row: TableRow)}
  {@const selection = row.original.selection}
  <div
    class="flex items-center gap-2"
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
    {#if selection}<Button
        variant="link"
        class="whitespace-normal text-left"
        aria-label={row.original.actionLabel}
        onclick={() => select(selection)}>{row.original.label}</Button
      >{:else}{row.original.label}{/if}
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

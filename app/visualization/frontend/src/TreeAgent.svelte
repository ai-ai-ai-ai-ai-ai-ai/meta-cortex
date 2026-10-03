<script lang="ts">
  import * as Table from "$lib/components/ui/table";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import {
    SelectionKind,
    type AgentContribution,
    type TaskSelection,
  } from "./agent-tree";
  import { TaskPresentation } from "./task-presentation";
  interface TreeAgentProperties {
    group: AgentContribution;
    select: (selection: TaskSelection) => void;
  }
  let { group, select }: TreeAgentProperties = $props();
</script>

<Table.Root>
  <Table.Caption
    >{group.name()} · {group.summary()} · own activities on this page</Table.Caption
  >
  <Table.Header
    ><Table.Row
      ><Table.Head>Activity</Table.Head><Table.Head>Status</Table.Head
      ><Table.Head>Workspace</Table.Head></Table.Row
    ></Table.Header
  >
  <Table.Body>
    {#each group.tasks as task (task.task.common.id)}
      {@const display = TaskPresentation.describe(task.task)}
      <Table.Row>
        <Table.Cell
          ><Button
            variant="link"
            onclick={() => select({ kind: SelectionKind.Activity, task })}
            >{task.task.common.objective}</Button
          ></Table.Cell
        >
        <Table.Cell
          ><Badge variant="secondary">{display.statusLabel}</Badge></Table.Cell
        >
        <Table.Cell>{display.workspaceLabel}</Table.Cell>
      </Table.Row>
    {/each}
  </Table.Body>
</Table.Root>

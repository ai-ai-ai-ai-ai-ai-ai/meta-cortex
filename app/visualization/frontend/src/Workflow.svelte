<script lang="ts">
  import type { ChangeEventHandler } from "svelte/elements";
  import * as Tabs from "$lib/components/ui/tabs";
  import * as NativeSelect from "$lib/components/ui/native-select";
  import { Button } from "$lib/components/ui/button";
  import { SvelteFlow, Background, Controls } from "@xyflow/svelte";
  import type { FeatureFlow, TaskV2 } from "./contracts";
  import {
    FlowPresentation,
    FlowView,
    GraphKind,
    NodeKind,
    workflowViews,
    type DiagramNode,
  } from "./workflow";
  import {
    ActivityKind,
    SelectionKind,
    type TaskSelection,
  } from "./agent-tree";
  import AgentTree from "./AgentTree.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  interface WorkflowProperties {
    flow: FeatureFlow;
    select: (selection: TaskSelection) => void;
    history: (task: TaskV2) => void;
  }
  let { flow, select, history }: WorkflowProperties = $props();
  let view = $state<FlowView>(FlowView.Tree);
  let graphKind = $state<GraphKind>(GraphKind.Agents);
  let presentation = $derived(new FlowPresentation(flow));
  let diagram = $derived.by(() => {
    switch (view) {
      case FlowView.Git:
        return presentation.git();
      case FlowView.Tree:
      case FlowView.History:
      case FlowView.Agents:
        return presentation.diagram(graphKind);
    }
  });
  function changeView(value: string) {
    switch (value) {
      case "tree":
        view = FlowView.Tree;
        return;
      case "graph":
        view = FlowView.Agents;
        return;
      case "git":
        view = FlowView.Git;
        return;
      case "history":
        view = FlowView.History;
        return;
    }
  }
  function changeGraph(value: string) {
    switch (value) {
      case "agents":
        graphKind = GraphKind.Agents;
        return;
      case "dependencies":
        graphKind = GraphKind.Tasks;
        return;
    }
  }
  const selectGraph: ChangeEventHandler<HTMLSelectElement> = (event) =>
    changeGraph(event.currentTarget.value);
  interface DiagramSelectionEvent {
    node: DiagramNode;
  }
  function selectNode({ node }: DiagramSelectionEvent) {
    switch (node.data.kind) {
      case NodeKind.Branch:
        return;
      case NodeKind.Agent:
        switch (node.data.activity.kind) {
          case ActivityKind.Absent:
            return;
          case ActivityKind.Recorded: {
            const group = node.data.activity.group;
            select({
              kind: SelectionKind.Activity,
              task: group.latest(),
            });
            return;
          }
        }
        break;
      case NodeKind.Task:
        select({ kind: SelectionKind.Activity, task: node.data.task });
        return;
    }
  }
</script>

<section class="space-y-4">
  <h2 class="text-xl font-semibold">{flow.feature.id}</h2>
  <p>{flow.feature.objective}</p>
  <p class="text-sm text-muted-foreground">
    Feature branch · {flow.feature.branch}
  </p>
  <ProgressSummary counts={flow.counts} />
  <Tabs.Root value={view} onValueChange={changeView}>
    <Tabs.List aria-label="Workflow views"
      >{#each workflowViews as item (item)}<Tabs.Trigger value={item}
          >{item}</Tabs.Trigger
        >{/each}</Tabs.List
    >
    <Tabs.Content value={view}>
      {#if view === FlowView.Tree}<AgentTree
          tasks={flow.tasks.records}
          {select}
        />
      {:else if view === FlowView.History}
        <div class="space-y-2">
          {#each presentation.activity() as item (`${item.task.common.id}:${item.event.revision}`)}<Button
              variant="link"
              onclick={() => history(item.task)}
              >{item.event.kind} · {item.task.common.id} · {item.event.actor
                .role} · {new Date(item.event.at).toLocaleString()}</Button
            >{/each}
        </div>
      {:else}
        {#if view === FlowView.Agents}
          <NativeSelect.Root
            aria-label="Graph relationships"
            value={graphKind}
            onchange={selectGraph}
          >
            {#each Object.values(GraphKind) as kind (kind)}<NativeSelect.Option
                value={kind}>{kind}</NativeSelect.Option
              >{/each}
          </NativeSelect.Root>
        {/if}
        <div class="h-96">
          {#key `${view}:${graphKind}`}<SvelteFlow
              nodes={diagram.nodes}
              edges={diagram.edges}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              onnodeclick={selectNode}
              ><Background /><Controls showLock={false} /></SvelteFlow
            >{/key}
        </div>
      {/if}
    </Tabs.Content>
  </Tabs.Root>
</section>

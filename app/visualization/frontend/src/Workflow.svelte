<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import { Dialog } from "bits-ui";
  import { Option } from "effect";
  import { MediaQuery } from "svelte/reactivity";
  import * as Card from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { SvelteFlow, Background, Controls, MiniMap } from "@xyflow/svelte";
  import type { FeatureFlow, TaskV2 } from "./contracts";
  import { FlowPresentation, FlowView, GraphKind, NodeKind } from "./workflow";
  import type { DiagramNode } from "./workflow";
  import { AgentContribution, ActivityKind } from "./agent-tree";
  import type { AgentSelection } from "./agent-tree";
  import AgentTree from "./AgentTree.svelte";
  import AgentInspector from "./AgentInspector.svelte";
  import RecordNode from "./RecordNode.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  interface WorkflowProperties {
    flow: FeatureFlow;
    select: (task: TaskV2) => void;
    history: (task: TaskV2) => void;
    refresh: () => void;
  }
  let { flow, select, history, refresh }: WorkflowProperties = $props();
  let view = $state<FlowView>(FlowView.Tree);
  let graphKind = $state<GraphKind>(GraphKind.Agents);
  let selection = $state<Option.Option<AgentSelection>>(Option.none());
  let inspectorOpen = $state(false);
  const narrow = new MediaQuery("(max-width: 1100px)");
  let presentation = $derived(new FlowPresentation(flow));
  let diagram = $derived.by(() => {
    switch (view) {
      case FlowView.Tree:
      case FlowView.History:
        return { nodes: [], edges: [] };
      case FlowView.Git:
        return presentation.git();
      case FlowView.Agents:
        return presentation.diagram(graphKind);
    }
  });
  function open(next: AgentSelection) {
    selection = Option.some(next);
    inspectorOpen = true;
  }
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
            const selection: AgentSelection = {
              group,
              task: group.latest(),
              origin: `view-${view}`,
            };
            open(selection);
            return;
          }
        }
        break;
      case NodeKind.Task:
        for (const item of node.data.tasks) {
          const group = new AgentContribution(node.data.actor, [
            item,
            ...node.data.tasks.slice(1),
          ]);
          const selection: AgentSelection = {
            group,
            task: group.latest(),
            origin: `view-${view}`,
          };
          open(selection);
          return;
        }
    }
  }
  function changeView(value: string) {
    switch (value) {
      case "tree":
        view = FlowView.Tree;
        break;
      case "graph":
        view = FlowView.Agents;
        break;
      case "git":
        view = FlowView.Git;
        break;
      case "history":
        view = FlowView.History;
        break;
    }
    inspectorOpen = false;
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
</script>

<header
  class="app-header workflow-header flex items-center justify-between gap-[22px] px-[25px] pt-[25px] pb-[19px] max-[1100px]:flex-wrap max-[1100px]:gap-4 max-[800px]:px-[22px] max-[800px]:pt-6 max-[620px]:gap-2.5 max-[620px]:px-4 max-[620px]:pt-[23px] max-[620px]:pb-[17px]"
>
  <div
    class="workflow-heading min-w-0 flex-1 [&_h1]:text-[25px] [&_h1]:tracking-[-.65px] [&_h1]:[overflow-wrap:anywhere] max-[800px]:[&_h1]:text-[23px] max-[620px]:[&_h1]:text-xl"
  >
    <h1 class="font-bold" title={flow.feature.id}>
      {FlowPresentation.label(flow.feature.id)}
    </h1>
    <p class="mt-[7px] text-[13px] text-muted-foreground">
      Recorded work · Turso
    </p>
  </div>
  <ProgressSummary
    counts={flow.counts}
    class="max-[1100px]:order-3 max-[1100px]:flex max-[1100px]:w-full max-[1100px]:items-center max-[1100px]:gap-[15px] max-[1100px]:[&_.progress-meter]:m-0 max-[1100px]:[&_.progress-meter]:ml-auto max-[1100px]:[&_.progress-meter]:min-w-[140px] max-[1100px]:[&_.progress-meter]:max-w-[250px] max-[1100px]:[&_.progress-meter]:flex-1 max-[620px]:block max-[620px]:[&_.progress-meter]:mt-[7px] max-[620px]:[&_.progress-meter]:max-w-none"
  />
  <Button variant="dashboard" class="button" onclick={refresh}
    ><span aria-hidden="true">↻</span> Refresh</Button
  >
</header>
<Dialog.Root bind:open={inspectorOpen}>
  <Tabs.Root
    value={view}
    onValueChange={changeView}
    class="workflow-overview px-[25px] pb-5 max-[800px]:px-[22px] max-[800px]:pt-1 max-[620px]:px-4"
    aria-label="Feature workflow"
  >
    <Tabs.List
      class="workflow-tabs mb-[22px] flex justify-start gap-[7px] rounded-none border-b border-border bg-transparent p-0 max-[620px]:gap-[3px]"
      aria-label="Workflow views"
    >
      {#each Object.values(FlowView) as item (item)}
        <Tabs.Trigger
          value={item}
          id={`view-${item}`}
          class="h-auto min-h-11 rounded-none border-0 border-b-2 border-transparent bg-transparent px-[15px] pt-2.5 pb-[13px] text-sm font-normal text-muted-foreground capitalize shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:font-medium max-[620px]:px-3 max-[620px]:text-xs"
          >{item}</Tabs.Trigger
        >
      {/each}
    </Tabs.List>
    <div
      class="workflow-workspace group relative grid grid-cols-[minmax(0,1fr)] items-start data-[inspector=true]:min-[1101px]:grid-cols-[minmax(0,1fr)_340px] data-[inspector=true]:min-[1101px]:gap-[22px] data-[inspector=true]:min-[1101px]:max-[1350px]:grid-cols-[minmax(0,1fr)_330px] data-[inspector=true]:min-[1101px]:max-[1350px]:gap-4"
      data-inspector={inspectorOpen}
    >
      <Tabs.Content value={view} class="workflow-primary min-w-0 mt-0">
        {#if view === FlowView.Tree}<AgentTree
            tasks={flow.tasks.records}
            selection={Option.filter(selection, () => inspectorOpen)}
            select={open}
          />
        {:else if view === FlowView.History}
          <Card.Root
            class="feature-history gap-0 rounded-[6px] border border-border p-5 shadow-none ring-0 max-[620px]:p-[15px] [&_h2]:mb-5 [&_h2]:text-[19px]"
            role="region"
            aria-label="Recent recorded history"
          >
            <h2 class="font-bold">Recent activity</h2>
            {#each presentation.activity() as item (`${item.task.common.id}:${item.event.revision}`)}<Button
                variant="ghost"
                class="h-auto min-h-[70px] w-full justify-start gap-3 rounded-none border-t border-border bg-transparent px-1 py-[15px] text-left whitespace-normal hover:bg-secondary [&_strong]:block [&_strong]:text-[13px] [&_strong]:font-medium [&_div>span]:mt-[5px] [&_div>span]:block [&_div>span]:text-[11px] [&_div>span]:text-muted-foreground [&_time]:ml-auto [&_time]:text-[10px] [&_time]:text-muted-foreground max-[620px]:[&_time]:text-[9px]"
                onclick={() => history(item.task)}
                ><span
                  class="event-icon text-2xl text-primary"
                  data-event={item.event.kind}
                  aria-hidden="true">↳</span
                >
                <div>
                  <strong>{FlowPresentation.action(item.event)}</strong><span
                    >{item.task.common.id} · {item.event.actor.role}</span
                  >
                </div>
                <time>{new Date(item.event.at).toLocaleString()}</time></Button
              >{/each}
          </Card.Root>
        {:else}
          <Tabs.Root value={graphKind} onValueChange={changeGraph}>
            {#if view === FlowView.Agents}<div
                class="graph-toolbar flex items-center justify-between rounded-t-[6px] border border-border p-3 text-[11px] text-muted-foreground max-[620px]:flex-wrap max-[620px]:gap-2.5 [&>div]:flex [&>div]:gap-2"
              >
                <span>Recorded relationships</span>
                <Tabs.List class="h-auto gap-2 bg-transparent p-0">
                  {#each Object.values(GraphKind) as kind (kind)}<Tabs.Trigger
                      value={kind}
                      class="h-auto min-h-[30px] px-2.5 py-1.5 text-[10px] capitalize border border-border data-[state=active]:border-primary data-[state=active]:text-primary"
                      >{kind}</Tabs.Trigger
                    >{/each}
                </Tabs.List>
              </div>{/if}
            <Tabs.Content
              value={graphKind}
              class="flow-canvas mt-0 h-[540px] min-w-0 overflow-hidden rounded-[6px] border border-border bg-canvas max-[620px]:h-[420px]"
            >
              {#key `${view}:${graphKind}`}<SvelteFlow
                  nodes={diagram.nodes}
                  edges={diagram.edges}
                  nodeTypes={{ record: RecordNode }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  edgesFocusable={false}
                  colorMode="dark"
                  fitView
                  fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
                  minZoom={0.2}
                  onnodeclick={selectNode}
                  ><Background gap={22} size={1} /><Controls
                    showLock={false}
                  /><MiniMap pannable zoomable /></SvelteFlow
                >{/key}
            </Tabs.Content>
          </Tabs.Root>
        {/if}
      </Tabs.Content>
      <Dialog.Overlay
        class="drawer-backdrop fixed inset-0 z-20 hidden bg-backdrop max-[1100px]:block"
      />
      <Dialog.Content
        trapFocus={narrow.current}
        preventScroll={narrow.current}
        onInteractOutside={(event) => {
          switch (narrow.current) {
            case false:
              event.preventDefault();
              return;
            case true:
              return;
          }
        }}
        onCloseAutoFocus={(event) => {
          switch (selection._tag) {
            case "None":
              return;
            case "Some":
              event.preventDefault();
              document.getElementById(selection.value.origin)?.focus();
          }
        }}
      >
        {#snippet child({ props })}
          <aside
            {...props}
            role="dialog"
            aria-modal={narrow.current}
            class="agent-inspector sticky top-4 flex max-h-[calc(100dvh-185px)] min-h-[360px] flex-col overflow-hidden rounded-[7px] border border-panel-border bg-panel max-[1100px]:fixed max-[1100px]:inset-y-0 max-[1100px]:right-0 max-[1100px]:z-30 max-[1100px]:h-dvh max-[1100px]:max-h-none max-[1100px]:min-h-0 max-[1100px]:w-[min(410px,90vw)] max-[1100px]:rounded-none max-[1100px]:border-y-0 max-[1100px]:shadow-[-14px_0_40px_#0005] [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-3 [&>header]:border-b [&>header]:border-border [&>header]:px-[18px] [&>header]:py-5 [&_h2]:mt-[7px] [&_h2]:text-xl [&_h2]:[overflow-wrap:anywhere] max-[1100px]:[&>header]:p-6"
          >
            {#if selection._tag === "Some"}
              <AgentInspector
                selection={selection.value}
                openTask={select}
                openHistory={history}
              />
            {/if}
          </aside>
        {/snippet}
      </Dialog.Content>
    </div>
    <details
      class="workflow-information mt-[14px] text-[10px] text-muted-foreground [&_summary]:cursor-pointer [&_p]:max-w-[700px] [&_p]:pt-3"
    >
      <summary>About this hierarchy</summary>
      <p>
        Rows follow recorded reporting relationships. Historical records with
        unrecorded reporting appear separately under Created by. Counts and
        descendant progress cover the loaded task page; totals cover the
        feature. These relationships do not represent host session ancestry.
        Recent history includes up to 100 events per task.
      </p>
      <p class="lifecycle-copy">
        Framework responsibilities: Gizmo Prime scopes the feature → Team Gizmo
        coordinates workers and recovery → workers commit and report → verifiers
        review → IntegrationAgent merges validated changes → PrAgent publishes
        the PR.
      </p>
    </details>
    <details
      class="feature-metadata workflow-information mt-[14px] text-[10px] text-muted-foreground [&_summary]:cursor-pointer [&_dl]:grid [&_dl]:max-w-[650px] [&_dl]:grid-cols-[85px_minmax(0,1fr)] [&_dl]:gap-x-3 [&_dl]:gap-y-2 [&_dl]:py-[14px] [&_dl]:text-left [&_dl]:text-[11px] [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:[overflow-wrap:anywhere]"
    >
      <summary>Feature record</summary>
      <dl>
        <dt>ID</dt>
        <dd>{flow.feature.id}</dd>
        <dt>Objective</dt>
        <dd>{flow.feature.objective}</dd>
        <dt>Branch</dt>
        <dd><code>{flow.feature.branch}</code></dd>
        <dt>Worktree</dt>
        <dd><code>{flow.feature.worktree}</code></dd>
        <dt>Record version</dt>
        <dd>{flow.feature.version}</dd>
      </dl>
    </details>
  </Tabs.Root>
</Dialog.Root>

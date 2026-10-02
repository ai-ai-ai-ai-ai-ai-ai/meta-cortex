<script lang="ts">
  import { SvelteFlow, Background, Controls, MiniMap } from "@xyflow/svelte";
  import type { FeatureFlow, Task } from "./contracts";
  import { FlowPresentation, FlowView, GraphKind, NodeKind } from "./workflow";
  import type { DiagramNode } from "./workflow";
  import { AgentContribution, PanelKind } from "./agent-tree";
  import type { AgentPanel, AgentSelection } from "./agent-tree";
  import AgentTree from "./AgentTree.svelte";
  import AgentInspector from "./AgentInspector.svelte";
  import RecordNode from "./RecordNode.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  let {
    flow,
    select,
    history,
    refresh,
  }: {
    flow: FeatureFlow;
    select: (task: Task) => void;
    history: (task: Task) => void;
    refresh: () => void;
  } = $props();
  let view = $state<FlowView>(FlowView.Tree);
  let graphKind = $state<GraphKind>(GraphKind.Agents);
  let panel = $state<AgentPanel>({ kind: PanelKind.Closed });
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
  function open(selection: AgentSelection) {
    panel = { kind: PanelKind.Agent, ...selection };
  }
  function close() {
    switch (panel.kind) {
      case PanelKind.Closed:
        return;
      case PanelKind.Agent:
        document.getElementById(panel.origin)?.focus();
        panel = { kind: PanelKind.Closed };
    }
  }
  function selectNode({ node }: { node: DiagramNode }) {
    switch (node.data.kind) {
      case NodeKind.Branch:
        return;
      case NodeKind.Agent:
      case NodeKind.Task:
        for (const item of node.data.tasks) {
          open({
            group: new AgentContribution(node.data.actor, [
              item,
              ...node.data.tasks.slice(1),
            ]),
            task: item,
            origin: `view-${view}`,
          });
          return;
        }
    }
  }
  function switchView(next: FlowView) {
    close();
    view = next;
  }
  function key(event: KeyboardEvent) {
    switch (event.key) {
      case "Escape":
        close();
        return;
      default:
        return;
    }
  }
</script>

<svelte:window onkeydown={key} />
<header class="app-header workflow-header">
  <div class="workflow-heading">
    <h1 title={flow.feature.id}>{FlowPresentation.label(flow.feature.id)}</h1>
    <p class="header-subtitle">Recorded work · Turso</p>
  </div>
  <ProgressSummary counts={flow.counts} />
  <button class="button" onclick={refresh}
    ><span aria-hidden="true">↻</span> Refresh</button
  >
</header>
<section class="workflow-overview" aria-label="Feature workflow">
  <nav class="workflow-tabs" aria-label="Workflow views">
    {#each presentation.views() as item (item)}<button
        id={`view-${item}`}
        aria-pressed={view === item}
        onclick={() => switchView(item)}>{item}</button
      >{/each}
  </nav>
  <div
    class="workflow-workspace"
    class:inspector-open={panel.kind === PanelKind.Agent}
  >
    <div class="workflow-primary">
      {#if view === FlowView.Tree}<AgentTree
          tasks={flow.tasks.records}
          {panel}
          select={open}
        />
      {:else if view === FlowView.History}
        <section class="feature-history" aria-label="Recent recorded history">
          <h2>Recent activity</h2>
          {#each presentation.activity() as item (`${item.task.id}:${item.event.revision}`)}<button
              onclick={() => history(item.task)}
              ><span
                class="event-icon"
                data-event={item.event.kind}
                aria-hidden="true">↳</span
              >
              <div>
                <strong>{FlowPresentation.action(item.event)}</strong><span
                  >{item.task.id} · {item.event.actor.role}</span
                >
              </div>
              <time>{new Date(item.event.at).toLocaleString()}</time></button
            >{/each}
        </section>
      {:else}
        {#if view === FlowView.Agents}<div class="graph-toolbar">
            <span>Recorded relationships</span>
            <div>
              {#each presentation.graphKinds() as kind (kind)}<button
                  class="button"
                  aria-pressed={graphKind === kind}
                  onclick={() => (graphKind = kind)}>{kind}</button
                >{/each}
            </div>
          </div>{/if}
        <div class="flow-canvas">
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
        </div>
      {/if}
    </div>
    {#if panel.kind === PanelKind.Agent}<button
        class="drawer-backdrop"
        aria-label="Return to execution tree"
        onclick={close}
      ></button><AgentInspector
        selection={panel}
        {close}
        openTask={select}
        openHistory={history}
      />{/if}
  </div>
  <details class="workflow-information">
    <summary>About this hierarchy</summary>
    <p>
      Rows group recorded task creators and workers by role. They do not
      represent host session ancestry. Summaries cover the loaded task page;
      totals cover the feature. Recent history includes up to 100 events per
      task.
    </p>
    <p class="lifecycle-copy">
      Framework responsibilities: Gizmo Prime scopes the feature → Team Gizmo
      coordinates workers and recovery → workers commit and report → verifiers
      review → IntegrationAgent merges validated changes → PrAgent publishes the
      PR.
    </p>
  </details>
  <details class="feature-metadata workflow-information">
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
</section>

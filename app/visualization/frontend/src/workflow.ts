import type { Node, Edge } from "@xyflow/svelte";
import { graphlib, layout, type GraphLabel } from "@dagrejs/dagre";
import type {
  FeatureFlow,
  TaskFlow,
  Task,
  FlowState,
  RecordedActor,
  Milestone,
} from "./contracts";
import { TaskPresentation } from "./task-presentation";
export enum FlowView {
  Tree = "tree",
  Agents = "graph",
  Git = "git",
  History = "history",
}
export enum GraphKind {
  Agents = "agents",
  Tasks = "dependencies",
}
export enum NodeKind {
  Agent = "agent",
  Task = "task",
  Branch = "branch",
}
enum NodeState {
  Coordinator = "coordinator",
  Worker = "worker",
  Feature = "feature",
}
interface FlowNodeData extends Record<string, unknown> {
  kind: NodeKind;
  title: string;
  subtitle: string;
  state: FlowState | NodeState;
  tasks: ReadonlyArray<TaskFlow>;
  actor: RecordedActor;
}
export type DiagramNode = Node<FlowNodeData, "record">;
interface Diagram {
  nodes: DiagramNode[];
  edges: Edge[];
}
interface LayoutNode {
  width: number;
  height: number;
  x: number;
  y: number;
}
export class FlowPresentation {
  constructor(readonly flow: FeatureFlow) {}
  static label(id: string): string {
    const words = id.replaceAll("-", " ");
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  actor(actor: RecordedActor): string {
    switch (actor.kind) {
      case "unrecorded":
        return "Assignment unrecorded";
      case "recorded":
        return `${actor.agent.team} / ${actor.agent.role}`;
    }
  }
  total(): number {
    return this.flow.counts.reduce((sum, item) => sum + item.count, 0);
  }
  stateCount(state: FlowState): number {
    return this.flow.counts
      .filter((item) => item.state === state)
      .reduce((sum, item) => sum + item.count, 0);
  }
  agentSummary(tasks: ReadonlyArray<TaskFlow>): string {
    const integrated = tasks.filter(
      (item) => item.task.state.kind === "integrated",
    ).length;
    const ready = tasks.filter(
      (item) => item.task.state.kind === "ready",
    ).length;
    return `${integrated} integrated · ${ready} ready · ${tasks.length} tasks`;
  }
  views(): FlowView[] {
    return [FlowView.Tree, FlowView.Agents, FlowView.Git, FlowView.History];
  }
  graphKinds(): GraphKind[] {
    return [GraphKind.Agents, GraphKind.Tasks];
  }
  diagram(kind: GraphKind): Diagram {
    switch (kind) {
      case GraphKind.Agents:
        return this.agents();
      case GraphKind.Tasks:
        return this.tasks();
    }
  }
  node(id: string, data: FlowNodeData): DiagramNode {
    return { id, type: "record", data, position: { x: 0, y: 0 } };
  }
  agents(): Diagram {
    const nodes = new Map<string, DiagramNode>();
    const edges = new Map<string, Edge>();
    for (const item of this.flow.tasks.records) {
      const creator = this.actor(item.created_by);
      const worker = this.actor(item.worker);
      const parentId = `coordinator:${creator}`;
      const workerId = `worker:${worker}`;
      const created = this.flow.tasks.records.filter(
        (candidate) => this.actor(candidate.created_by) === creator,
      );
      const assigned = this.flow.tasks.records.filter(
        (candidate) => this.actor(candidate.worker) === worker,
      );
      nodes.set(
        parentId,
        this.node(parentId, {
          kind: NodeKind.Agent,
          title: creator,
          subtitle: "Task creation & delegation",
          state: NodeState.Coordinator,
          tasks: created,
          actor: item.created_by,
        }),
      );
      nodes.set(
        workerId,
        this.node(workerId, {
          kind: NodeKind.Agent,
          title: worker,
          subtitle: this.agentSummary(assigned),
          state: NodeState.Worker,
          tasks: assigned,
          actor: item.worker,
        }),
      );
      const edgeId = `${parentId}:${workerId}`;
      edges.set(edgeId, {
        id: edgeId,
        source: parentId,
        target: workerId,
        label: this.handoff(item.worker),
        type: "smoothstep",
      });
    }
    return this.arrange({
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    });
  }
  tasks(): Diagram {
    const nodes = this.flow.tasks.records.map((item) =>
      this.node(`task:${item.task.id}`, {
        kind: NodeKind.Task,
        title: item.task.id,
        subtitle: this.actor(item.worker),
        state: new TaskPresentation(item.task).status(),
        tasks: [item],
        actor: item.worker,
      }),
    );
    const knownTasks = new Set(
      this.flow.tasks.records.map((item) => item.task.id),
    );
    const edges = this.flow.tasks.records.flatMap((item) =>
      this.dependencies(item, knownTasks),
    );
    return this.arrange({ nodes, edges });
  }
  git(): Diagram {
    const nodes: DiagramNode[] = [
      this.node("feature", {
        kind: NodeKind.Branch,
        title: this.flow.feature.branch,
        subtitle: "Feature integration",
        state: NodeState.Feature,
        tasks: [],
        actor: { kind: "unrecorded" },
      }),
    ];
    const edges: Edge[] = [];
    for (const item of this.flow.tasks.records) {
      switch (item.task.workspace.kind) {
        case "read_only":
          break;
        case "git":
          nodes.push(
            this.node(`branch:${item.task.id}`, {
              kind: NodeKind.Task,
              title: item.task.workspace.branch,
              subtitle: new TaskPresentation(item.task)
                .checkpoint()
                .slice(0, 12),
              state: new TaskPresentation(item.task).status(),
              tasks: [item],
              actor: item.worker,
            }),
          );
          edges.push(...this.integrations(item));
          break;
      }
    }
    return this.arrange({ nodes, edges });
  }
  private dependencies(
    item: TaskFlow,
    knownTasks: ReadonlySet<string>,
  ): Edge[] {
    return item.task.dependencies
      .filter((id) => knownTasks.has(id))
      .map((id) => ({
        id: `dependency:${id}:${item.task.id}`,
        source: `task:${id}`,
        target: `task:${item.task.id}`,
        label: "prerequisite",
        type: "smoothstep",
      }));
  }
  private integrations(item: TaskFlow): Edge[] {
    return item.integrations.map((commit) => ({
      id: `merge:${item.task.id}:${commit.revision}`,
      source: `branch:${item.task.id}`,
      target: "feature",
      label: `integrated ${commit.commit.slice(0, 8)}`,
      type: "smoothstep",
    }));
  }
  private handoff(actor: RecordedActor): string {
    switch (actor.kind) {
      case "recorded":
        return "created → assigned";
      case "unrecorded":
        return "created · unassigned";
    }
  }
  private arrange(diagram: Diagram): Diagram {
    const graph = new graphlib.Graph<GraphLabel, LayoutNode>();
    graph.setGraph({ rankdir: "TB", nodesep: 28, ranksep: 65 });
    graph.setDefaultEdgeLabel(() => ({}));
    for (const node of diagram.nodes) {
      graph.setNode(node.id, { width: 230, height: 112, x: 0, y: 0 });
    }
    for (const edge of diagram.edges) {
      graph.setEdge(edge.source, edge.target);
    }
    layout(graph);
    return {
      nodes: diagram.nodes.map((node) => ({
        ...node,
        position: {
          x: graph.node(node.id).x - 115,
          y: graph.node(node.id).y - 56,
        },
      })),
      edges: diagram.edges,
    };
  }
  activity(): ReadonlyArray<{ task: Task; event: Milestone }> {
    return this.flow.tasks.records
      .flatMap((item) =>
        item.milestones.map((event) => ({ task: item.task, event })),
      )
      .sort((first, second) => second.event.at - first.event.at)
      .slice(0, 12);
  }
  static action(event: Milestone): string {
    switch (event.kind) {
      case "created":
        return "Created task";
      case "claimed":
        return `Claimed attempt ${event.attempt}`;
      case "checkpoint":
        return "Recorded checkpoint";
      case "ready":
        return "Ready for handoff";
      case "integrated":
        return "Recorded integration";
      case "requeued":
        return "Requeued for another attempt";
      case "cancelled":
        return "Cancelled task";
      case "heartbeat":
        return "Renewed lease";
      case "progress":
        return "Recorded progress";
    }
  }
}

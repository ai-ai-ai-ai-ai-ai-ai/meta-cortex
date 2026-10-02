import type { Node, Edge } from "@xyflow/svelte";
import { graphlib, layout, type GraphLabel } from "@dagrejs/dagre";
import type {
  FeatureFlow,
  TaskFlow,
  TaskV2,
  FlowState,
  RecordedActor,
  Milestone,
} from "./contracts";
import { TaskPresentation } from "./task-presentation";
import {
  ActivityKind,
  ReportingHierarchy,
  type ReportingNode,
} from "./agent-tree";
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
  NoActivity = "No activity on this page",
  Feature = "feature",
}
interface FlowNodeData extends Record<string, unknown> {
  kind: NodeKind;
  title: string;
  subtitle: string;
  state: FlowState | NodeState;
  tasks: ReadonlyArray<TaskFlow>;
  actor: RecordedActor;
  activity?: ActivityKind;
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
interface TaskActivity {
  task: TaskV2;
  event: Milestone;
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
    const completed = tasks.filter(
      (item) => item.task.state.kind === "completed",
    ).length;
    return `${integrated} integrated · ${completed} completed · ${ready} ready · ${tasks.length} tasks`;
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
    const hierarchy = new ReportingHierarchy(this.flow.tasks.records);
    const nodes = hierarchy.nodes().map((node) => this.reportingNode(node));
    const edges: Edge[] = hierarchy.edges().map((edge) => ({
      id: `reporting:${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: "reports to",
      type: "smoothstep",
    }));
    for (const group of hierarchy.historical()) {
      const parentId = `historical:creator:${this.actor(group.actor)}`;
      const data: FlowNodeData = {
        kind: NodeKind.Agent,
        title: this.actor(group.actor),
        subtitle: "Created by · reporting unrecorded",
        state: NodeState.NoActivity,
        tasks: [],
        actor: group.actor,
        activity: ActivityKind.Absent,
      };
      nodes.push(this.node(parentId, data));
      for (const worker of group.workers.values()) {
        const workerId = `${parentId}:worker:${this.actor(worker.actor)}`;
        const workerData: FlowNodeData = {
          kind: NodeKind.Agent,
          title: this.actor(worker.actor),
          subtitle: `History worker · reporting unrecorded · ${this.agentSummary(worker.tasks)}`,
          state: worker.status(),
          tasks: worker.tasks,
          actor: worker.actor,
          activity: ActivityKind.Recorded,
        };
        nodes.push(this.node(workerId, workerData));
        const edge: Edge = {
          id: `${parentId}->${workerId}`,
          source: parentId,
          target: workerId,
          label: "created by · reporting unrecorded",
          type: "smoothstep",
        };
        edges.push(edge);
      }
    }
    const diagram: Diagram = { nodes, edges };
    return this.arrange(diagram);
  }
  private reportingNode(node: ReportingNode): DiagramNode {
    const activity = node.activity;
    switch (activity.kind) {
      case ActivityKind.Absent: {
        const data: FlowNodeData = {
          kind: NodeKind.Agent,
          title: this.reportingTitle(node),
          subtitle: "No activity on this page",
          state: NodeState.NoActivity,
          tasks: [],
          actor: node.actor(),
          activity: ActivityKind.Absent,
        };
        return this.node(node.id(), data);
      }
      case ActivityKind.Recorded: {
        const data: FlowNodeData = {
          kind: NodeKind.Agent,
          title: this.reportingTitle(node),
          subtitle: this.agentSummary(activity.group.tasks),
          state: activity.group.status(),
          tasks: activity.group.tasks,
          actor: activity.group.actor,
          activity: ActivityKind.Recorded,
        };
        return this.node(node.id(), data);
      }
    }
  }
  private reportingTitle(node: ReportingNode): string {
    const actor = node.actor();
    switch (actor.kind) {
      case "unrecorded":
        return node.name();
      case "recorded":
        return this.actor(actor);
    }
  }
  tasks(): Diagram {
    const nodes = this.flow.tasks.records.map((item) =>
      this.node(`task:${item.task.common.id}`, {
        kind: NodeKind.Task,
        title: item.task.common.id,
        subtitle: this.actor(item.worker),
        state: new TaskPresentation(item.task).status(),
        tasks: [item],
        actor: item.worker,
      }),
    );
    const knownTasks = new Set(
      this.flow.tasks.records.map((item) => item.task.common.id),
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
        case "feature":
          break;
        case "git":
          nodes.push(
            this.node(`branch:${item.task.common.id}`, {
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
    return item.task.common.dependencies
      .filter((id) => knownTasks.has(id))
      .map((id) => ({
        id: `dependency:${id}:${item.task.common.id}`,
        source: `task:${id}`,
        target: `task:${item.task.common.id}`,
        label: "prerequisite",
        type: "smoothstep",
      }));
  }
  private integrations(item: TaskFlow): Edge[] {
    return item.integrations.map((commit) => ({
      id: `merge:${item.task.common.id}:${commit.revision}`,
      source: `branch:${item.task.common.id}`,
      target: "feature",
      label: `integrated ${commit.commit.slice(0, 8)}`,
      type: "smoothstep",
    }));
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
  activity(): ReadonlyArray<TaskActivity> {
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
      case "assigned":
        return "Recorded assignment";
      case "claimed":
        return `Claimed attempt ${event.attempt}`;
      case "checkpoint":
        return "Recorded checkpoint";
      case "ready":
        return "Ready for handoff";
      case "integrated":
        return "Recorded integration";
      case "completed":
        return "Completed task";
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

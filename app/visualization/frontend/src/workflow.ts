import type { Node, Edge } from "@xyflow/svelte";
import { graphlib, layout, type GraphLabel } from "@dagrejs/dagre";
import type { FeatureFlow, TaskFlow, TaskV2, FlowState } from "./contracts";
import { TaskPresentation } from "./task-presentation";
import {
  ActivityKind,
  ReportingHierarchy,
  type ReportingNode,
  type NodeActivity,
} from "./agent-tree";
export enum FlowView {
  Tree = "tree",
  Agents = "graph",
  Git = "git",
  History = "history",
}
export const workflowViews: ReadonlyArray<FlowView> = [
  FlowView.Tree,
  FlowView.Agents,
  FlowView.Git,
  FlowView.History,
];
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
  Feature = "feature",
}
interface GraphNodeLabel {
  title: string;
  subtitle: string;
  label: string;
}
interface AgentNodeData extends GraphNodeLabel {
  kind: NodeKind.Agent;
  activity: NodeActivity;
}
interface TaskNodeData extends GraphNodeLabel {
  kind: NodeKind.Task;
  state: FlowState;
  task: TaskFlow;
}
interface BranchNodeData extends GraphNodeLabel {
  kind: NodeKind.Branch;
  state: NodeState.Feature;
}
type FlowNodeData = (AgentNodeData | TaskNodeData | BranchNodeData) &
  Record<string, unknown>;
export type DiagramNode = Node<FlowNodeData, "default">;
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
  diagram(kind: GraphKind): Diagram {
    switch (kind) {
      case GraphKind.Agents:
        return this.agents();
      case GraphKind.Tasks:
        return this.tasks();
    }
  }
  node(
    id: string,
    data:
      | Omit<AgentNodeData, "label">
      | Omit<TaskNodeData, "label">
      | Omit<BranchNodeData, "label">,
  ): DiagramNode {
    return {
      id,
      type: "default",
      data: {
        ...data,
        label: `${data.title}
${data.subtitle}`,
      },
      position: { x: 0, y: 0 },
    };
  }
  agents(): Diagram {
    const hierarchy = new ReportingHierarchy(this.flow.tasks.records);
    const nodes = hierarchy.nodes().map((node) => this.reportingNode(node));
    const edges: Edge[] = hierarchy.edges().map((edge) => ({
      id: `reporting:${edge.source}->${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: "Recorded reporting line",
      type: "smoothstep",
    }));
    for (const group of hierarchy.historical()) {
      const parentId = `historical:creator:${TaskPresentation.actor(group.actor)}`;
      const data: Omit<AgentNodeData, "label"> = {
        kind: NodeKind.Agent,
        title: TaskPresentation.actor(group.actor),
        subtitle: "Created by · reporting unrecorded",
        activity: { kind: ActivityKind.Absent },
      };
      nodes.push(this.node(parentId, data));
      for (const worker of group.workers.values()) {
        const workerId = `${parentId}:worker:${TaskPresentation.actor(worker.actor)}`;
        const workerData: Omit<AgentNodeData, "label"> = {
          kind: NodeKind.Agent,
          title: TaskPresentation.actor(worker.actor),
          subtitle: `History worker · reporting unrecorded · ${worker.summary()}`,
          activity: { kind: ActivityKind.Recorded, group: worker },
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
    const actor = node.actor();
    let title = node.name();
    switch (actor.kind) {
      case "recorded":
        title = TaskPresentation.actor(actor);
        break;
      case "unrecorded":
        break;
    }
    const activity = node.activity;
    let subtitle = "Recorded reporting target";
    switch (activity.kind) {
      case ActivityKind.Recorded:
        subtitle = activity.group.summary();
        break;
      case ActivityKind.Absent:
        break;
    }
    return this.node(node.id(), {
      kind: NodeKind.Agent,
      title,
      subtitle,
      activity,
    });
  }
  tasks(): Diagram {
    const nodes = this.flow.tasks.records.map((item) =>
      this.node(`task:${item.task.common.id}`, {
        kind: NodeKind.Task,
        title: item.task.common.id,
        subtitle: TaskPresentation.actor(item.worker),
        state: TaskPresentation.describe(item.task).status,
        task: item,
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
              subtitle: TaskPresentation.describe(item.task).checkpoint.slice(
                0,
                12,
              ),
              state: TaskPresentation.describe(item.task).status,
              task: item,
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
}

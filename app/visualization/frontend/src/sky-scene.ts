import type { FlowState } from "./contracts";
import {
  AttentionKind,
  CommitKind,
  DutyKind,
  LeaseKind,
  SkyCondition,
  SkyLedger,
  type Attention,
  type SkyAgent,
  type SkyEvent,
  type SkyFeature,
  type SkyTask,
  type SkyWorld,
} from "./sky-ledger";
import {
  GlyphKind,
  Glyphs,
  type GlyphRequest,
  type GlyphState,
} from "./sky-glyph";
import {
  GlowKind,
  Sparks,
  type Blend,
  type BurstRequest,
  type GlowRequest,
  type Painter,
  type Point,
  type Points,
  type Shade,
  type SpikeRequest,
  type TailRequest,
} from "./sky-paint";

enum NodeKind {
  Core = "core",
  Feature = "feature",
  Team = "team",
  Agent = "agent",
  Task = "task",
}
export enum FocusKind {
  Sky = "sky",
  Feature = "feature",
}
export enum HoverKind {
  None = "none",
  Node = "node",
}
enum SlotKind {
  Free = "free",
  Settled = "settled",
}
enum Flight {
  Resting = "resting",
  Flying = "flying",
}
/** Which part of the sky the camera frames. */
export type SkyFocus =
  | { readonly kind: FocusKind.Sky }
  | { readonly kind: FocusKind.Feature; readonly feature: string };
type Hover =
  | { readonly kind: HoverKind.None }
  | { readonly kind: HoverKind.Node; readonly node: string };
interface TeamLook {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}
type NodeRef =
  | { readonly kind: NodeKind.Core }
  | { readonly kind: NodeKind.Feature; readonly feature: SkyFeature }
  | { readonly kind: NodeKind.Team; readonly team: TeamLook }
  | { readonly kind: NodeKind.Agent; readonly agent: SkyAgent }
  | { readonly kind: NodeKind.Task; readonly task: SkyTask };
interface SkyNode {
  readonly id: string;
  readonly ref: NodeRef;
  /** Zero or one parent; only the core has none. */
  readonly parent: ReadonlyArray<SkyNode>;
  readonly children: Set<SkyNode>;
  readonly color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  rest: number;
  alpha: number;
  sx: number;
  sy: number;
  active: number;
  slot: SlotKind;
  flight: Flight;
  trail: Point[];
  stars: ReadonlyArray<SkyNode>;
  cluster: Point;
}
interface Edge {
  readonly from: SkyNode;
  readonly to: SkyNode;
}
type Path = ReadonlyArray<SkyNode>;
type Edges = ReadonlyArray<Edge>;
enum EffectKind {
  Pulse = "pulse",
  Ring = "ring",
  Flash = "flash",
  Commit = "commit",
  Fall = "fall",
  Flare = "flare",
}
type SkyEffect =
  | {
      readonly kind: EffectKind.Pulse;
      readonly edges: Edges;
      readonly color: string;
      age: number;
      readonly life: number;
    }
  | {
      readonly kind: EffectKind.Ring;
      readonly node: SkyNode;
      readonly color: string;
      readonly radius: number;
      readonly faint: number;
      age: number;
      readonly life: number;
    }
  | {
      readonly kind: EffectKind.Flash;
      readonly node: SkyNode;
      readonly color: string;
      readonly size: number;
      age: number;
      readonly life: number;
    }
  | {
      readonly kind: EffectKind.Commit;
      readonly node: SkyNode;
      readonly angle: number;
      age: number;
      readonly life: number;
    }
  | {
      readonly kind: EffectKind.Fall;
      readonly from: SkyNode;
      readonly to: SkyNode;
      age: number;
      readonly life: number;
    }
  | { readonly kind: EffectKind.Flare; age: number; readonly life: number };
interface Float {
  readonly node: SkyNode;
  readonly text: string;
  readonly color: string;
  age: number;
}
interface Comet {
  readonly agent: string;
  readonly index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sx: number;
  sy: number;
  trail: Point[];
}
export enum HitKind {
  Core = "core",
  Feature = "feature",
  Team = "team",
  Agent = "agent",
  Task = "task",
}
/** Something under the pointer, with the node to light up on hover. */
export type SkyHit = {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly node: string;
} & (
  | { readonly kind: HitKind.Core }
  | { readonly kind: HitKind.Feature; readonly feature: SkyFeature }
  | { readonly kind: HitKind.Team; readonly team: TeamLook }
  | { readonly kind: HitKind.Agent; readonly agent: SkyAgent }
  | { readonly kind: HitKind.Task; readonly task: SkyTask }
);
export interface Bounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
interface Area {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly height: number;
}
export interface FrameRequest {
  readonly points: Points;
  readonly seconds: number;
  readonly focus: SkyFocus;
}

/**
 * Projects sky coordinates to the screen: frames the free area between the
 * rails, turns slowly, and lets the person zoom and pan.
 */
export class Camera {
  static readonly TURN = 0.006;
  x = 0;
  y = 0;
  k = 0;
  /** Transition multiplier: bloom in, fly past. */
  mul = 1;
  rotation = 0;
  zoom = 1;
  pan: Point = { x: 0, y: 0 };
  area: Area = { cx: 0, cy: 0, width: 1, height: 1 };
  bounds: Bounds = { left: 0, right: 1, top: 0, bottom: 1 };
  scale(): number {
    return this.k * this.mul;
  }
  layout(bounds: Bounds): void {
    this.bounds = bounds;
    const width = Math.max(160, bounds.right - bounds.left);
    const height = Math.max(160, bounds.bottom - bounds.top);
    this.area = {
      cx: bounds.left + width / 2,
      cy: bounds.top + height / 2,
      width,
      height,
    };
  }
  turn(point: Point): Point {
    const c = Math.cos(this.rotation);
    const s = Math.sin(this.rotation);
    return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
  }
  project(point: Point): Point {
    const turned = this.turn(point);
    const k = this.scale();
    return {
      x: this.area.cx + (turned.x - this.x) * k + this.pan.x,
      y: this.area.cy + (turned.y - this.y) * k + this.pan.y,
    };
  }
  frame(request: FrameRequest): void {
    this.rotation += request.seconds * Camera.TURN;
    const turned = request.points.map((point) => this.turn(point));
    const xs = turned.map((p) => p.x);
    const ys = turned.map((p) => p.y);
    const limit = this.limit(request.focus);
    const span = Math.max(
      1,
      Math.max(...xs) - Math.min(...xs) + limit.padding * 2,
    );
    const rise = Math.max(
      1,
      Math.max(...ys) - Math.min(...ys) + limit.padding * 2,
    );
    const target =
      Math.min(this.area.width / span, this.area.height / rise, limit.zoom) *
      this.zoom;
    const glide = 1 - Math.exp(-2.2 * request.seconds);
    this.k =
      this.k + (target - this.k) * glide * Number(Number.isFinite(target));
    this.k = Math.max(0.05, this.k);
    this.x += ((Math.max(...xs) + Math.min(...xs)) / 2 - this.x) * glide;
    this.y += ((Math.max(...ys) + Math.min(...ys)) / 2 - this.y) * glide;
  }
  private limit(focus: SkyFocus): FrameLimit {
    switch (focus.kind) {
      case FocusKind.Sky:
        return { padding: 70, zoom: 1.6 };
      case FocusKind.Feature:
        return { padding: 90, zoom: 2.4 };
    }
  }
}
interface FrameLimit {
  readonly padding: number;
  readonly zoom: number;
}
export interface SceneDrawRequest {
  readonly painter: Painter;
  readonly camera: Camera;
  readonly time: number;
  readonly focus: SkyFocus;
}
interface Placement {
  readonly priority: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly align: CanvasTextAlign;
  readonly font: string;
  readonly color: string;
}
interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}
interface NodeSpec {
  readonly id: string;
  readonly ref: NodeRef;
  readonly parent: ReadonlyArray<SkyNode>;
  readonly color: string;
  readonly at: Point;
}
interface DrawContext {
  readonly request: SceneDrawRequest;
  readonly lit: ReadonlySet<string>;
  readonly lighting: HoverKind;
}
interface NodeDraw {
  readonly node: SkyNode;
  readonly context: DrawContext;
}

/**
 * The constellation: Gizmo Prime at the core, features branching out, then
 * teams, agents and task stars. A force tree in the spirit of Gource; every
 * mark is derived from the folded ledger.
 */
export class SkyScene {
  static readonly PRIME = "#fff1d6";
  static readonly GOLD = "#ffe2a8";
  static readonly RED = "#ff4d63";
  static readonly CYAN = "#8ff3ff";
  static readonly GREEN = "#7dffb2";
  static readonly LOST = "#9fb0d8";
  static readonly SANS = "500 15px Inter, ui-sans-serif, system-ui, sans-serif";
  static readonly MONO =
    "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace";
  static readonly GOLDEN = Math.PI * (3 - Math.sqrt(5));
  static readonly KEEP_DONE = 16;
  static readonly CALLOUTS = 3;
  static readonly TEAMS: Record<string, TeamLook> = {
    Gizmo: { id: "Gizmo", name: "Gizmo", color: "#ffe2a8" },
    Development: { id: "Development", name: "Development", color: "#ff7aa2" },
    Ai: { id: "Ai", name: "AI & Docs", color: "#ffc76b" },
    Security: { id: "Security", name: "Security", color: "#6ff0c4" },
    Sre: { id: "Sre", name: "SRE", color: "#6cb8ff" },
    Delivery: { id: "Delivery", name: "Delivery", color: "#bd9dff" },
    [SkyLedger.UNRECORDED]: {
      id: SkyLedger.UNRECORDED,
      name: "Unrecorded",
      color: "#8a97b8",
    },
  };
  static readonly CHARGE: Record<NodeKind, number> = {
    core: 8,
    feature: 7,
    team: 3.2,
    agent: 1.7,
    task: 0.6,
  };
  static readonly REST: Record<NodeKind, number> = {
    core: 0,
    feature: 270,
    team: 138,
    agent: 74,
    task: 20,
  };
  hover: Hover = { kind: HoverKind.None };
  hits: SkyHit[] = [];
  readonly sparks = new Sparks();
  private readonly nodes = new Map<string, SkyNode>();
  private readonly core: SkyNode;
  private comets = new Map<string, Comet>();
  private effects: SkyEffect[] = [];
  private floats: Float[] = [];
  private glyphs: ReadonlyArray<Glyphs> = [];
  constructor(private world: SkyWorld) {
    const spec: NodeSpec = {
      id: "core",
      ref: { kind: NodeKind.Core },
      parent: [],
      color: SkyScene.PRIME,
      at: { x: 0, y: 0 },
    };
    this.core = this.add(spec);
  }
  /** Follow a replaced world (live refresh) without losing the layout. */
  watch(world: SkyWorld): void {
    this.world = world;
  }
  team(id: string): TeamLook {
    for (const team of Object.values(SkyScene.TEAMS).filter(
      (t) => t.id === id,
    )) {
      return team;
    }
    return SkyScene.FALLBACK;
  }
  static readonly FALLBACK: TeamLook = {
    id: SkyLedger.UNRECORDED,
    name: "Unrecorded",
    color: "#8a97b8",
  };
  private add(spec: NodeSpec): SkyNode {
    const node: SkyNode = {
      id: spec.id,
      ref: spec.ref,
      parent: spec.parent,
      children: new Set(),
      color: spec.color,
      x: spec.at.x,
      y: spec.at.y,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      rest: SkyScene.REST[spec.ref.kind],
      alpha: 0,
      sx: 0,
      sy: 0,
      active: 0,
      slot: SlotKind.Free,
      flight: Flight.Resting,
      trail: [],
      stars: [],
      cluster: spec.at,
    };
    for (const parent of spec.parent) parent.children.add(node);
    this.nodes.set(spec.id, node);
    return node;
  }
  private drop(node: SkyNode): void {
    this.nodes.delete(node.id);
    for (const parent of node.parent) parent.children.delete(node);
  }
  private find(id: string): ReadonlyArray<SkyNode> {
    return [...this.nodes.values()]
      .filter((node) => node.id === id)
      .slice(0, 1);
  }
  private outward(node: SkyNode): Point {
    const origin = node.parent
      .map((p) => ({ x: p.x, y: p.y }))
      .concat({ x: 0, y: 0 })
      .slice(0, 1)
      .reduce((_, point) => point, { x: 0, y: 0 });
    const dx = node.x - origin.x;
    const dy = node.y - origin.y;
    const d = Math.max(1e-6, Math.hypot(dx, dy));
    return { x: dx / d, y: dy / d };
  }

  /** Mirror the world's tasks into the tree, growing branches on demand. */
  sync(): void {
    this.syncFeatures();
    const live = new Set(this.visibleTasks().map((task) => task.record.id));
    for (const task of this.visibleTasks()) this.ensureTask(task);
    const stale = [...this.nodes.values()].filter(
      (node) => node.ref.kind === NodeKind.Task && !live.has(node.id.slice(2)),
    );
    for (const node of stale) this.drop(node);
    for (const kind of [NodeKind.Agent, NodeKind.Team]) this.prune(kind);
    this.settleSlots();
    this.measure();
  }
  private syncFeatures(): void {
    const features = this.world.ledger.features;
    features.forEach((feature, index) => {
      const angle =
        (index / Math.max(1, features.length)) * Math.PI * 2 - Math.PI / 2;
      const spec: NodeSpec = {
        id: `f:${feature.id}`,
        ref: { kind: NodeKind.Feature, feature },
        parent: [this.core],
        color: SkyScene.PRIME,
        at: { x: Math.cos(angle) * 270, y: Math.sin(angle) * 270 },
      };
      this.ensure(spec);
    });
  }
  private ensure(spec: NodeSpec): SkyNode {
    for (const node of this.find(spec.id)) return node;
    return this.add(spec);
  }
  private prune(kind: NodeKind): void {
    const empty = [...this.nodes.values()].filter(
      (node) => node.ref.kind === kind && node.children.size === 0,
    );
    for (const node of empty) this.drop(node);
  }
  /** Finished stars beyond the newest few per agent branch are not drawn. */
  private visibleTasks(): ReadonlyArray<SkyTask> {
    const tasks = this.world.tasks.values();
    const branches = new Set(tasks.map((task) => this.branchKey(task)));
    return [...branches].flatMap((branch) =>
      this.newest(tasks.filter((task) => this.branchKey(task) === branch)),
    );
  }
  private branchKey(task: SkyTask): string {
    return `${task.record.feature}|${task.record.agent}`;
  }
  private newest(tasks: ReadonlyArray<SkyTask>): ReadonlyArray<SkyTask> {
    const done = tasks
      .filter((task) => this.finished(task.state) === Flight.Resting)
      .sort((a, b) => b.since - a.since);
    const hidden = new Set(done.slice(SkyScene.KEEP_DONE));
    return tasks.filter((task) => !hidden.has(task));
  }
  /** Finished work rests; everything else is still in flight. */
  private finished(state: FlowState): Flight {
    switch (state) {
      case "completed":
      case "cancelled":
        return Flight.Resting;
      case "queued":
      case "working":
      case "blocked":
      case "ready":
      case "integrated":
        return Flight.Flying;
    }
  }
  private ensureTask(task: SkyTask): void {
    for (const feature of this.find(`f:${task.record.feature}`)) {
      const agent = this.branch({ feature, task });
      const out = this.outward(agent);
      const spec: NodeSpec = {
        id: `k:${task.record.id}`,
        ref: { kind: NodeKind.Task, task },
        parent: [agent],
        color: this.team(task.record.team).color,
        at: {
          x: agent.x + out.x * 10 + Math.random() * 6,
          y: agent.y + out.y * 10,
        },
      };
      this.ensure(spec);
    }
  }
  private branch(request: BranchRequest): SkyNode {
    const { feature, task } = request;
    const look = this.team(task.record.team);
    const fo = this.outward(feature);
    const spread = (Math.random() - 0.5) * 60;
    const teamSpec: NodeSpec = {
      id: `t:${task.record.feature}:${task.record.team}`,
      ref: { kind: NodeKind.Team, team: look },
      parent: [feature],
      color: look.color,
      at: {
        x: feature.x + fo.x * 40 - fo.y * spread,
        y: feature.y + fo.y * 40 + fo.x * spread,
      },
    };
    const team = this.ensure(teamSpec);
    const to = this.outward(team);
    const agentSpec: NodeSpec = {
      id: `a:${task.record.feature}:${task.record.agent}`,
      ref: { kind: NodeKind.Agent, agent: this.world.agent(task.record.agent) },
      parent: [team],
      color: look.color,
      at: { x: team.x + to.x * 24, y: team.y + to.y * 24 },
    };
    return this.ensure(agentSpec);
  }
  /** Finished work settles into a slowly turning seed-head beside its agent. */
  private settleSlots(): void {
    for (const agent of this.ofKind(NodeKind.Agent)) {
      const stars = [...agent.children]
        .filter((child) => this.restingTask(child) === Flight.Resting)
        .sort((a, b) => this.since(a) - this.since(b));
      for (const star of stars) star.slot = SlotKind.Settled;
      agent.stars = stars;
    }
  }
  private restingTask(node: SkyNode): Flight {
    switch (node.ref.kind) {
      case NodeKind.Task:
        return this.finished(node.ref.task.state);
      case NodeKind.Core:
      case NodeKind.Feature:
      case NodeKind.Team:
      case NodeKind.Agent:
        return Flight.Flying;
    }
  }
  private since(node: SkyNode): number {
    switch (node.ref.kind) {
      case NodeKind.Task:
        return node.ref.task.since;
      case NodeKind.Core:
      case NodeKind.Feature:
      case NodeKind.Team:
      case NodeKind.Agent:
        return 0;
    }
  }
  private ofKind(kind: NodeKind): ReadonlyArray<SkyNode> {
    return [...this.nodes.values()].filter((node) => node.ref.kind === kind);
  }
  /** Rest lengths and how much active work flows through each branch. */
  private measure(): void {
    for (const node of this.nodes.values()) node.active = 0;
    for (const feature of this.ofKind(NodeKind.Feature)) {
      feature.rest = 190 + Math.sqrt(this.featureTasks(feature).length) * 26;
    }
    for (const node of this.ofKind(NodeKind.Task)) this.measureTask(node);
  }
  private measureTask(node: SkyNode): void {
    switch (node.ref.kind) {
      case NodeKind.Task: {
        const crowd = node.parent.reduce((n, p) => n + p.children.size, 0);
        node.rest = 16 + Math.sqrt(crowd) * 6;
        const burning = Number(
          node.ref.task.state === "working" ||
            node.ref.task.state === "blocked",
        );
        for (const ancestor of this.ancestors(node)) ancestor.active += burning;
        return;
      }
      case NodeKind.Core:
      case NodeKind.Feature:
      case NodeKind.Team:
      case NodeKind.Agent:
        return;
    }
  }
  private ancestors(node: SkyNode): Path {
    const path: SkyNode[] = [];
    let level: ReadonlyArray<SkyNode> = node.parent;
    while (level.length) {
      path.push(...level);
      level = level.flatMap((p) => p.parent);
    }
    return path;
  }
  private path(leaf: SkyNode): Path {
    return [...this.ancestors(leaf)].reverse().concat(leaf);
  }
  private edges(path: Path): Edges {
    return path
      .slice(1)
      .flatMap((to, index) =>
        path.slice(index, index + 1).map((from): Edge => ({ from, to })),
      );
  }
  private featureTasks(feature: SkyNode): ReadonlyArray<SkyTask> {
    switch (feature.ref.kind) {
      case NodeKind.Feature:
        return this.world.featureTasks(feature.ref.feature.id);
      case NodeKind.Core:
      case NodeKind.Team:
      case NodeKind.Agent:
      case NodeKind.Task:
        return [];
    }
  }

  // ---------- Physics ----------
  physics(seconds: number): void {
    const list = [...this.nodes.values()];
    for (const node of list) {
      node.fx = 0;
      node.fy = 0;
    }
    for (const node of list) this.spring(node);
    list.forEach((a, index) => {
      for (const b of list.slice(index + 1)) this.repel({ from: a, to: b });
    });
    const damp = Math.pow(0.012, seconds);
    for (const node of list.filter(
      (n) => n.slot === SlotKind.Free && n.parent.length,
    )) {
      node.vx = (node.vx + node.fx * seconds) * damp;
      node.vy = (node.vy + node.fy * seconds) * damp;
      node.x += node.vx * seconds;
      node.y += node.vy * seconds;
    }
  }
  private spring(node: SkyNode): void {
    switch (node.slot) {
      case SlotKind.Settled:
        return;
      case SlotKind.Free:
        break;
    }
    for (const parent of node.parent) {
      const dx = node.x - parent.x;
      const dy = node.y - parent.y;
      const d = Math.max(0.01, Math.hypot(dx, dy));
      const stiffness = 3 + 6 * Number(node.ref.kind !== NodeKind.Feature);
      const force = (d - node.rest) * stiffness;
      node.fx -= (dx / d) * force;
      node.fy -= (dy / d) * force;
      parent.fx += (dx / d) * force * 0.2;
      parent.fy += (dy / d) * force * 0.2;
      const out = this.outward(parent);
      const fan =
        (12 + 58 * Number(node.ref.kind !== NodeKind.Task)) *
        parent.parent.length;
      node.fx += out.x * fan;
      node.fy += out.y * fan;
    }
  }
  private repel(edge: Edge): void {
    const a = edge.from;
    const b = edge.to;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const d2 = dx * dx + dy * dy;
    const qa = this.charge(a);
    const qb = this.charge(b);
    const force =
      Math.min(1200, (2600 * qa * qb) / (d2 + 80)) * Number(d2 < 160000);
    const d = Math.max(0.01, Math.sqrt(d2));
    a.fx += (dx / d) * force;
    a.fy += (dy / d) * force;
    b.fx -= (dx / d) * force;
    b.fy -= (dy / d) * force;
  }
  private charge(node: SkyNode): number {
    switch (node.slot) {
      case SlotKind.Settled:
        return 0.3;
      case SlotKind.Free:
        return SkyScene.CHARGE[node.ref.kind];
    }
  }
  /** Phyllotaxis: a golden-angle spiral whose inner stars orbit faster. */
  settle(request: SettleRequest): void {
    for (const agent of this.ofKind(NodeKind.Agent).filter(
      (a) => a.stars.length,
    )) {
      const out = this.outward(agent);
      agent.cluster = {
        x: agent.x + out.x * 38 - out.y * 8,
        y: agent.y + out.y * 38 + out.x * 8,
      };
      const base = Math.atan2(out.y, out.x);
      agent.stars.forEach((star, index) => {
        const radius = 8.5 * Math.sqrt(index + 1.2);
        const angle =
          base +
          index * SkyScene.GOLDEN +
          request.time * (0.35 / (1 + radius / 9));
        const breathe = 1 + 0.05 * Math.sin(request.time * 0.8 + index);
        const tx = agent.cluster.x + Math.cos(angle) * radius * breathe;
        const ty = agent.cluster.y + Math.sin(angle) * radius * breathe;
        const distance = Math.hypot(tx - star.x, ty - star.y);
        const pull =
          1 - Math.exp(-(2.6 + 6.4 * Number(distance < 8)) * request.seconds);
        star.x += (tx - star.x) * pull;
        star.y += (ty - star.y) * pull;
        star.flight = this.flightFor(distance);
      });
    }
  }

  private flightFor(distance: number): Flight {
    switch (distance > 6) {
      case true:
        return Flight.Flying;
      case false:
        return Flight.Resting;
    }
  }

  // ---------- Cues ----------
  /** Animation cues for events reached while playing forward. */
  cue(event: SkyEvent): void {
    for (const leaf of this.find(`k:${event.task}`)) {
      const request: CueRequest = { event, leaf };
      this.cueEvent(request);
    }
  }
  private cueEvent(request: CueRequest): void {
    const { event, leaf } = request;
    const entry = event.entry;
    const color = leaf.color;
    switch (entry.kind) {
      case "assigned":
      case "created":
        this.pulse({ leaf, inbound: Flight.Resting, color: SkyScene.GOLD });
        return this.ring({
          node: leaf,
          color: SkyScene.GOLD,
          radius: 18,
          faint: 0,
        });
      case "claimed":
        return this.ring({ node: leaf, color, radius: 26, faint: 0 });
      case "heartbeat":
        return this.ring({
          node: leaf,
          color: "#cfe0ff",
          radius: 12,
          faint: 1,
        });
      case "progress":
        return this.progress(request);
      case "checkpoint":
        this.effects.push({
          kind: EffectKind.Commit,
          node: leaf,
          angle: Math.random() * Math.PI * 2,
          age: 0,
          life: 2.2,
        });
        return this.progress(request);
      case "ready":
        return this.ring({
          node: leaf,
          color: SkyScene.GOLD,
          radius: 34,
          faint: 0,
        });
      case "requeued":
        for (const parent of leaf.parent) {
          this.effects.push({
            kind: EffectKind.Fall,
            from: leaf,
            to: parent,
            age: 0,
            life: 1.2,
          });
        }
        return this.float({
          node: leaf,
          text: "↺ requeued",
          color: SkyScene.LOST,
        });
      case "integrated":
        this.pulse({ leaf, inbound: Flight.Flying, color: SkyScene.GOLD });
        this.effects.push({ kind: EffectKind.Flare, age: 0, life: 1.6 });
        return;
      case "completed":
        return this.complete(request);
      case "cancelled":
        return this.ring({
          node: leaf,
          color: "#5c5f70",
          radius: 20,
          faint: 0,
        });
    }
  }
  private progress(request: CueRequest): void {
    const { event, leaf } = request;
    const entry = event.entry;
    const checks = entry.evidence.flatMap((progress) => progress.checks);
    for (const check of checks
      .filter((c) => c.outcome === "failed")
      .slice(0, 1)) {
      this.burst({ node: leaf, color: SkyScene.RED, count: 26 });
      this.ring({ node: leaf, color: SkyScene.RED, radius: 30, faint: 0 });
      this.float({
        node: leaf,
        text: `✕ ${check.command}`,
        color: SkyScene.RED,
      });
    }
    const passed = checks.filter((c) => c.outcome === "passed").slice(0, 1);
    for (const check of passed) {
      this.ring({
        node: leaf,
        color: SkyScene.GREEN,
        radius: 14 + 0 * check.command.length,
        faint: 1,
      });
    }
    switch (this.world.flow(entry)) {
      case "blocked":
        this.ring({ node: leaf, color: SkyScene.RED, radius: 40, faint: 0 });
        this.float({
          node: leaf,
          text: `BLOCKED · ${this.entryText(entry)}`,
          color: SkyScene.RED,
        });
        break;
      case "queued":
      case "working":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        break;
    }
    this.effects.push({
      kind: EffectKind.Flash,
      node: leaf,
      color: leaf.color,
      size: 22,
      age: 0,
      life: 0.6,
    });
  }
  private entryText(entry: SkyEvent["entry"]): string {
    return [entry.summary, entry.note]
      .filter((text) => text.length > 0)
      .slice(0, 1)
      .join("");
  }
  private complete(request: CueRequest): void {
    const leaf = request.leaf;
    this.burst({ node: leaf, color: leaf.color, count: 54 });
    this.ring({ node: leaf, color: leaf.color, radius: 70, faint: 0 });
    this.ring({ node: leaf, color: "#ffffff", radius: 32, faint: 0 });
    this.effects.push({
      kind: EffectKind.Flash,
      node: leaf,
      color: "#ffffff",
      size: 44,
      age: 0,
      life: 0.9,
    });
  }
  private pulse(request: PulseRequest): void {
    const path = this.path(request.leaf);
    const ordered = this.direction({ path, inbound: request.inbound });
    this.effects.push({
      kind: EffectKind.Pulse,
      edges: this.edges(ordered),
      color: request.color,
      age: 0,
      life: 1.4,
    });
  }
  private direction(request: DirectionRequest): Path {
    switch (request.inbound) {
      case Flight.Flying:
        return [...request.path].reverse();
      case Flight.Resting:
        return request.path;
    }
  }
  private ring(request: RingCue): void {
    this.effects.push({
      kind: EffectKind.Ring,
      node: request.node,
      color: request.color,
      radius: request.radius,
      faint: request.faint,
      age: 0,
      life: 1.2,
    });
  }
  private burst(request: BurstCue): void {
    const burst: BurstRequest = {
      x: request.node.sx,
      y: request.node.sy,
      color: request.color,
      count: request.count,
      speed: 180,
      life: 1.5,
    };
    this.sparks.burst(burst);
  }
  private float(request: FloatCue): void {
    this.floats.push({ ...request, age: 0 });
    this.floats = this.floats.slice(-4);
  }
  /** A fresh bloom on the way into the Animated view. */
  bloom(): void {
    for (const node of this.nodes.values()) {
      node.alpha = 0;
      node.trail = [];
    }
    for (const comet of this.comets.values()) comet.trail = [];
    this.effects.push({ kind: EffectKind.Flare, age: 0, life: 2 });
  }
  /** Clear trails after a jump in time so nothing streaks across the sky. */
  jump(): void {
    for (const comet of this.comets.values()) comet.trail = [];
    this.effects = [];
  }

  // ---------- Update ----------
  update(request: SettleRequest): void {
    this.sync();
    this.physics(Math.min(request.seconds, 1 / 30));
    this.settle(request);
    this.sparks.update(request.seconds);
    for (const effect of this.effects) effect.age += request.seconds;
    this.effects = this.effects.filter((effect) => effect.age < effect.life);
    for (const float of this.floats) float.age += request.seconds;
    this.floats = this.floats.filter((float) => float.age < 2.8);
    this.steer(request);
  }
  private steer(request: SettleRequest): void {
    const agents = this.world.agents.values();
    agents.forEach((agent, index) => {
      const comet = this.comet({ agent: agent.key, index });
      const target = this.target({ agent, comet, request });
      comet.vx +=
        ((target.x - comet.x) * target.pull -
          comet.vx * Math.sqrt(target.pull) * 1.1) *
        request.seconds;
      comet.vy +=
        ((target.y - comet.y) * target.pull -
          comet.vy * Math.sqrt(target.pull) * 1.1) *
        request.seconds;
      comet.x += comet.vx * request.seconds;
      comet.y += comet.vy * request.seconds;
    });
  }
  private comet(request: CometKey): Comet {
    for (const comet of [...this.comets.values()].filter(
      (c) => c.agent === request.agent,
    )) {
      return comet;
    }
    const comet: Comet = {
      agent: request.agent,
      index: request.index,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      sx: 0,
      sy: 0,
      trail: [],
    };
    this.comets.set(request.agent, comet);
    return comet;
  }
  private target(request: TargetRequest): Steering {
    const { agent, comet } = request;
    switch (agent.duty.kind) {
      case DutyKind.Busy:
        for (const leaf of this.find(`k:${agent.duty.task}`)) {
          const lease: CometLease = { leaf, lease: this.world.lease(agent) };
          return this.toLeaf(lease);
        }
        return this.orbit({
          comet,
          time: request.request.time,
          count: this.comets.size,
        });
      case DutyKind.Idle:
        return this.orbit({
          comet,
          time: request.request.time,
          count: this.comets.size,
        });
    }
  }
  private toLeaf(request: CometLease): Steering {
    const leaf = request.leaf;
    const out = this.outward(leaf);
    switch (request.lease) {
      case LeaseKind.Expired:
        // Signal lost: the comet drifts off its task.
        return { x: leaf.x + out.x * 70, y: leaf.y + out.y * 70, pull: 1.5 };
      case LeaseKind.Idle:
      case LeaseKind.Current:
        return {
          x: leaf.x + out.x * 22 - out.y * 12,
          y: leaf.y + out.y * 22 + out.x * 12,
          pull: 14,
        };
    }
  }
  /** Idle agents orbit Gizmo Prime, waiting for an assignment. */
  private orbit(request: OrbitRequest): Steering {
    const angle =
      (request.comet.index / Math.max(1, request.count)) * Math.PI * 2 +
      request.time * 0.12;
    const radius = 70 + (request.comet.index % 2) * 16;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      pull: 6,
    };
  }
  /** Sky points for camera framing: the whole sky or one feature's subtree. */
  points(focus: SkyFocus): Points {
    switch (focus.kind) {
      case FocusKind.Sky:
        return [...this.nodes.values()];
      case FocusKind.Feature:
        return [...this.nodes.values()].filter((node) =>
          [node, ...this.ancestors(node)].some(
            (n) => n.id === `f:${focus.feature}`,
          ),
        );
    }
  }
  /** Ancestors and descendants of the hovered node stay lit; the rest dims. */
  private lit(): ReadonlySet<string> {
    switch (this.hover.kind) {
      case HoverKind.None:
        return new Set();
      case HoverKind.Node:
        return new Set(
          this.find(this.hover.node).flatMap((node) => [
            ...this.ancestors(node).map((n) => n.id),
            ...this.descendants(node).map((n) => n.id),
          ]),
        );
    }
  }
  private descendants(node: SkyNode): Path {
    const all: SkyNode[] = [node];
    let level: ReadonlyArray<SkyNode> = [node];
    while (level.length) {
      level = level.flatMap((n) => [...n.children]);
      all.push(...level);
    }
    return all;
  }
  private dim(request: NodeDraw): number {
    switch (request.context.lighting) {
      case HoverKind.None:
        return 1;
      case HoverKind.Node:
        return 0.22 + 0.78 * Number(request.context.lit.has(request.node.id));
    }
  }

  // ---------- Draw ----------
  draw(request: SceneDrawRequest): void {
    this.glyphs = [new Glyphs(request.painter)];
    const lit = this.lit();
    const context: DrawContext = { request, lit, lighting: this.hover.kind };
    for (const node of this.nodes.values()) {
      const point = request.camera.project(node);
      node.sx = point.x;
      node.sy = point.y;
      node.alpha = Math.min(1, node.alpha + 0.03);
    }
    this.hits = [];
    const c = request.painter.context;
    c.globalCompositeOperation = "lighter";
    this.drawChart(context);
    this.drawNebulae(context);
    this.drawFilaments(context);
    this.drawClusters(context);
    this.drawEnergy(context);
    this.drawTasks(context);
    this.drawHubs(context);
    this.drawCore(context);
    this.drawEffects(context);
    this.drawComets(context);
    this.sparks.draw(request.painter);
    c.globalCompositeOperation = "source-over";
    this.drawLabels(context);
    this.drawFloats(context);
    this.drawCallouts(context);
  }
  private glow(request: DrawGlow): void {
    request.context.request.painter.glow(request.glow);
  }
  /** A dashed pattern when `on` is 1, a solid line when it is 0. */
  private dashes(request: DashRequest): number[] {
    switch (request.on) {
      case 1:
        return [request.dash, request.gap];
      default:
        return [];
    }
  }
  private mix(request: MixRequest): string {
    return request.painter.palette.mix(request.blend);
  }
  /** Star-chart grid: faint rings and meridians that turn with the sky. */
  private drawChart(context: DrawContext): void {
    const { painter, camera } = context.request;
    const c = painter.context;
    const k = camera.scale();
    c.lineWidth = 1;
    for (const ring of [1, 2, 3, 4]) {
      c.strokeStyle = `rgba(160,180,230,${0.05 - ring * 0.006})`;
      c.setLineDash(this.dashes({ on: ring % 2, dash: 2, gap: 6 }));
      c.beginPath();
      c.arc(this.core.sx, this.core.sy, ring * 150 * k, 0, Math.PI * 2);
      c.stroke();
    }
    c.setLineDash([]);
    c.strokeStyle = "rgba(160,180,230,0.03)";
    for (const step of Array.from({ length: 12 }, (_, i) => i)) {
      const edge: Point = {
        x: Math.cos((step / 12) * Math.PI * 2) * 620,
        y: Math.sin((step / 12) * Math.PI * 2) * 620,
      };
      const end = camera.project(edge);
      c.beginPath();
      c.moveTo(this.core.sx, this.core.sy);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
  }
  /** Feature nebulae tinted by condition; busier branches glow wider. */
  private drawNebulae(context: DrawContext): void {
    const k = context.request.camera.scale();
    for (const node of this.ofKind(NodeKind.Feature)) {
      const tasks = this.featureTasks(node);
      const condition = this.world.condition(tasks);
      const pulse =
        0.06 *
        Math.sin(context.request.time * 2.4) *
        Number(condition === SkyCondition.Attention);
      const glow: GlowRequest = {
        x: node.sx,
        y: node.sy,
        radius: (150 + node.active * 18) * k,
        color: SkyScene.CONDITION[condition],
        alpha:
          (0.1 + pulse + node.active * 0.012) * this.dim({ node, context }),
        kind: GlowKind.Halo,
      };
      this.glow({ context, glow });
    }
    for (const node of this.ofKind(NodeKind.Team)) {
      const glow: GlowRequest = {
        x: node.sx,
        y: node.sy,
        radius: 70 * k,
        color: node.color,
        alpha: 0.08 * this.dim({ node, context }),
        kind: GlowKind.Halo,
      };
      this.glow({ context, glow });
    }
  }
  static readonly CONDITION: Record<SkyCondition, string> = {
    attention: "#ff5a6e",
    active: "#ffb066",
    waiting: "#ffe2a8",
    finished: "#8fd8ff",
    empty: "#8090b0",
  };
  /** Every branch bends the same way, so the sky swirls. */
  private drawFilaments(context: DrawContext): void {
    const c = context.request.painter.context;
    c.lineCap = "round";
    for (const node of [...this.nodes.values()].filter(
      (n) => n.slot === SlotKind.Free,
    )) {
      for (const parent of node.parent)
        this.filament({ node, parent, context });
    }
  }
  private filament(request: FilamentRequest): void {
    const { node, parent, context } = request;
    const { painter, camera } = context.request;
    const c = painter.context;
    const style = this.strand(node);
    const alpha =
      Math.min(
        0.9,
        style.alpha + Number(node.active > 0) * (0.12 + node.active * 0.03),
      ) *
      this.dim({ node, context }) *
      node.alpha;
    const width = style.width * Math.sqrt(camera.scale());
    const bend = this.bend({ from: parent, to: node });
    const gradient = c.createLinearGradient(
      parent.sx,
      parent.sy,
      node.sx,
      node.sy,
    );
    const start: Shade = { color: parent.color, alpha };
    const end: Shade = { color: node.color, alpha };
    gradient.addColorStop(0, painter.palette.rgba(start));
    gradient.addColorStop(1, painter.palette.rgba(end));
    c.strokeStyle = gradient;
    c.beginPath();
    c.moveTo(parent.sx, parent.sy);
    c.quadraticCurveTo(bend.x, bend.y, node.sx, node.sy);
    // Neon: a wide faint pass under the core line.
    c.globalAlpha = 0.14 + 0.16 * Number(node.active > 0);
    c.lineWidth = Math.max(2, width * 5) * Number(style.neon);
    c.stroke();
    c.globalAlpha = 1;
    c.lineWidth = Math.max(0.5, width);
    c.stroke();
  }
  private strand(node: SkyNode): Strand {
    switch (node.ref.kind) {
      case NodeKind.Feature:
        return { alpha: 0.5, width: 2.6, neon: 1 };
      case NodeKind.Team:
        return { alpha: 0.5, width: 1.9, neon: 1 };
      case NodeKind.Agent:
        return { alpha: 0.45, width: 1.3, neon: 1 };
      case NodeKind.Task:
        return {
          alpha: this.taskStrand(node.ref.task),
          width: 0.8,
          neon: Number(node.active > 0),
        };
      case NodeKind.Core:
        return { alpha: 0, width: 0, neon: 0 };
    }
  }
  private taskStrand(task: SkyTask): number {
    switch (task.state) {
      case "queued":
        return 0.22;
      case "completed":
      case "cancelled":
        return 0.16;
      case "working":
      case "blocked":
      case "ready":
      case "integrated":
        return 0.3 + this.world.heat(task) * 0.5;
    }
  }
  private bend(edge: Edge): Point {
    const dx = edge.to.sx - edge.from.sx;
    const dy = edge.to.sy - edge.from.sy;
    const k = 0.08 + 0.08 * Number(edge.to.ref.kind !== NodeKind.Task);
    return {
      x: (edge.from.sx + edge.to.sx) / 2 - dy * k,
      y: (edge.from.sy + edge.to.sy) / 2 + dx * k,
    };
  }
  private along(request: AlongRequest): Point {
    const count = request.edges.length;
    const scaled = Math.min(1, Math.max(0, request.at)) * count;
    const index = Math.min(count - 1, Math.floor(scaled));
    const u = scaled - index;
    for (const edge of request.edges.slice(index, index + 1)) {
      const bend = this.bend(edge);
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      return {
        x: a * edge.from.sx + b * bend.x + c * edge.to.sx,
        y: a * edge.from.sy + b * bend.y + c * edge.to.sy,
      };
    }
    return { x: this.core.sx, y: this.core.sy };
  }
  /** Constellation figures: finished stars joined in the order they landed. */
  private drawClusters(context: DrawContext): void {
    const { painter, camera } = context.request;
    const c = painter.context;
    c.lineWidth = 0.7;
    for (const agent of this.ofKind(NodeKind.Agent).filter(
      (a) => a.stars.length,
    )) {
      const blend: Blend = { from: agent.color, to: "#ffffff", amount: 0.5 };
      const color = painter.palette.mix(blend);
      const line: Shade = {
        color,
        alpha: 0.22 * this.dim({ node: agent, context }),
      };
      c.strokeStyle = painter.palette.rgba(line);
      c.setLineDash([1.5, 3]);
      c.beginPath();
      c.moveTo(agent.sx, agent.sy);
      for (const star of agent.stars) c.lineTo(star.sx, star.sy);
      c.stroke();
      c.setLineDash([]);
      const centre = camera.project(agent.cluster);
      const glow: GlowRequest = {
        x: centre.x,
        y: centre.y,
        radius: (14 + Math.sqrt(agent.stars.length) * 9) * camera.scale(),
        color: agent.color,
        alpha: 0.16 * this.dim({ node: agent, context }),
        kind: GlowKind.Halo,
      };
      this.glow({ context, glow });
      for (const star of agent.stars) this.starTrail({ node: star, context });
    }
  }
  /** A finished task flies to its slot as a shooting star. */
  private starTrail(request: NodeDraw): void {
    const star = request.node;
    switch (star.flight) {
      case Flight.Flying:
        star.trail = star.trail.concat({ x: star.sx, y: star.sy }).slice(-24);
        break;
      case Flight.Resting:
        star.trail = star.trail.slice(1);
        break;
    }
    const blend: Blend = { from: star.color, to: "#ffffff", amount: 0.6 };
    const tail: TailRequest = {
      points: star.trail,
      color: this.mix({ painter: request.context.request.painter, blend }),
      width: 3 * Math.sqrt(request.context.request.camera.scale()),
    };
    request.context.request.painter.tail(tail);
  }
  /** Energy: motes flow out to working tasks and back in from handoffs. */
  private drawEnergy(context: DrawContext): void {
    const { painter, camera, time } = context.request;
    for (const node of this.ofKind(NodeKind.Task)) {
      const flow = this.flow(node);
      const edges = this.edges(this.path(node));
      const seed = this.seed(node.id);
      for (const offset of [0, 1 / 3, 2 / 3].slice(0, flow.motes)) {
        const q = (time * flow.speed + offset + seed) % 1;
        const along: AlongRequest = { edges, at: Math.abs(flow.reverse - q) };
        const point = this.along(along);
        const glow: GlowRequest = {
          x: point.x,
          y: point.y,
          radius: 5 * Math.sqrt(camera.scale()) + 2,
          color: flow.color,
          alpha: 0.9 * this.dim({ node, context }),
          kind: GlowKind.Core,
        };
        painter.glow(glow);
      }
    }
  }
  private flow(node: SkyNode): EnergyFlow {
    switch (node.ref.kind) {
      case NodeKind.Task:
        return this.taskFlow({ node, task: node.ref.task });
      case NodeKind.Core:
      case NodeKind.Feature:
      case NodeKind.Team:
      case NodeKind.Agent:
        return SkyScene.STILL;
    }
  }
  static readonly STILL: EnergyFlow = {
    motes: 0,
    speed: 0,
    reverse: 0,
    color: "#ffffff",
  };
  private taskFlow(request: TaskFlowRequest): EnergyFlow {
    switch (request.task.state) {
      case "working":
        switch (this.world.stalled(request.task)) {
          case LeaseKind.Expired:
            return SkyScene.STILL;
          case LeaseKind.Idle:
          case LeaseKind.Current:
            return { motes: 3, speed: 0.22, reverse: 0, color: "#fff4e6" };
        }
        return SkyScene.STILL;
      case "ready":
      case "integrated":
        return {
          motes: 3,
          speed: 0.3,
          reverse: 1,
          color: SkyScene.GOLD,
        };
      case "queued":
      case "blocked":
      case "completed":
      case "cancelled":
        return SkyScene.STILL;
    }
  }
  private seed(text: string): number {
    let hash = 2166136261;
    for (const char of text)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return ((hash >>> 0) % 1000) / 1000;
  }
  private drawTasks(context: DrawContext): void {
    const { camera, time } = context.request;
    const scale = Math.sqrt(camera.scale());
    for (const node of this.ofKind(NodeKind.Task)) {
      for (const glyphs of this.glyphs)
        this.taskStar({ node, context, glyphs, scale, time });
    }
  }
  private taskStar(request: TaskStarRequest): void {
    const { node, context, glyphs, scale, time } = request;
    switch (node.ref.kind) {
      case NodeKind.Task: {
        const task = node.ref.task;
        const state: GlyphState = {
          state: task.state,
          lease: this.world.stalled(task),
        };
        const kind = glyphs.kind(state);
        const seed = this.seed(task.record.id);
        const fresh =
          Math.max(0, 1 - (this.world.time - task.since) / 20000) +
          0.6 * Number(node.flight === Flight.Flying);
        const twinkle =
          1 -
          0.25 *
            Number(kind === GlyphKind.Completed) *
            (0.5 - 0.5 * Math.sin(time * (1.3 + seed * 2) + seed * 40));
        const glyph: GlyphRequest = {
          x: node.sx,
          y: node.sy,
          kind,
          heat: this.world.heat(task),
          size: this.size({ kind, task }) * scale,
          tint: node.color,
          time,
          seed,
          fresh: Math.min(1, fresh * Number(kind === GlyphKind.Completed)),
        };
        context.request.painter.context.globalAlpha =
          this.dim({ node, context }) * node.alpha * twinkle;
        glyphs.draw(glyph);
        context.request.painter.context.globalAlpha = 1;
        this.hits.push({
          kind: HitKind.Task,
          task,
          node: node.id,
          x: node.sx,
          y: node.sy,
          radius: Math.max(7, glyph.size * 2),
        });
        return;
      }
      case NodeKind.Core:
      case NodeKind.Feature:
      case NodeKind.Team:
      case NodeKind.Agent:
        return;
    }
  }
  private size(request: SizeRequest): number {
    switch (request.kind) {
      case GlyphKind.Working:
        return 2.4 + Math.sqrt(request.task.work) * 0.9;
      case GlyphKind.Completed:
        return 2.8;
      case GlyphKind.Queued:
      case GlyphKind.Stalled:
      case GlyphKind.Blocked:
      case GlyphKind.Ready:
      case GlyphKind.Integrated:
      case GlyphKind.Cancelled:
        return 2.4;
    }
  }
  /** Agents, teams and features: the hubs every branch hangs from. */
  private drawHubs(context: DrawContext): void {
    for (const node of this.nodes.values()) this.hub({ node, context });
  }
  private hub(request: NodeDraw): void {
    const { node, context } = request;
    const { painter, camera } = context.request;
    const scale = Math.sqrt(camera.scale());
    const dim = this.dim(request);
    switch (node.ref.kind) {
      case NodeKind.Agent: {
        const busy = Number(node.active > 0);
        const blend: Blend = { from: node.color, to: "#ffffff", amount: 0.6 };
        const glow: GlowRequest = {
          x: node.sx,
          y: node.sy,
          radius: (8 + 4 * busy) * scale,
          color: painter.palette.mix(blend),
          alpha: (0.5 + 0.35 * busy) * dim,
          kind: GlowKind.Core,
        };
        painter.glow(glow);
        this.hits.push({
          kind: HitKind.Agent,
          agent: node.ref.agent,
          node: node.id,
          x: node.sx,
          y: node.sy,
          radius: 9,
        });
        return;
      }
      case NodeKind.Team: {
        const glow: GlowRequest = {
          x: node.sx,
          y: node.sy,
          radius: 26 * scale,
          color: node.color,
          alpha: 0.85 * dim,
          kind: GlowKind.Core,
        };
        painter.glow(glow);
        this.hits.push({
          kind: HitKind.Team,
          team: node.ref.team,
          node: node.id,
          x: node.sx,
          y: node.sy,
          radius: 12,
        });
        return;
      }
      case NodeKind.Feature:
        this.drawFeature(request);
        this.hits.push({
          kind: HitKind.Feature,
          feature: node.ref.feature,
          node: node.id,
          x: node.sx,
          y: node.sy,
          radius: 22 * scale + 6,
        });
        return;
      case NodeKind.Core:
      case NodeKind.Task:
        return;
    }
  }
  /** The feature star wears a ring of its whole task inventory. */
  private drawFeature(request: NodeDraw): void {
    const { node, context } = request;
    const { painter, camera } = context.request;
    const c = painter.context;
    const scale = Math.sqrt(camera.scale());
    const dim = this.dim(request);
    const tasks = this.featureTasks(node);
    const counts = this.world.counts(tasks);
    const total = Math.max(1, tasks.length);
    const glow: GlowRequest = {
      x: node.sx,
      y: node.sy,
      radius: 40 * scale,
      color: SkyScene.PRIME,
      alpha: 0.95 * dim,
      kind: GlowKind.Core,
    };
    painter.glow(glow);
    const spikes: SpikeRequest = {
      x: node.sx,
      y: node.sy,
      length: 30 * scale,
      color: SkyScene.PRIME,
      alpha: 0.25 * dim,
      angle: 0,
    };
    painter.spikes(spikes);
    const radius = 24 * scale;
    let start = -Math.PI / 2;
    c.lineWidth = Math.max(1.5, 3 * scale);
    for (const state of SkyScene.RING_ORDER.filter((s) => counts[s] > 0)) {
      const sweep = (counts[state] / total) * Math.PI * 2;
      const shade: Shade = { color: Glyphs.COLOR[state], alpha: 0.9 * dim };
      c.strokeStyle = painter.palette.rgba(shade);
      c.beginPath();
      c.arc(
        node.sx,
        node.sy,
        radius,
        start + 0.025,
        start + Math.max(0.05, sweep) - 0.025,
      );
      c.stroke();
      start += sweep;
    }
    c.strokeStyle = `rgba(207,224,255,${0.12 * dim})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(node.sx, node.sy, radius + 7 * scale, 0, Math.PI * 2);
    c.stroke();
  }
  static readonly RING_ORDER: ReadonlyArray<FlowState> = [
    "completed",
    "integrated",
    "ready",
    "working",
    "blocked",
    "queued",
    "cancelled",
  ];
  /** Gizmo Prime: brighter the busier the fleet, with a turning compass ring. */
  private drawCore(context: DrawContext): void {
    const { painter, camera, time } = context.request;
    const c = painter.context;
    const scale = Math.sqrt(camera.scale());
    const agents = this.world.agents.values();
    const busy =
      agents.filter((a) => a.duty.kind === DutyKind.Busy).length /
      Math.max(1, agents.length);
    const flare = this.effects
      .filter((effect) => effect.kind === EffectKind.Flare)
      .reduce((max, effect) => Math.max(max, 1 - effect.age / effect.life), 0);
    const x = this.core.sx;
    const y = this.core.sy;
    const halo: GlowRequest = {
      x,
      y,
      radius: (160 + busy * 80 + flare * 120) * scale,
      color: "#ffb36b",
      alpha: 0.22 + flare * 0.2,
      kind: GlowKind.Halo,
    };
    painter.glow(halo);
    const star: GlowRequest = {
      x,
      y,
      radius: 54 * scale * (1 + flare * 0.5),
      color: SkyScene.PRIME,
      alpha: 1,
      kind: GlowKind.Core,
    };
    painter.glow(star);
    const long: SpikeRequest = {
      x,
      y,
      length: (60 + flare * 60) * scale,
      color: SkyScene.PRIME,
      alpha: 0.45,
      angle: 0,
    };
    painter.spikes(long);
    const short: SpikeRequest = {
      ...long,
      length: 34 * scale,
      alpha: 0.2,
      angle: Math.PI / 4,
    };
    painter.spikes(short);
    const radius = 44 * scale;
    c.save();
    c.translate(x, y);
    c.rotate(time * 0.03);
    c.strokeStyle = "rgba(255,236,200,0.28)";
    c.lineWidth = 1;
    for (const tick of Array.from({ length: 72 }, (_, i) => i)) {
      const angle = (tick / 72) * Math.PI * 2;
      const length = 3 + 4 * Number(tick % 6 === 0);
      c.beginPath();
      c.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      c.lineTo(
        Math.cos(angle) * (radius + length),
        Math.sin(angle) * (radius + length),
      );
      c.stroke();
    }
    c.restore();
    this.hits.push({
      kind: HitKind.Core,
      node: this.core.id,
      x,
      y,
      radius: 26 * scale,
    });
  }
  private drawEffects(context: DrawContext): void {
    for (const effect of this.effects) {
      const request: EffectDraw = { effect, context };
      this.effect(request);
    }
  }
  private effect(request: EffectDraw): void {
    const { effect, context } = request;
    const { painter, camera } = context.request;
    const c = painter.context;
    const scale = Math.sqrt(camera.scale());
    const k = effect.age / effect.life;
    switch (effect.kind) {
      case EffectKind.Ring: {
        const shade: Shade = {
          color: effect.color,
          alpha: (1 - k) * (0.8 - 0.55 * effect.faint),
        };
        c.strokeStyle = painter.palette.rgba(shade);
        c.lineWidth = 1 + (2 * (1 - k) - 0.5) * (1 - effect.faint);
        c.beginPath();
        c.arc(
          effect.node.sx,
          effect.node.sy,
          effect.radius * scale * (1 - Math.pow(1 - k, 3)) + 2,
          0,
          Math.PI * 2,
        );
        c.stroke();
        return;
      }
      case EffectKind.Flash: {
        const glow: GlowRequest = {
          x: effect.node.sx,
          y: effect.node.sy,
          radius: effect.size * scale * (1 + k * 0.6),
          color: effect.color,
          alpha: (1 - k) * 0.7,
          kind: GlowKind.Core,
        };
        painter.glow(glow);
        return;
      }
      case EffectKind.Pulse:
        return this.drawPulse({ effect, context });
      case EffectKind.Commit: {
        const distance = (8 + (1 - Math.pow(1 - k, 3)) * 26) * scale;
        painter.diamond({
          x: effect.node.sx + Math.cos(effect.angle) * distance,
          y: effect.node.sy + Math.sin(effect.angle) * distance,
          radius: 2.4 * scale + 1,
          color: SkyScene.CYAN,
          alpha: 1 - k,
        });
        return;
      }
      case EffectKind.Fall: {
        const q = 1 - Math.pow(1 - k, 3);
        const glow: GlowRequest = {
          x: effect.from.sx + (effect.to.sx - effect.from.sx) * q,
          y: effect.from.sy + (effect.to.sy - effect.from.sy) * q,
          radius: 12,
          color: SkyScene.LOST,
          alpha: 1 - k,
          kind: GlowKind.Core,
        };
        painter.glow(glow);
        return;
      }
      case EffectKind.Flare:
        return;
    }
  }
  private drawPulse(request: EffectDraw): void {
    const { effect, context } = request;
    switch (effect.kind) {
      case EffectKind.Pulse: {
        const k = 1 - Math.pow(1 - effect.age / effect.life, 3);
        const points = [9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((step) => {
          const along: AlongRequest = {
            edges: effect.edges,
            at: k - step * 0.018,
          };
          return this.along(along);
        });
        const tail: TailRequest = { points, color: effect.color, width: 3 };
        context.request.painter.tail(tail);
        for (const head of points.slice(-1)) {
          const glow: GlowRequest = {
            x: head.x,
            y: head.y,
            radius: 14,
            color: effect.color,
            alpha: 1,
            kind: GlowKind.Core,
          };
          context.request.painter.glow(glow);
        }
        return;
      }
      case EffectKind.Ring:
      case EffectKind.Flash:
      case EffectKind.Commit:
      case EffectKind.Fall:
      case EffectKind.Flare:
        return;
    }
  }
  private drawComets(context: DrawContext): void {
    for (const comet of this.comets.values()) {
      for (const agent of this.world.agents.find(comet.agent))
        this.drawComet({ comet, agent, context });
    }
  }
  private drawComet(request: CometDraw): void {
    const { comet, agent, context } = request;
    const { painter, camera, time } = context.request;
    const c = painter.context;
    const point = camera.project(comet);
    const jumped = comet.trail
      .slice(-1)
      .filter((last) => Math.hypot(last.x - point.x, last.y - point.y) > 120);
    comet.trail = comet.trail
      .slice(0, comet.trail.length * Number(jumped.length === 0))
      .concat(point)
      .slice(-30);
    comet.sx = point.x;
    comet.sy = point.y;
    const team = this.team(agent.team);
    const lease = this.world.lease(agent);
    const lost = Number(lease === LeaseKind.Expired);
    const blend: Blend = { from: team.color, to: "#ffffff", amount: 0.55 };
    const signal: Blend = {
      from: painter.palette.mix(blend),
      to: "#7f8db0",
      amount: lost,
    };
    const color = painter.palette.mix(signal);
    const leaves = this.busyLeaves(agent);
    const lit =
      context.lighting === HoverKind.None ||
      leaves.some((leaf) => context.lit.has(leaf.id));
    const dim = 0.25 + 0.75 * Number(lit);
    for (const leaf of leaves) {
      const beam: BeamRequest = {
        from: point,
        to: leaf,
        color: team.color,
        alpha: dim * (1 - lost),
        time,
        index: comet.index,
        blocked: Number(
          leaf.ref.kind === NodeKind.Task && leaf.ref.task.state === "blocked",
        ),
      };
      this.beam({ beam, painter });
    }
    c.globalAlpha = dim;
    const tail: TailRequest = {
      points: comet.trail,
      color,
      width:
        (2 + 1.2 * leaves.length) * Math.max(0.8, Math.sqrt(camera.scale())),
    };
    painter.tail(tail);
    c.globalAlpha = 1;
    const flicker =
      1 - lost * (0.4 + 0.4 * Number(Math.sin(time * 31 + comet.index) > 0.3));
    const glow: GlowRequest = {
      x: point.x,
      y: point.y,
      radius:
        (9 + 6 * leaves.length) * Math.max(0.8, Math.sqrt(camera.scale())),
      color,
      alpha: (0.65 + 0.35 * leaves.length) * flicker * dim,
      kind: GlowKind.Core,
    };
    painter.glow(glow);
    this.hits.push({
      kind: HitKind.Agent,
      agent,
      node: leaves
        .map((leaf) => leaf.id)
        .concat("core")
        .slice(0, 1)
        .join(""),
      x: point.x,
      y: point.y,
      radius: 11,
    });
  }
  private busyLeaves(agent: SkyAgent): Path {
    switch (agent.duty.kind) {
      case DutyKind.Idle:
        return [];
      case DutyKind.Busy:
        return this.find(`k:${agent.duty.task}`);
    }
  }
  /** A laser from comet to task; it only shows once the comet is close. */
  private beam(request: BeamDraw): void {
    const { beam, painter } = request;
    const c = painter.context;
    const near = Math.min(
      1,
      Math.max(
        0,
        1 -
          (Math.hypot(beam.to.sx - beam.from.x, beam.to.sy - beam.from.y) -
            40) /
            120,
      ),
    );
    const flicker =
      (0.55 + 0.3 * Math.sin(beam.time * 24 + beam.index)) * near * beam.alpha;
    const outer: Shade = {
      color: painter.palette.mix({
        from: beam.color,
        to: SkyScene.RED,
        amount: beam.blocked,
      }),
      alpha: 0.3 * flicker,
    };
    c.setLineDash(this.dashes({ on: beam.blocked, dash: 2, gap: 4 }));
    c.strokeStyle = painter.palette.rgba(outer);
    c.lineWidth = 4 - 3 * beam.blocked;
    c.beginPath();
    c.moveTo(beam.from.x, beam.from.y);
    c.lineTo(beam.to.sx, beam.to.sy);
    c.stroke();
    const inner: Shade = {
      color: "#ffffff",
      alpha: flicker * (1 - beam.blocked),
    };
    c.strokeStyle = painter.palette.rgba(inner);
    c.lineWidth = 1;
    c.stroke();
    c.setLineDash([]);
  }

  // ---------- Text ----------
  /**
   * Labels compete for room: each claims a box, and a lower-priority label that
   * would overlap a placed one is not drawn. Text gets a dark halo so it stays
   * legible over glow.
   */
  private drawLabels(context: DrawContext): void {
    const placements = [...this.nodes.values()].flatMap((node) =>
      this.labels({ node, context }),
    );
    const c = context.request.painter.context;
    const bounds = context.request.camera.bounds;
    const placed: Box[] = [];
    c.textBaseline = "middle";
    c.shadowColor = "rgba(2,3,9,0.95)";
    c.shadowBlur = 6;
    for (const label of placements.sort((a, b) => b.priority - a.priority)) {
      c.font = label.font;
      const width = c.measureText(label.text).width;
      const x0 = label.x - width * SkyScene.ANCHOR[label.align];
      const box: Box = {
        x0: x0 - 4,
        y0: label.y - 8,
        x1: x0 + width + 4,
        y1: label.y + 8,
      };
      const inside =
        box.x0 >= bounds.left &&
        box.x1 <= bounds.right &&
        box.y0 >= bounds.top &&
        box.y1 <= bounds.bottom;
      const clear = !placed.some(
        (p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0,
      );
      switch (inside && clear) {
        case true:
          placed.push(box);
          c.textAlign = label.align;
          c.fillStyle = label.color;
          c.fillText(label.text, label.x, label.y);
          break;
        case false:
          break;
      }
    }
    c.shadowBlur = 0;
  }
  static readonly ANCHOR: Record<CanvasTextAlign, number> = {
    left: 0,
    start: 0,
    center: 0.5,
    right: 1,
    end: 1,
  };
  private labels(request: NodeDraw): ReadonlyArray<Placement> {
    const { node, context } = request;
    const k = context.request.camera.scale();
    const out = this.screenOut(node);
    const align = this.align(out);
    const shown = Number(
      context.lighting === HoverKind.None || context.lit.has(node.id),
    );
    switch (node.ref.kind) {
      case NodeKind.Feature:
        return this.featureLabels({ node, context });
      case NodeKind.Team:
        return [
          {
            priority: 80,
            text: node.ref.team.name.toUpperCase(),
            x: node.sx + out.x * 16,
            y: node.sy + out.y * 16,
            align,
            font: `600 9.5px ${SkyScene.MONO}`,
            color: `rgba(${this.channels(node.color)},${0.3 + 0.6 * shown})`,
          },
        ].filter(() => k > 0.8 || context.lit.has(node.id));
      case NodeKind.Agent:
        return [
          {
            priority: 50 + 20 * Number(node.active > 0),
            text: node.ref.agent.name,
            x: node.sx + out.x * 13,
            y: node.sy + out.y * 13,
            align,
            font: `500 10px ${SkyScene.MONO}`,
            color: `rgba(225,232,250,${0.5 + 0.35 * Number(node.active > 0)})`,
          },
        ].filter(
          () => (k > 1.2 || this.hovered(node) === HoverKind.Node) && shown > 0,
        );
      case NodeKind.Task:
        return [
          {
            priority: 110,
            text: node.ref.task.record.objective,
            x: node.sx + out.x * 12,
            y: node.sy + out.y * 12,
            align,
            font: `500 10.5px ${SkyScene.MONO}`,
            color: "rgba(240,244,255,0.95)",
          },
        ].filter(() => this.hovered(node) === HoverKind.Node);
      case NodeKind.Core:
        return [
          {
            priority: 98,
            text: "GIZMO PRIME",
            x: node.sx,
            y: node.sy + 56 * Math.sqrt(k) + 14,
            align: "center",
            font: `600 10px ${SkyScene.MONO}`,
            color: "rgba(255,236,200,0.9)",
          },
        ];
    }
  }
  private hovered(node: SkyNode): HoverKind {
    switch (this.hover.kind) {
      case HoverKind.None:
        return HoverKind.None;
      case HoverKind.Node:
        return this.matching(this.hover.node === node.id);
    }
  }
  private matching(same: boolean): HoverKind {
    switch (same) {
      case true:
        return HoverKind.Node;
      case false:
        return HoverKind.None;
    }
  }
  private title(node: SkyNode): string {
    switch (node.ref.kind) {
      case NodeKind.Feature:
        return node.ref.feature.title;
      case NodeKind.Core:
      case NodeKind.Team:
      case NodeKind.Agent:
      case NodeKind.Task:
        return "";
    }
  }
  private featureLabels(request: NodeDraw): ReadonlyArray<Placement> {
    const { node, context } = request;
    const tasks = this.featureTasks(node);
    const counts = this.world.counts(tasks);
    const shown = Number(
      context.lighting === HoverKind.None || context.lit.has(node.id),
    );
    const y = node.sy + 24 * Math.sqrt(context.request.camera.scale()) + 22;
    const parts = [
      `${counts.completed + counts.integrated}/${tasks.length} done`,
      ...[`${counts.working} burning`].filter(() => counts.working > 0),
      ...[`${counts.blocked} blocked`].filter(() => counts.blocked > 0),
    ];
    const title = this.title(node);
    const alarm = Number(counts.blocked > 0);
    return [
      {
        priority: 100,
        text: title,
        x: node.sx,
        y,
        align: "center",
        font: SkyScene.SANS,
        color: `rgba(245,240,230,${0.35 + 0.6 * shown})`,
      },
      {
        priority: 99,
        text: parts.join(" · "),
        x: node.sx,
        y: y + 17,
        align: "center",
        font: `500 10px ${SkyScene.MONO}`,
        color: `rgba(${207 + 48 * alarm},${224 - 104 * alarm},${255 - 120 * alarm},${0.25 + 0.4 * shown + 0.3 * alarm})`,
      },
    ];
  }
  private align(out: Point): CanvasTextAlign {
    switch (Math.sign(Math.round(out.x * 2.5))) {
      case 1:
        return "left";
      case -1:
        return "right";
      default:
        return "center";
    }
  }
  private channels(color: string): string {
    const value = parseInt(color.slice(1), 16);
    return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
  }
  private screenOut(node: SkyNode): Point {
    for (const parent of node.parent) {
      const dx = node.sx - parent.sx;
      const dy = node.sy - parent.sy;
      const d = Math.max(1e-6, Math.hypot(dx, dy));
      return { x: dx / d, y: dy / d };
    }
    return { x: 0, y: 1 };
  }
  private drawFloats(context: DrawContext): void {
    const c = context.request.painter.context;
    const scale = Math.sqrt(context.request.camera.scale());
    c.textAlign = "center";
    c.font = `600 10px ${SkyScene.MONO}`;
    c.shadowColor = "rgba(2,3,9,0.95)";
    c.shadowBlur = 6;
    for (const float of this.floats) {
      const k = float.age / 2.8;
      const alpha = Math.min(k / 0.15, 1 - Math.max(0, (k - 0.6) / 0.4));
      const shade: Shade = { color: float.color, alpha };
      c.fillStyle = context.request.painter.palette.rgba(shade);
      c.fillText(
        float.text,
        float.node.sx,
        float.node.sy - 16 * scale - 10 - (1 - Math.pow(1 - k, 3)) * 22,
      );
    }
    c.shadowBlur = 0;
  }
  /** Attention outranks progress: blockers and lost workers get callouts. */
  private drawCallouts(context: DrawContext): void {
    const focus = context.request.focus;
    const items = this.world
      .attention()
      .filter((item) =>
        this.inFocus({ focus, feature: item.task.record.feature }),
      )
      .flatMap((item) =>
        this.find(`k:${item.task.record.id}`).map(
          (node): Callout => ({ item, node }),
        ),
      )
      .slice(0, SkyScene.CALLOUTS);
    const placed: Point[] = [];
    for (const callout of items) {
      const request: CalloutDraw = { callout, context, placed };
      this.callout(request);
    }
  }
  inFocus(request: FocusMatch): number {
    switch (request.focus.kind) {
      case FocusKind.Sky:
        return 1;
      case FocusKind.Feature:
        return Number(request.focus.feature === request.feature);
    }
  }
  private callout(request: CalloutDraw): void {
    const { callout, context, placed } = request;
    const { painter, camera } = context.request;
    const c = painter.context;
    const node = callout.node;
    const dx = node.sx - this.core.sx;
    const dy = node.sy - this.core.sy;
    const d = Math.max(1e-6, Math.hypot(dx, dy));
    const right = Number(dx >= 0);
    const title = SkyScene.CALLOUT_TITLE[callout.item.kind];
    const text = `${this.world.agent(callout.item.task.record.agent).name} — ${callout.item.text}`;
    c.font = `400 10.5px ${SkyScene.MONO}`;
    const width = Math.max(c.measureText(text).width, 90) + 18;
    const height = 36;
    const crowded = placed.filter(
      (p) => Math.abs(p.y - (node.sy + (dy / d) * 40)) < height + 4,
    ).length;
    const bounds = camera.bounds;
    const ey = Math.min(
      bounds.bottom - height,
      Math.max(
        bounds.top + height,
        node.sy + (dy / d) * 40 + crowded * (height + 6),
      ),
    );
    const ex = node.sx + (dx / d) * 54;
    const bx = Math.min(
      bounds.right - width - 8,
      Math.max(bounds.left + 8, ex - width * (1 - right)),
    );
    placed.push({ x: ex, y: ey });
    const tone: Blend = {
      from: SkyScene.RED,
      to: SkyScene.LOST,
      amount: Number(callout.item.kind === AttentionKind.Stalled),
    };
    const color = painter.palette.mix(tone);
    const leader: Shade = { color, alpha: 0.7 };
    c.strokeStyle = painter.palette.rgba(leader);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(node.sx + (dx / d) * 8, node.sy + (dy / d) * 8);
    c.lineTo(ex, ey);
    c.stroke();
    c.fillStyle = "rgba(6,7,16,0.82)";
    c.fillRect(bx, ey - height / 2, width, height);
    c.fillStyle = color;
    c.fillRect(bx + (width - 2) * (1 - right), ey - height / 2, 2, height);
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.font = `600 9.5px ${SkyScene.MONO}`;
    c.fillText(title, bx + 10, ey - 7);
    c.font = `400 10.5px ${SkyScene.MONO}`;
    c.fillStyle = "rgba(235,240,255,0.88)";
    c.fillText(text, bx + 10, ey + 8);
  }
  static readonly CALLOUT_TITLE: Record<AttentionKind, string> = {
    blocked: "BLOCKED",
    stalled: "SIGNAL LOST",
    failed: "CHECK FAILED",
  };
  /** The commit shown on a task, for tooltips. */
  commit(task: SkyTask): string {
    switch (task.commit.kind) {
      case CommitKind.None:
        return "";
      case CommitKind.Recorded:
        return task.commit.commit;
    }
  }
  /** Where an agent's comet currently is on screen. */
  cometAt(agent: string): Point {
    for (const comet of this.comets.values()) {
      switch (comet.agent === agent) {
        case true:
          return { x: comet.sx, y: comet.sy };
        case false:
          break;
      }
    }
    return { x: this.core.sx, y: this.core.sy };
  }
}

interface BranchRequest {
  readonly feature: SkyNode;
  readonly task: SkyTask;
}
export interface SettleRequest {
  readonly seconds: number;
  readonly time: number;
}
interface CueRequest {
  readonly event: SkyEvent;
  readonly leaf: SkyNode;
}
interface PulseRequest {
  readonly leaf: SkyNode;
  readonly inbound: Flight;
  readonly color: string;
}
interface RingCue {
  readonly node: SkyNode;
  readonly color: string;
  readonly radius: number;
  /** 0 strong, 1 faint. */
  readonly faint: number;
}
interface BurstCue {
  readonly node: SkyNode;
  readonly color: string;
  readonly count: number;
}
interface FloatCue {
  readonly node: SkyNode;
  readonly text: string;
  readonly color: string;
}
interface CometKey {
  readonly agent: string;
  readonly index: number;
}
interface TargetRequest {
  readonly agent: SkyAgent;
  readonly comet: Comet;
  readonly request: SettleRequest;
}
interface CometLease {
  readonly leaf: SkyNode;
  readonly lease: LeaseKind;
}
interface OrbitRequest {
  readonly comet: Comet;
  readonly time: number;
  readonly count: number;
}
interface Steering {
  readonly x: number;
  readonly y: number;
  readonly pull: number;
}
interface DrawGlow {
  readonly context: DrawContext;
  readonly glow: GlowRequest;
}
interface DashRequest {
  readonly on: number;
  readonly dash: number;
  readonly gap: number;
}
interface DirectionRequest {
  readonly path: Path;
  readonly inbound: Flight;
}
interface MixRequest {
  readonly painter: Painter;
  readonly blend: Blend;
}
interface FilamentRequest {
  readonly node: SkyNode;
  readonly parent: SkyNode;
  readonly context: DrawContext;
}
interface Strand {
  readonly alpha: number;
  readonly width: number;
  readonly neon: number;
}
interface AlongRequest {
  readonly edges: Edges;
  readonly at: number;
}
interface EnergyFlow {
  readonly motes: number;
  readonly speed: number;
  /** 0 flows out to the task, 1 flows back to the core. */
  readonly reverse: number;
  readonly color: string;
}
interface TaskFlowRequest {
  readonly node: SkyNode;
  readonly task: SkyTask;
}
interface TaskStarRequest {
  readonly node: SkyNode;
  readonly context: DrawContext;
  readonly glyphs: Glyphs;
  readonly scale: number;
  readonly time: number;
}
interface SizeRequest {
  readonly kind: GlyphKind;
  readonly task: SkyTask;
}
interface EffectDraw {
  readonly effect: SkyEffect;
  readonly context: DrawContext;
}
interface CometDraw {
  readonly comet: Comet;
  readonly agent: SkyAgent;
  readonly context: DrawContext;
}
interface BeamRequest {
  readonly from: Point;
  readonly to: SkyNode;
  readonly color: string;
  readonly alpha: number;
  readonly time: number;
  readonly index: number;
  /** 1 when the task is blocked: a dashed red line. */
  readonly blocked: number;
}
interface BeamDraw {
  readonly beam: BeamRequest;
  readonly painter: Painter;
}
interface Callout {
  readonly item: Attention;
  readonly node: SkyNode;
}
interface CalloutDraw {
  readonly callout: Callout;
  readonly context: DrawContext;
  readonly placed: Point[];
}
interface FocusMatch {
  readonly focus: SkyFocus;
  readonly feature: string;
}

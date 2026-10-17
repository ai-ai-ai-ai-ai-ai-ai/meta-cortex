import { Match } from "effect";
import type { FlowState } from "./contracts";
import {
  AttentionKind,
  DutyKind,
  SkyCondition,
  SkyLedger,
  SkyWorld,
  type SkyLedgerRequest,
  type SkyAgent,
  type SkyEvent,
  type SkyFeature,
  type SkyTask,
  type StateCounts,
} from "./sky-ledger";
import {
  Camera,
  FocusKind,
  HitKind,
  HoverKind,
  SkyScene,
  type Bounds,
  type FrameRequest,
  type SceneDrawRequest,
  type SettleRequest,
  type SkyFocus,
  type SkyHit,
} from "./sky-scene";
import {
  AgentFocus,
  FocusState,
  type FocusDrawRequest,
  type FocusOpen,
} from "./sky-focus.svelte";
import { GlyphKinds, Glyphs, type GlyphKind } from "./sky-glyph";
import {
  GlowKind,
  Painter,
  Palette,
  Starfield,
  type Blend,
  type GlowRequest,
  type Point,
  type Shade,
  type SkyDrawRequest,
  type Viewport,
} from "./sky-paint";

export enum PlayMode {
  Live = "live",
  Replay = "replay",
}
export enum Motion {
  Playing = "playing",
  Paused = "paused",
}
/** How long a whole-history replay takes. */
enum Pace {
  Slow = "slow",
  Normal = "normal",
  Fast = "fast",
}
export enum StageVisibility {
  Shown = "shown",
  Hidden = "hidden",
}
export enum TipKind {
  Hidden = "hidden",
  Shown = "shown",
}
enum WarpKind {
  Still = "still",
  In = "in",
  Out = "out",
}
enum Scrub {
  Idle = "idle",
  Dragging = "dragging",
}
enum DragKind {
  Idle = "idle",
  Panning = "panning",
}
type Tip =
  | { readonly kind: TipKind.Hidden }
  | {
      readonly kind: TipKind.Shown;
      readonly x: number;
      readonly y: number;
      readonly hit: SkyHit;
    };
type Warp =
  | { readonly kind: WarpKind.Still }
  | { readonly kind: WarpKind.In | WarpKind.Out; age: number };
type Drag =
  | { readonly kind: DragKind.Idle }
  | {
      readonly kind: DragKind.Panning;
      readonly start: Point;
      readonly pan: Point;
      moved: number;
    };
interface FeatureRow {
  readonly id: string;
  readonly title: string;
  readonly condition: SkyCondition;
  readonly done: number;
  readonly total: number;
  readonly counts: StateCounts;
  readonly focused: number;
}
interface TaskRow {
  readonly id: string;
  readonly objective: string;
  readonly agent: string;
  readonly detail: string;
  readonly age: string;
  readonly glyph: GlyphKind;
  readonly heat: number;
  readonly tint: string;
  readonly alarm: number;
}
interface SkyHud {
  readonly condition: SkyCondition;
  readonly summary: string;
  readonly features: ReadonlyArray<FeatureRow>;
  readonly attention: ReadonlyArray<TaskRow>;
  readonly burning: ReadonlyArray<TaskRow>;
  readonly review: ReadonlyArray<TaskRow>;
  readonly clock: string;
  readonly behind: string;
  readonly ticker: ReadonlyArray<TickerLine>;
}
interface TickerLine {
  readonly id: string;
  readonly clock: string;
  readonly who: string;
  readonly text: string;
  readonly color: string;
}
export interface StageLayout {
  readonly viewport: Viewport;
  readonly bounds: Bounds;
  readonly ratio: number;
}
/** A pointer event on the replay timeline's canvas. */
export type TrackPointer = PointerEvent & {
  readonly currentTarget: EventTarget & HTMLCanvasElement;
};
export interface PointerAt {
  readonly x: number;
  readonly y: number;
}
enum PressKind {
  None = "none",
  Feature = "feature",
  Agent = "agent",
  Sky = "sky",
}
interface Bucket {
  work: number;
  commit: number;
  bad: number;
  done: number;
  assign: number;
}
interface HistogramDraw {
  readonly context: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;
}

/**
 * Runs the Animated view: playback over the folded ledger, the camera, the
 * transition in and out, pointer interaction, and the HUD snapshot.
 */
export class SkyStage {
  static readonly LIVE_EDGE = 0.995;
  static readonly CUE_LIMIT = 80;
  static readonly PACE: Record<Pace, number> = {
    slow: 90,
    normal: 45,
    fast: 15,
  };
  static readonly HUD_INTERVAL = 0.4;
  static readonly CLOCK = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  static readonly EMPTY_HUD: SkyHud = {
    condition: SkyCondition.Empty,
    summary: "Reading the sky…",
    features: [],
    attention: [],
    burning: [],
    review: [],
    clock: "--:--:--",
    behind: "",
    ticker: [],
  };
  mode = $state<PlayMode>(PlayMode.Live);
  motion = $state<Motion>(Motion.Playing);
  pace = $state<Pace>(Pace.Normal);
  focusTarget = $state.raw<SkyFocus>({ kind: FocusKind.Sky });
  hud = $state.raw<SkyHud>(SkyStage.EMPTY_HUD);
  tip = $state.raw<Tip>({ kind: TipKind.Hidden });
  readonly camera = new Camera();
  private readonly palette = new Palette();
  private readonly kinds = new GlyphKinds();
  readonly focus: AgentFocus;
  private world: SkyWorld;
  private readonly scene: SkyScene;
  private readonly starfield = new Starfield();
  private painters: ReadonlyArray<Painter> = [];
  private tracks: ReadonlyArray<TrackSurface> = [];
  private viewport: Viewport = { width: 0, height: 0 };
  private visibility = StageVisibility.Hidden;
  private head = Date.now();
  private time = 0;
  private hudIn = 0;
  private warp: Warp = { kind: WarpKind.Still };
  private drag: Drag = { kind: DragKind.Idle };
  private scrub = Scrub.Idle;
  private buckets: ReadonlyArray<Bucket> = [];
  private ticker: ReadonlyArray<TickerLine> = [];
  private readonly streaks = Array.from({ length: 180 }, () => ({
    angle: Math.random() * Math.PI * 2,
    depth: Math.random(),
    width: 0.5 + Math.random() * 1.5,
  }));
  constructor() {
    const request: SkyLedgerRequest = { cards: [], workflows: [] };
    this.world = new SkyWorld(new SkyLedger(request));
    this.scene = new SkyScene(this.world);
    this.focus = new AgentFocus(this.world);
  }

  // ---------- Data ----------
  /** A fresh ledger from the feed; new events animate when following live. */
  load(ledger: SkyLedger): void {
    const fresh = this.world.replace(ledger);
    this.scene.watch(this.world);
    this.focus.watch(this.world);
    this.buckets = this.bucketize();
    switch (this.mode) {
      case PlayMode.Live:
        this.cue(fresh);
        return;
      case PlayMode.Replay:
        return;
    }
  }
  private cue(events: ReadonlyArray<SkyEvent>): void {
    for (const event of events.slice(
      0,
      SkyStage.CUE_LIMIT * Number(events.length < SkyStage.CUE_LIMIT),
    )) {
      this.scene.cue(event);
      this.focus.onEvent(event);
      this.ticker = this.describe(event).concat(this.ticker).slice(0, 5);
    }
  }

  // ---------- Canvas ----------
  attach(canvas: HTMLCanvasElement): void {
    this.painters = Match.value(canvas.getContext("2d")).pipe(
      Match.when(Match.null, (): ReadonlyArray<Painter> => []),
      Match.orElse((context): ReadonlyArray<Painter> => [new Painter(context)]),
    );
  }
  /** The replay timeline's canvas; it is drawn on the same frame loop. */
  attachTrack(canvas: HTMLCanvasElement): void {
    this.tracks = Match.value(canvas.getContext("2d")).pipe(
      Match.when(Match.null, (): ReadonlyArray<TrackSurface> => []),
      Match.orElse(
        (context): ReadonlyArray<TrackSurface> => [{ canvas, context }],
      ),
    );
  }
  layout(request: StageLayout): void {
    this.viewport = request.viewport;
    this.camera.layout(request.bounds);
    this.starfield.resize(request.viewport);
    for (const painter of this.painters) {
      painter.context.setTransform(request.ratio, 0, 0, request.ratio, 0, 0);
    }
  }
  show(visibility: StageVisibility): void {
    this.visibility = visibility;
  }
  /** Bloom out of the core on the way in, fly past on the way out. */
  enter(): void {
    this.warp = { kind: WarpKind.In, age: 0 };
    this.scene.bloom();
  }
  leave(): void {
    this.warp = { kind: WarpKind.Out, age: 0 };
  }

  // ---------- Loop ----------
  tick(seconds: number): void {
    switch (this.visibility) {
      case StageVisibility.Hidden:
        return;
      case StageVisibility.Shown:
        break;
    }
    this.time += seconds;
    this.advance(seconds);
    const settle: SettleRequest = { seconds, time: this.time };
    this.scene.update(settle);
    this.focus.update(seconds);
    this.flyWarp(seconds);
    const frame: FrameRequest = {
      points: this.scene.points(this.focusTarget),
      seconds,
      focus: this.focusTarget,
    };
    this.camera.frame(frame);
    for (const painter of this.painters) this.paint(painter);
    for (const track of this.tracks) this.paintTrack(track);
    this.hudIn -= seconds;
    switch (this.hudIn <= 0) {
      case true:
        this.hudIn = SkyStage.HUD_INTERVAL;
        this.hud = this.snapshot();
        break;
      case false:
        break;
    }
  }
  private advance(seconds: number): void {
    const now = Date.now();
    const start = this.world.ledger.start(now);
    const step = ((now - start) / SkyStage.PACE[this.pace]) * seconds;
    switch (this.mode) {
      case PlayMode.Live:
        this.head = now;
        break;
      case PlayMode.Replay:
        this.head = this.replayHead({ step, now });
        break;
    }
    const before = this.world.time;
    const reached = this.world.seek(this.head);
    switch (this.head < before || this.scrub === Scrub.Dragging) {
      case true:
        this.scene.jump();
        return;
      case false:
        this.cue(reached);
    }
  }
  /** Replay walks forward and skips idle stretches between events. */
  private replayHead(request: ReplayStep): number {
    const moving = Number(
      this.motion === Motion.Playing && this.scrub === Scrub.Idle,
    );
    const next = this.world.ledger.events
      .filter((event) => event.entry.at > this.head)
      .slice(0, 1)
      .map((event) => event.entry.at);
    const idle = next
      .filter((at) => at - this.head > request.step * 3)
      .map((at) => at - request.step);
    const head = Math.max(
      this.head + request.step * moving,
      ...idle.map((at) => at * moving),
    );
    switch (head >= request.now) {
      case true:
        this.mode = PlayMode.Live;
        return request.now;
      case false:
        return head;
    }
  }
  private flyWarp(seconds: number): void {
    switch (this.warp.kind) {
      case WarpKind.Still:
        this.camera.mul = 1;
        return;
      case WarpKind.In:
      case WarpKind.Out:
        this.warp.age += seconds;
        break;
    }
    const q = Math.min(1, this.warp.age / 1.5);
    const eased = 1 - Math.pow(1 - q, 3);
    const inward = Number(this.warp.kind === WarpKind.In);
    this.camera.mul =
      inward * (0.18 + 0.82 * eased) + (1 - inward) * (1 + eased * 1.4);
    switch (q >= 1) {
      case true:
        this.warp = { kind: WarpKind.Still };
        this.camera.mul = 1;
        return;
      case false:
        return;
    }
  }
  private paint(painter: Painter): void {
    const sky: SkyDrawRequest = {
      painter,
      time: this.time,
      drift: {
        x: -this.camera.pan.x * 2 - this.camera.rotation * 400,
        y: -this.camera.pan.y * 2,
      },
    };
    this.starfield.draw(sky);
    this.drawWarp(painter);
    const scene: SceneDrawRequest = {
      painter,
      camera: this.camera,
      time: this.time,
      focus: this.focusTarget,
    };
    this.scene.draw(scene);
    const focus: FocusDrawRequest = { painter, viewport: this.viewport };
    this.focus.draw(focus);
  }
  /** Hyperspace streaks radiating from the scene centre during the switch. */
  private drawWarp(painter: Painter): void {
    switch (this.warp.kind) {
      case WarpKind.Still:
        return;
      case WarpKind.In:
      case WarpKind.Out:
        break;
    }
    const c = painter.context;
    const q = Math.min(1, this.warp.age / 1.5);
    const inward = Number(this.warp.kind === WarpKind.In);
    const fade = inward * (1 - q) + (1 - inward) * Math.min(q * 2, 2 - q * 2);
    const { cx, cy } = this.camera.area;
    const reach = Math.hypot(this.viewport.width, this.viewport.height);
    c.globalCompositeOperation = "lighter";
    c.lineCap = "round";
    for (const streak of this.streaks) {
      const p = (streak.depth + q * (1.4 + 0.6 * (1 - inward))) % 1;
      const near = p * p * reach;
      const length = 30 + p * 220 * fade;
      const shade: Shade = { color: "#cfe0ff", alpha: fade * p * 0.8 };
      c.strokeStyle = painter.palette.rgba(shade);
      c.lineWidth = streak.width * (0.5 + p);
      c.beginPath();
      c.moveTo(
        cx + Math.cos(streak.angle) * near,
        cy + Math.sin(streak.angle) * near,
      );
      c.lineTo(
        cx + Math.cos(streak.angle) * (near + length),
        cy + Math.sin(streak.angle) * (near + length),
      );
      c.stroke();
    }
    const glow: GlowRequest = {
      x: cx,
      y: cy,
      radius: 260 * fade,
      color: "#ffe6c0",
      alpha: 0.5 * fade,
      kind: GlowKind.Halo,
    };
    painter.glow(glow);
    c.globalCompositeOperation = "source-over";
  }

  // ---------- Playback controls ----------
  replay(): void {
    this.world.rewind();
    this.head = this.world.ledger.start(Date.now());
    this.mode = PlayMode.Replay;
    this.motion = Motion.Playing;
    this.scene.jump();
  }
  live(): void {
    this.mode = PlayMode.Live;
    this.motion = Motion.Playing;
  }
  toggle(): void {
    switch (this.motion) {
      case Motion.Playing:
        this.motion = Motion.Paused;
        return;
      case Motion.Paused:
        this.motion = Motion.Playing;
    }
  }
  setPace(pace: Pace): void {
    this.pace = pace;
  }
  /** Scrub to a fraction of the recorded history. */
  seek(fraction: number): void {
    const now = Date.now();
    const start = this.world.ledger.start(now);
    this.head = start + Math.min(1, Math.max(0, fraction)) * (now - start);
    switch (fraction > SkyStage.LIVE_EDGE) {
      case true:
        this.mode = PlayMode.Live;
        return;
      case false:
        this.mode = PlayMode.Replay;
    }
  }
  private scrubbing(state: Scrub): void {
    this.scrub = state;
  }
  startScrub(): void {
    this.scrubbing(Scrub.Dragging);
  }
  endScrub(): void {
    this.scrubbing(Scrub.Idle);
  }

  // ---------- Camera ----------
  fly(feature: string): void {
    switch (this.isFocused(feature).length > 0) {
      case true:
        this.focusTarget = { kind: FocusKind.Sky };
        break;
      case false:
        this.focusTarget = { kind: FocusKind.Feature, feature };
        break;
    }
    this.camera.zoom = 1;
    this.camera.pan = { x: 0, y: 0 };
    this.hud = this.snapshot();
  }
  private isFocused(feature: string): ReadonlyArray<string> {
    switch (this.focusTarget.kind) {
      case FocusKind.Sky:
        return [];
      case FocusKind.Feature:
        return [this.focusTarget.feature].filter((id) => id === feature);
    }
  }
  sky(): void {
    this.focusTarget = { kind: FocusKind.Sky };
    this.camera.zoom = 1;
    this.camera.pan = { x: 0, y: 0 };
  }
  zoom(delta: number): void {
    this.camera.zoom = Math.min(
      5,
      Math.max(0.35, this.camera.zoom * Math.exp(-delta * 0.0012)),
    );
  }

  // ---------- Pointer ----------
  hoverNode(node: string): void {
    this.scene.hover = { kind: HoverKind.Node, node };
  }
  clearHover(): void {
    this.scene.hover = { kind: HoverKind.None };
  }
  pointer(at: PointerAt): void {
    switch (this.drag.kind) {
      case DragKind.Panning:
        this.camera.pan = {
          x: this.drag.pan.x + at.x - this.drag.start.x,
          y: this.drag.pan.y + at.y - this.drag.start.y,
        };
        this.drag.moved = Math.max(
          this.drag.moved,
          Math.hypot(at.x - this.drag.start.x, at.y - this.drag.start.y),
        );
        this.tip = { kind: TipKind.Hidden };
        return;
      case DragKind.Idle:
        break;
    }
    const hits = this.hitAt(at).filter(
      () => this.focus.state === FocusState.Closed,
    );
    this.scene.hover = { kind: HoverKind.None };
    this.tip = { kind: TipKind.Hidden };
    for (const hit of hits) {
      this.scene.hover = { kind: HoverKind.Node, node: hit.node };
      this.tip = { kind: TipKind.Shown, x: at.x, y: at.y, hit };
    }
  }
  leavePointer(): void {
    this.scene.hover = { kind: HoverKind.None };
    this.tip = { kind: TipKind.Hidden };
  }
  press(at: PointerAt): void {
    this.drag = {
      kind: DragKind.Panning,
      start: at,
      pan: this.camera.pan,
      moved: 0,
    };
  }
  /** Releasing without a drag selects what is under the pointer. */
  release(at: PointerAt): PressKind {
    const moved = this.dragDistance();
    this.drag = { kind: DragKind.Idle };
    switch (moved > 4 || this.focus.state === FocusState.Open) {
      case true:
        return PressKind.None;
      case false:
        break;
    }
    for (const hit of this.hitAt(at)) return this.select(hit);
    return PressKind.None;
  }
  private dragDistance(): number {
    switch (this.drag.kind) {
      case DragKind.Idle:
        return 0;
      case DragKind.Panning:
        return this.drag.moved;
    }
  }
  private select(hit: SkyHit): PressKind {
    switch (hit.kind) {
      case HitKind.Feature:
        this.fly(hit.feature.id);
        return PressKind.Feature;
      case HitKind.Core:
        this.sky();
        return PressKind.Sky;
      case HitKind.Agent:
        this.openAgent(hit.agent);
        return PressKind.Agent;
      case HitKind.Task:
        this.openAgent(this.world.agent(hit.task.record.agent));
        return PressKind.Agent;
      case HitKind.Team:
        return PressKind.None;
    }
  }
  openAgent(agent: SkyAgent): void {
    this.tip = { kind: TipKind.Hidden };
    this.scene.hover = { kind: HoverKind.None };
    const request: FocusOpen = { agent, from: this.scene.cometAt(agent.key) };
    this.focus.open(request);
  }
  openTask(task: string): void {
    for (const found of this.world.tasks.find(task)) {
      this.openAgent(this.world.agent(found.record.agent));
    }
  }
  private hitAt(at: PointerAt): ReadonlyArray<SkyHit> {
    return this.scene.hits
      .map((hit) => ({ hit, score: Math.hypot(hit.x - at.x, hit.y - at.y) }))
      .filter((entry) => entry.score < entry.hit.radius + 5)
      .sort(
        (a, b) =>
          a.score +
          SkyStage.RANK[a.hit.kind] * 3 -
          (b.score + SkyStage.RANK[b.hit.kind] * 3),
      )
      .slice(0, 1)
      .map((entry) => entry.hit);
  }
  static readonly RANK: Record<HitKind, number> = {
    agent: 0,
    task: 1,
    team: 3,
    feature: 3,
    core: 4,
  };

  // ---------- Reading for the HUD ----------
  private snapshot(): SkyHud {
    const world = this.world;
    const tasks = world.tasks.values();
    const attention = world.attention().filter(
      (item) =>
        this.scene.inFocus({
          focus: this.focusTarget,
          feature: item.task.record.feature,
        }) > 0,
    );
    const busy = world.agents
      .values()
      .filter((agent) => agent.duty.kind === DutyKind.Busy).length;
    const blocked = attention.filter(
      (item) => item.kind === AttentionKind.Blocked,
    ).length;
    const lost = attention.filter(
      (item) => item.kind === AttentionKind.Stalled,
    ).length;
    const flagged = attention.map((item) => item.task.record.id);
    const inFocus = tasks.filter(
      (task) =>
        this.scene.inFocus({
          focus: this.focusTarget,
          feature: task.record.feature,
        }) > 0,
    );
    const summary = [
      ...[`${blocked} blocked`].filter(() => blocked > 0),
      ...[`${lost} signal lost`].filter(() => lost > 0),
      `${busy} of ${world.agents.size()} agents burning`,
    ].join(" · ");
    return {
      condition: world.condition(tasks),
      summary,
      features: world.ledger.features.map((feature) =>
        this.featureRow(feature),
      ),
      attention: attention.map((item) =>
        this.row({ task: item.task, detail: item.text, alarm: 1 }),
      ),
      burning: inFocus
        .filter(
          (task) =>
            task.state === "working" && !flagged.includes(task.record.id),
        )
        .sort((a, b) => b.lastAt - a.lastAt)
        .slice(0, 7)
        .map((task) =>
          this.row({ task, detail: this.workNote(task), alarm: 0 }),
        ),
      review: inFocus
        .filter((task) => task.state === "ready" || task.state === "integrated")
        .slice(0, 5)
        .map((task) =>
          this.row({ task, detail: this.reviewNote(task), alarm: 0 }),
        ),
      clock: this.clockText(this.head),
      behind: this.behind(),
      ticker: this.ticker,
    };
  }
  private featureRow(feature: SkyFeature): FeatureRow {
    const tasks = this.world.featureTasks(feature.id);
    const counts = this.world.counts(tasks);
    return {
      id: feature.id,
      title: feature.title,
      condition: this.world.condition(tasks),
      done: counts.completed + counts.integrated,
      total: tasks.length,
      counts,
      focused: this.isFocused(feature.id).length,
    };
  }
  private row(request: RowRequest): TaskRow {
    const { task } = request;
    const glyphs = this.kinds;
    return {
      id: task.record.id,
      objective: task.record.objective,
      agent: this.world.agent(task.record.agent).name,
      detail: request.detail,
      age: this.age(this.world.time - task.lastAt),
      glyph: glyphs.kind({
        state: task.state,
        lease: this.world.stalled(task),
      }),
      heat: this.world.heat(task),
      tint: this.scene.team(task.record.team).color,
      alarm: request.alarm,
    };
  }
  private workNote(task: SkyTask): string {
    return [
      ...[`${task.passed}✓ ${task.failed}✕`].filter(
        () => task.passed + task.failed > 0,
      ),
      ...[`${task.commits}◆`].filter(() => task.commits > 0),
      task.note,
    ].join(" · ");
  }
  private reviewNote(task: SkyTask): string {
    switch (task.state) {
      case "integrated":
        return `◆ ${this.scene.commit(task)} integrated`;
      case "queued":
      case "working":
      case "blocked":
      case "ready":
      case "completed":
      case "cancelled":
        return "Handoff ready";
    }
  }
  private age(milliseconds: number): string {
    const seconds = Math.max(0, Math.round(milliseconds / 1000));
    return [
      `${seconds}s`,
      `${Math.floor(seconds / 60)}m`,
      `${Math.floor(seconds / 3600)}h`,
      `${Math.floor(seconds / 86400)}d`,
    ]
      .slice(
        Number(seconds >= 60) +
          Number(seconds >= 3600) +
          Number(seconds >= 86400),
      )
      .slice(0, 1)
      .join("");
  }
  private clockText(at: number): string {
    return SkyStage.CLOCK.format(at);
  }
  private behind(): string {
    switch (this.mode) {
      case PlayMode.Live:
        return "";
      case PlayMode.Replay:
        return `−${this.age(Date.now() - this.head)}`;
    }
  }
  private describe(event: SkyEvent): ReadonlyArray<TickerLine> {
    switch (event.entry.kind) {
      case "heartbeat":
      case "created":
        return [];
      case "assigned":
      case "claimed":
      case "progress":
      case "checkpoint":
      case "ready":
      case "integrated":
      case "completed":
      case "requeued":
      case "cancelled":
        return this.world.ledger.tasks.find(event.task).map((record) => ({
          id: event.key,
          clock: this.clockText(event.entry.at),
          who: this.world.agent(record.agent).name,
          text: `${SkyStage.VERB[event.entry.kind]} “${record.objective}”`,
          color: SkyStage.TONE[event.entry.kind],
        }));
    }
  }
  static readonly VERB: Record<SkyEvent["entry"]["kind"], string> = {
    created: "created",
    assigned: "was assigned",
    claimed: "claimed",
    heartbeat: "heartbeat on",
    progress: "progressed on",
    checkpoint: "checkpointed",
    ready: "is ready to hand off",
    integrated: "landed",
    completed: "completed",
    requeued: "was sent back on",
    cancelled: "cancelled",
  };
  static readonly TONE: Record<SkyEvent["entry"]["kind"], string> = {
    created: "#ffe2a8",
    assigned: "#ffe2a8",
    claimed: "#ffb35c",
    heartbeat: "#cfe0ff",
    progress: "#ffb35c",
    checkpoint: "#8ff3ff",
    ready: "#ffe2a8",
    integrated: "#ffffff",
    completed: "#a6f3ff",
    requeued: "#9fb0d8",
    cancelled: "#5c5f70",
  };

  // ---------- Timeline ----------
  private bucketize(): ReadonlyArray<Bucket> {
    const now = Date.now();
    const start = this.world.ledger.start(now);
    const span = Math.max(1, now - start);
    const buckets: Bucket[] = Array.from({ length: 240 }, () => ({
      work: 0,
      commit: 0,
      bad: 0,
      done: 0,
      assign: 0,
    }));
    for (const event of this.world.ledger.events) {
      const index = Math.min(
        buckets.length - 1,
        Math.floor(((event.entry.at - start) / span) * buckets.length),
      );
      for (const bucket of buckets.slice(index, index + 1))
        bucket[this.category(event)] += 1;
    }
    return buckets;
  }
  private category(event: SkyEvent): keyof Bucket {
    const failed = event.entry.evidence.some((progress) =>
      progress.checks.some((check) => check.outcome === "failed"),
    );
    switch (event.entry.kind) {
      case "completed":
      case "integrated":
        return "done";
      case "checkpoint":
        return "commit";
      case "assigned":
      case "created":
        return "assign";
      case "progress":
        return this.trouble(
          failed || this.world.flow(event.entry) === "blocked",
        );
      case "claimed":
      case "heartbeat":
      case "ready":
      case "requeued":
      case "cancelled":
        return "work";
    }
  }
  private trouble(bad: boolean): keyof Bucket {
    switch (bad) {
      case true:
        return "bad";
      case false:
        return "work";
    }
  }
  static readonly LAYERS: ReadonlyArray<readonly [keyof Bucket, string]> = [
    ["done", "#a6f3ff"],
    ["commit", "#8ff3ff"],
    ["bad", "#ff4d63"],
    ["assign", "#ffe2a8"],
    ["work", "#ffb35c"],
  ];
  private paintTrack(track: TrackSurface): void {
    const ratio = Math.min(2, window.devicePixelRatio);
    const width = track.canvas.clientWidth;
    const height = track.canvas.clientHeight;
    track.canvas.width = Math.max(1, Math.round(width * ratio));
    track.canvas.height = Math.max(1, Math.round(height * ratio));
    track.context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const draw: HistogramDraw = { context: track.context, width, height };
    this.drawHistogram(draw);
  }
  /** Activity over the whole history, with the playhead. */
  drawHistogram(request: HistogramDraw): void {
    const { context: c, width, height } = request;
    c.clearRect(0, 0, width, height);
    const now = Date.now();
    const start = this.world.ledger.start(now);
    const playhead = ((this.head - start) / Math.max(1, now - start)) * width;
    const totals = this.buckets.map(
      (b) => b.work + b.commit + b.bad + b.done + b.assign,
    );
    const max = Math.max(4, ...totals);
    const barWidth = width / Math.max(1, this.buckets.length);
    const base = height - 14;
    this.buckets.forEach((bucket, index) => {
      const x = index * barWidth;
      const future = Number(x > playhead);
      let y = base;
      for (const [key, color] of SkyStage.LAYERS.filter(
        ([key]) => bucket[key] > 0,
      )) {
        const size = (Math.sqrt(bucket[key]) / Math.sqrt(max)) * (base - 4);
        const shade: Shade = {
          color,
          alpha:
            (0.55 + 0.35 * Number(key !== "work")) * (1 - future) +
            0.14 * future,
        };
        c.fillStyle = this.palette.rgba(shade);
        c.fillRect(x + 0.5, y - size, Math.max(1, barWidth - 1.5), size);
        y -= size;
      }
    });
    c.fillStyle = "rgba(207,224,255,0.4)";
    c.font = `9.5px ${SkyScene.MONO}`;
    c.textAlign = "left";
    c.fillText(this.clockText(start), 0, height - 2);
    c.textAlign = "right";
    c.fillText("now", width, height - 2);
    const live = Number(this.mode === PlayMode.Live);
    const tone: Blend = { from: "#ffffff", to: "#ff4d63", amount: live };
    c.strokeStyle = this.palette.mix(tone);
    c.shadowColor = c.strokeStyle;
    c.shadowBlur = 10;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(playhead, 0);
    c.lineTo(playhead, base + 2);
    c.stroke();
    c.shadowBlur = 0;
  }
  stateColor(state: FlowState): string {
    return Glyphs.COLOR[state];
  }
  teamColor(team: string): string {
    return this.scene.team(team).color;
  }
  teamName(team: string): string {
    return this.scene.team(team).name;
  }
  conditionColor(condition: SkyCondition): string {
    return SkyScene.CONDITION[condition];
  }
  static readonly CONDITION_LABEL: Record<SkyCondition, string> = {
    attention: "Attention",
    active: "Active",
    waiting: "Waiting",
    finished: "Finished",
    empty: "Quiet",
  };
  static readonly PACES: ReadonlyArray<readonly [Pace, string]> = [
    [Pace.Slow, "90 s"],
    [Pace.Normal, "45 s"],
    [Pace.Fast, "15 s"],
  ];
  /** Event marks for the key, in the colours the scene draws them. */
  static readonly MARKS: ReadonlyArray<readonly [string, string, string]> = [
    ["◆", "#8ff3ff", "Checkpoint: a commit was recorded"],
    ["✓", "#7dffb2", "A check passed"],
    ["✕", "#ff4d63", "A check failed"],
    ["↺", "#9fb0d8", "Requeued after review"],
    ["•→", "#ffe2a8", "Gold pulse: assignment out, handoff in"],
    ["☄", "#ffffff", "Comet: an agent; idle ones orbit Gizmo Prime"],
    ["⁘", "#a6f3ff", "Spiral cluster: an agent's finished work"],
  ];
  /** What the tooltip says about the thing under the pointer. */
  card(hit: SkyHit): TipCard {
    switch (hit.kind) {
      case HitKind.Task:
        return this.taskCard(hit.task);
      case HitKind.Agent:
        return this.agentCard(hit.agent);
      case HitKind.Team:
        return {
          chip: "team",
          tone: hit.team.color,
          title: hit.team.name,
          rows: [],
          action: "",
        };
      case HitKind.Feature:
        return this.featureCard(hit.feature);
      case HitKind.Core:
        return {
          chip: "coordination",
          tone: "#ffe2a8",
          title: "Gizmo Prime",
          rows: [["role", "Owns the outcome and acceptance criteria"]],
          action: "Click · show the whole sky",
        };
    }
  }
  private taskCard(task: SkyTask): TipCard {
    const lease = this.world.stalled(task);
    const kind = this.kinds.kind({ state: task.state, lease });
    const rows: TipRow[] = [
      ["agent", this.world.agent(task.record.agent).name],
      ["feature", task.record.feature.replace(/-/g, " ")],
      ["reports to", task.record.reportsTo],
      ["record", `${task.passed} ✓ · ${task.failed} ✕ · ${task.commits} ◆`],
      ["last", `${task.note} · ${this.age(this.world.time - task.lastAt)} ago`],
    ];
    const commit = this.scene.commit(task);
    return {
      chip: kind,
      tone: Glyphs.COLOR[kind],
      title: task.record.objective,
      rows: rows.concat(this.commitRow(commit)),
      action: `Click · focus on ${this.world.agent(task.record.agent).name}`,
    };
  }
  private commitRow(commit: string): ReadonlyArray<TipRow> {
    const row: TipRow = ["commit", commit];
    return [row].filter(() => commit.length > 0);
  }
  private agentCard(agent: SkyAgent): TipCard {
    const current = this.world.tasks
      .values()
      .filter(
        (task) =>
          agent.duty.kind === DutyKind.Busy &&
          task.record.id === agent.duty.task,
      )
      .map((task) => task.record.objective)
      .concat("Idle · orbiting Gizmo Prime")
      .slice(0, 1)
      .join("");
    return {
      chip: "agent",
      tone: this.teamColor(agent.team),
      title: agent.name,
      rows: [
        ["worker", agent.worker],
        ["lease", this.world.lease(agent)],
        ["now", current],
        [
          "record",
          `${agent.stats.done} done · ${agent.stats.passed} ✓ · ${agent.stats.failed} ✕ · ${agent.stats.commits} ◆`,
        ],
      ],
      action: "Click · open this agent's star",
    };
  }
  private featureCard(feature: SkyFeature): TipCard {
    const tasks = this.world.featureTasks(feature.id);
    const counts = this.world.counts(tasks);
    return {
      chip: this.world.condition(tasks),
      tone: SkyScene.CONDITION[this.world.condition(tasks)],
      title: feature.title,
      rows: [
        ["objective", feature.objective],
        ["branch", feature.branch],
        [
          "tasks",
          `${counts.completed} done · ${counts.working} working · ${counts.blocked} blocked · ${counts.queued} queued`,
        ],
      ],
      action: "Click · fly to this feature",
    };
  }
}
interface TrackSurface {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
}
type TipRow = readonly [string, string];
export interface TipCard {
  readonly chip: string;
  readonly tone: string;
  readonly title: string;
  readonly rows: ReadonlyArray<TipRow>;
  readonly action: string;
}
interface ReplayStep {
  readonly step: number;
  readonly now: number;
}
interface RowRequest {
  readonly task: SkyTask;
  readonly detail: string;
  readonly alarm: number;
}
/** Whether the "How to read the sky" key is unfolded. */
export enum KeyPanel {
  Closed = "closed",
  Open = "open",
}

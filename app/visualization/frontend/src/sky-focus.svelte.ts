import type { FeedEntry } from "./contracts";
import {
  DutyKind,
  LeaseKind,
  type SkyAgent,
  type SkyEvent,
  type SkyTask,
  type SkyWorld,
} from "./sky-ledger";
import {
  GlowKind,
  Palette,
  Sparks,
  type Blend,
  type GlowRequest,
  type Painter,
  type Point,
  type Shade,
  type SpikeRequest,
  type Viewport,
} from "./sky-paint";

export enum FocusState {
  Closed = "closed",
  Open = "open",
}
enum BoomKind {
  Quiet = "quiet",
  Exploding = "exploding",
}
enum Ignition {
  Pending = "pending",
  Fired = "fired",
}
type Boom =
  | { readonly kind: BoomKind.Quiet }
  | { readonly kind: BoomKind.Exploding; age: number; ignition: Ignition };
/** A coordinator the agent talks to; every task reports to one of them. */
interface Peer {
  readonly id: string;
  readonly name: string;
  readonly angle: number;
  readonly distance: number;
  last: number;
  seen: number;
  /** 1 when the message leaves the agent, -1 when it arrives. */
  direction: number;
  label: string;
}
interface Telemetry {
  readonly velocity: string;
  readonly temperature: string;
  readonly checks: string;
  readonly failed: string;
  readonly commits: string;
  readonly done: string;
  readonly clock: string;
  readonly task: string;
  readonly detail: string;
  readonly glow: number;
  readonly alarm: LeaseKind;
}
interface Caption {
  readonly id: number;
  readonly title: string;
  readonly detail: string;
  readonly color: string;
}
interface LogLine {
  readonly id: string;
  readonly clock: string;
  readonly kind: string;
  readonly text: string;
}
export interface FocusOpen {
  readonly agent: SkyAgent;
  readonly from: Point;
}
export interface FocusDrawRequest {
  readonly painter: Painter;
  readonly viewport: Viewport;
}
interface LinkRequest {
  readonly peer: string;
  readonly label: string;
  readonly direction: number;
}
interface Look {
  readonly color: string;
  readonly heat: number;
  readonly task: ReadonlyArray<SkyTask>;
  readonly lease: LeaseKind;
}
interface Star {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: string;
}
interface StarDraw {
  readonly painter: Painter;
  readonly star: Star;
}
interface InstrumentDraw {
  readonly painter: Painter;
  readonly star: Star;
  readonly look: Look;
  readonly intro: number;
}
interface LinkDraw {
  readonly painter: Painter;
  readonly star: Star;
  readonly peer: Peer;
  readonly reach: number;
  readonly intro: number;
}

/**
 * A documentary close-up of one agent's star. Ledger events make it flare,
 * a completed task makes it go supernova and re-ignite, and every exchange
 * with its coordinator opens a blinking laser link.
 */
export class AgentFocus {
  static readonly GOLD = "#ffe2a8";
  static readonly RED = "#ff4d63";
  static readonly MONO =
    "JetBrains Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace";
  static readonly EMPTY: Telemetry = {
    velocity: "0.00",
    temperature: "3 000",
    checks: "0",
    failed: "",
    commits: "0",
    done: "0",
    clock: "00:00:00",
    task: "Idle · orbiting Gizmo Prime",
    detail: "",
    glow: 0,
    alarm: LeaseKind.Idle,
  };
  state = $state<FocusState>(FocusState.Closed);
  agent = $state.raw<ReadonlyArray<SkyAgent>>([]);
  telemetry = $state.raw<Telemetry>(AgentFocus.EMPTY);
  caption = $state.raw<ReadonlyArray<Caption>>([]);
  log = $state.raw<ReadonlyArray<LogLine>>([]);
  history = $state.raw<ReadonlyArray<number>>(new Array<number>(120).fill(0));
  private clock = 0;
  private from: Point = { x: 0, y: 0 };
  private flare = 0;
  private boom: Boom = { kind: BoomKind.Quiet };
  private peers: Peer[] = [];
  private sample = 0;
  private shown = { velocity: 0, temperature: 3000 };
  private captions = 0;
  readonly sparks = new Sparks();
  private readonly palette = new Palette();
  constructor(private world: SkyWorld) {}
  watch(world: SkyWorld): void {
    this.world = world;
  }
  open(request: FocusOpen): void {
    this.state = FocusState.Open;
    this.agent = [request.agent];
    this.clock = 0;
    this.from = request.from;
    this.flare = 0.6;
    this.boom = { kind: BoomKind.Quiet };
    this.history = new Array<number>(120).fill(0);
    this.shown = { velocity: 0, temperature: 3000 };
    this.caption = [];
    this.peers = [
      {
        id: "Gizmo",
        name: "Team Gizmo",
        angle: -2.55,
        distance: 0.95,
        last: -99,
        seen: -99,
        direction: 1,
        label: "",
      },
      {
        id: "GizmoPrime",
        name: "Gizmo Prime",
        angle: -1.95,
        distance: 1.12,
        last: -99,
        seen: -99,
        direction: 1,
        label: "",
      },
      {
        id: "Host",
        name: "Host",
        angle: -1.3,
        distance: 1.05,
        last: -99,
        seen: -99,
        direction: 1,
        label: "",
      },
    ];
    this.log = this.world.ledger.events
      .filter((event) => event.entry.at <= this.world.time)
      .filter((event) => this.mine(event))
      .filter((event) => event.entry.kind !== "heartbeat")
      .slice(-5)
      .reverse()
      .map((event) => this.line(event));
  }
  /** The activity history as SVG polyline points in a 300×56 box. */
  sparkline(): string {
    const last = Math.max(1, this.history.length - 1);
    return this.history
      .map((value, index) => {
        const x = (index / last) * 300;
        const y = 52 - Math.min(1, value / 2.4) * 48;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }
  close(): void {
    this.state = FocusState.Closed;
    this.agent = [];
  }
  /** Step to the previous or next agent. */
  step(offset: number): void {
    const agents = this.world.agents.values();
    for (const current of this.agent) {
      const index = agents.findIndex((agent) => agent.key === current.key);
      const next =
        (index + offset + agents.length) % Math.max(1, agents.length);
      for (const agent of agents.slice(next, next + 1)) {
        const request: FocusOpen = { agent, from: this.from };
        this.open(request);
      }
    }
  }
  index(): string {
    const agents = this.world.agents.values();
    return this.agent
      .map(
        (current) => agents.findIndex((agent) => agent.key === current.key) + 1,
      )
      .map(
        (position) =>
          `AGENT ${String(position).padStart(2, "0")} / ${agents.length}`,
      )
      .join("");
  }
  private mine(event: SkyEvent): boolean {
    return this.agent.some((agent) =>
      this.world.ledger.tasks
        .find(event.task)
        .some((record) => record.agent === agent.key),
    );
  }
  private line(event: SkyEvent): LogLine {
    const objective = this.world.ledger.tasks
      .find(event.task)
      .map((record) => record.objective)
      .join("");
    return {
      id: event.key,
      clock: this.stamp(
        event.entry.at - this.world.ledger.start(this.world.time),
      ),
      kind: event.entry.kind.toUpperCase(),
      text: objective,
    };
  }
  private stamp(milliseconds: number): string {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return [seconds / 3600, (seconds / 60) % 60, seconds % 60]
      .map((value) => String(Math.floor(value)).padStart(2, "0"))
      .join(":");
  }

  // ---------- Events ----------
  onEvent(event: SkyEvent): void {
    switch (this.state) {
      case FocusState.Closed:
        return;
      case FocusState.Open:
        break;
    }
    for (const record of this.world.ledger.tasks.find(event.task)) {
      switch (this.mine(event)) {
        case true:
          this.react({ event, coordinator: record.reportsTo });
          break;
        case false:
          break;
      }
    }
  }
  private react(request: ReactRequest): void {
    const entry = request.event.entry;
    const failed = entry.evidence
      .flatMap((p) => p.checks)
      .filter((c) => c.outcome === "failed");
    const link = this.linkFor({
      entry,
      coordinator: request.coordinator,
      failed: failed.length,
    });
    this.link(link);
    switch (entry.kind) {
      case "heartbeat":
        this.flare = Math.min(2, this.flare + 0.06);
        return;
      case "completed":
        this.boom = {
          kind: BoomKind.Exploding,
          age: 0,
          ignition: Ignition.Pending,
        };
        break;
      case "created":
      case "assigned":
      case "claimed":
      case "progress":
      case "checkpoint":
      case "ready":
      case "integrated":
      case "requeued":
      case "cancelled":
        break;
    }
    this.log = [this.line(request.event), ...this.log].slice(0, 6);
    this.flare = Math.min(2.4, this.flare + AgentFocus.BOOST[entry.kind]);
    this.flare =
      this.flare *
      (1 -
        0.92 *
          Number(failed.length > 0 || this.world.flow(entry) === "blocked"));
    const caption = this.captionFor({
      entry,
      failed: failed.map((c) => c.command).join(", "),
    });
    this.captions += 1;
    this.caption = caption.map((c) => ({ ...c, id: this.captions }));
  }
  static readonly BOOST: Record<FeedEntry["kind"], number> = {
    created: 0.3,
    assigned: 0.5,
    claimed: 0.9,
    heartbeat: 0.06,
    progress: 0.35,
    checkpoint: 0.6,
    ready: 1.2,
    integrated: 0.9,
    completed: 0.4,
    requeued: 0.3,
    cancelled: 0.1,
  };
  private linkFor(request: LinkFor): LinkRequest {
    const { entry, coordinator } = request;
    switch (entry.kind) {
      case "created":
      case "assigned":
        return { peer: "GizmoPrime", label: "ASSIGN", direction: -1 };
      case "claimed":
        return { peer: coordinator, label: "ACK", direction: 1 };
      case "heartbeat":
        return { peer: coordinator, label: "HEARTBEAT", direction: 1 };
      case "progress":
        return {
          peer: coordinator,
          label: this.statusLabel(request),
          direction: 1,
        };
      case "checkpoint":
        return {
          peer: coordinator,
          label: `COMMIT ${this.commit(entry)}`,
          direction: 1,
        };
      case "ready":
        return { peer: coordinator, label: "REPORT", direction: 1 };
      case "requeued":
        return { peer: "GizmoPrime", label: "REQUEUE", direction: -1 };
      case "integrated":
        return {
          peer: "GizmoPrime",
          label: `INTEGRATED ${this.commit(entry)}`,
          direction: -1,
        };
      case "completed":
        return { peer: "GizmoPrime", label: "ACCEPTED", direction: -1 };
      case "cancelled":
        return { peer: "GizmoPrime", label: "CANCELLED", direction: -1 };
    }
  }
  private statusLabel(request: LinkFor): string {
    switch (this.world.flow(request.entry)) {
      case "blocked":
        return "BLOCKER";
      case "queued":
      case "working":
      case "ready":
      case "integrated":
      case "completed":
      case "cancelled":
        return this.checkLabel(request.failed);
    }
  }
  private checkLabel(failed: number): string {
    switch (failed > 0) {
      case true:
        return "CHECK FAILED";
      case false:
        return "STATUS";
    }
  }
  private commit(entry: FeedEntry): string {
    switch (entry.checkpoint.kind) {
      case "git":
        return entry.checkpoint.commit.slice(0, 7);
      case "unrecorded":
        return "";
    }
  }
  private link(request: LinkRequest): void {
    for (const peer of this.peers.filter((p) => p.id === request.peer)) {
      peer.last = this.clock;
      peer.seen = this.clock;
      peer.direction = request.direction;
      peer.label = request.label;
    }
    this.flare = Math.min(2.2, this.flare + 0.15);
  }
  private captionFor(request: CaptionFor): ReadonlyArray<Caption> {
    const { entry } = request;
    const objective = entry.objective;
    switch (entry.kind) {
      case "assigned":
        return [
          {
            id: 0,
            title: "NEW ASSIGNMENT",
            detail: objective,
            color: AgentFocus.GOLD,
          },
        ];
      case "claimed":
        return [
          {
            id: 0,
            title: "IGNITION · TASK CLAIMED",
            detail: objective,
            color: "#ffffff",
          },
        ];
      case "progress":
        return this.progressCaption(request);
      case "checkpoint":
        return [
          {
            id: 0,
            title: "CHECKPOINT · COMMIT RECORDED",
            detail: objective,
            color: "#8ff3ff",
          },
        ];
      case "ready":
        return [
          {
            id: 0,
            title: "HANDOFF READY",
            detail: objective,
            color: AgentFocus.GOLD,
          },
        ];
      case "requeued":
        return [
          {
            id: 0,
            title: "REQUEUED · BACK TO WORK",
            detail: objective,
            color: "#9fb0d8",
          },
        ];
      case "integrated":
        return [
          {
            id: 0,
            title: "INTEGRATED BY GIZMO PRIME",
            detail: objective,
            color: AgentFocus.GOLD,
          },
        ];
      case "completed":
        return [
          {
            id: 0,
            title: "SUPERNOVA · TASK COMPLETE",
            detail: objective,
            color: "#a6f3ff",
          },
        ];
      case "cancelled":
        return [
          {
            id: 0,
            title: "COLLAPSE · TASK CANCELLED",
            detail: objective,
            color: "#8890a0",
          },
        ];
      case "created":
      case "heartbeat":
        return [];
    }
  }
  private progressCaption(request: CaptionFor): ReadonlyArray<Caption> {
    const blocked = Number(this.world.flow(request.entry) === "blocked");
    const failed = Number(request.failed.length > 0);
    const texts = [request.entry.summary, request.entry.note].filter(
      (t) => t.length > 0,
    );
    return [
      {
        id: 0,
        title: "BLOCKED",
        detail: texts.slice(0, 1).join(""),
        color: AgentFocus.RED,
      },
    ]
      .filter(() => blocked > 0)
      .concat(
        [
          {
            id: 0,
            title: "CHECK FAILED",
            detail: request.failed,
            color: AgentFocus.RED,
          },
        ].filter(() => blocked === 0 && failed > 0),
      );
  }

  // ---------- Update ----------
  update(seconds: number): void {
    switch (this.state) {
      case FocusState.Closed:
        return;
      case FocusState.Open:
        break;
    }
    this.clock += seconds;
    this.flare *= Math.exp(-1.6 * seconds);
    this.sparks.update(seconds);
    switch (this.boom.kind) {
      case BoomKind.Exploding:
        this.boom.age += seconds;
        this.settleBoom(this.boom.age);
        break;
      case BoomKind.Quiet:
        break;
    }
    this.sample -= seconds;
    switch (this.sample <= 0) {
      case true:
        this.sample = 0.5;
        this.history = this.history
          .slice(1)
          .concat(
            this.flare +
              0.35 * Number(this.looking().heat > 0.3) +
              Math.random() * 0.05,
          );
        this.telemetry = this.measure(seconds);
        break;
      case false:
        break;
    }
  }
  private settleBoom(age: number): void {
    switch (age > 3.2) {
      case true:
        this.boom = { kind: BoomKind.Quiet };
        return;
      case false:
        return;
    }
  }
  private looking(): Look {
    for (const agent of this.agent) return this.look(agent);
    return { color: "#ffffff", heat: 0, task: [], lease: LeaseKind.Idle };
  }
  private look(agent: SkyAgent): Look {
    const task = this.current(agent);
    const lease = this.world.lease(agent);
    const heat = task.map((t) => this.taskHeat(t)).reduce((_, h) => h, 0.18);
    const palette = this.palette;
    const team = Object.entries(AgentFocus.TEAM)
      .filter(([id]) => id === agent.team)
      .map(([, color]) => color)
      .concat("#8a97b8")
      .slice(0, 1)
      .join("");
    const blend: Blend = {
      from: palette.heat(heat),
      to: team,
      amount: 0.15 + 0.3 * Number(task.length === 0),
    };
    const blocked: Blend = {
      from: palette.mix(blend),
      to: AgentFocus.RED,
      amount: 0.6 * Number(task.some((t) => t.state === "blocked")),
    };
    const lost: Blend = {
      from: palette.mix(blocked),
      to: "#7f8db0",
      amount: Number(lease === LeaseKind.Expired),
    };
    return { color: palette.mix(lost), heat, task, lease };
  }
  static readonly TEAM: Record<string, string> = {
    Gizmo: "#ffe2a8",
    Development: "#ff7aa2",
    Ai: "#ffc76b",
    Security: "#6ff0c4",
    Sre: "#6cb8ff",
    Delivery: "#bd9dff",
  };
  private current(agent: SkyAgent): ReadonlyArray<SkyTask> {
    switch (agent.duty.kind) {
      case DutyKind.Busy:
        return this.world.tasks.find(agent.duty.task);
      case DutyKind.Idle:
        return this.world.tasks
          .values()
          .filter((task) => task.record.agent === agent.key)
          .filter(
            (task) => task.state === "ready" || task.state === "integrated",
          )
          .slice(0, 1);
    }
  }
  private taskHeat(task: SkyTask): number {
    switch (task.state) {
      case "working":
        return 0.3 + this.world.heat(task) * 0.65;
      case "blocked":
        return 0.1;
      case "ready":
      case "integrated":
        return 0.9;
      case "queued":
      case "completed":
      case "cancelled":
        return 0.18;
    }
  }
  private measure(seconds: number): Telemetry {
    for (const agent of this.agent) return this.reading({ agent, seconds });
    return AgentFocus.EMPTY;
  }
  private reading(request: ReadingRequest): Telemetry {
    const { agent } = request;
    const look = this.look(agent);
    const recent = this.world.ledger.events.filter(
      (event) =>
        event.entry.at <= this.world.time &&
        this.world.time - event.entry.at < 300_000 &&
        event.entry.actor.team !== "Gizmo" &&
        this.world.ledger.tasks
          .find(event.task)
          .some((r) => r.agent === agent.key),
    ).length;
    const glide = 1 - Math.exp(-5 * 0.5);
    this.shown.velocity += (recent / 5 - this.shown.velocity) * glide;
    this.shown.temperature +=
      (2800 + look.heat * 9200 + this.flare * 2400 - this.shown.temperature) *
      glide;
    const task = look.task;
    return {
      velocity: this.shown.velocity.toFixed(2),
      temperature: this.number(Math.round(this.shown.temperature / 10) * 10),
      checks: this.number(agent.stats.passed),
      failed: ["passed"]
        .concat(`${agent.stats.failed} failed`)
        .slice(0, 1 + Number(agent.stats.failed > 0))
        .join(" · "),
      commits: this.number(agent.stats.commits),
      done: this.number(agent.stats.done),
      clock: `${this.stamp(this.world.time - this.world.ledger.start(this.world.time))} · lease ${look.lease}`,
      task: task
        .map((t) => t.record.objective)
        .concat("Idle · orbiting Gizmo Prime")
        .slice(0, 1)
        .join(""),
      detail: task
        .map(
          (t) =>
            `${t.record.feature.replace(/-/g, " ")} · ${t.state} · ${t.passed} ✓ ${t.failed} ✕ · ${t.commits} commits`,
        )
        .join(""),
      glow: task.map((t) => this.world.heat(t)).reduce((_, h) => h, 0),
      alarm: look.lease,
    };
  }
  private number(value: number): string {
    return value.toLocaleString("en-US").replace(/,/g, " ");
  }

  // ---------- Draw ----------
  draw(request: FocusDrawRequest): void {
    for (const agent of this.agent) {
      const draw: AgentDraw = { ...request, agent };
      this.drawAgent(draw);
    }
  }
  private drawAgent(request: AgentDraw): void {
    const { painter, viewport } = request;
    const c = painter.context;
    const intro = 1 - Math.pow(1 - Math.min(1, this.clock / 0.9), 3);
    const narrow = Number(viewport.width < 900);
    const cx = viewport.width * (0.4 + 0.1 * narrow);
    const cy = viewport.height * (0.5 - 0.14 * narrow);
    const radius =
      Math.min(viewport.width, viewport.height) * (0.085 - 0.015 * narrow);
    const look = this.look(request.agent);
    const star: Star = {
      x: this.from.x + (cx - this.from.x) * intro,
      y: this.from.y + (cy - this.from.y) * intro,
      radius,
      color: look.color,
    };
    const vignette = c.createRadialGradient(
      cx,
      cy,
      radius,
      cx,
      cy,
      Math.max(viewport.width, viewport.height) * 0.75,
    );
    vignette.addColorStop(0, `rgba(2,3,9,${0.86 * intro})`);
    vignette.addColorStop(1, `rgba(1,1,4,${0.95 * intro})`);
    c.fillStyle = vignette;
    c.fillRect(0, 0, viewport.width, viewport.height);
    c.globalCompositeOperation = "lighter";
    const reach = Math.min(viewport.width, viewport.height) * 0.36;
    for (const peer of this.peers)
      this.drawLink({ painter, star, peer, reach, intro });
    this.drawInstrument({ painter, star, look, intro });
    const body: Star = { ...star, radius: radius * (0.4 + 0.6 * intro) };
    this.drawStar({ painter, star: body });
    this.sparks.draw(painter);
    c.globalCompositeOperation = "source-over";
  }
  private drawStar(request: StarDraw): void {
    const { painter } = request;
    const c = painter.context;
    const scale = this.boomScale(request);
    const star: Star = {
      ...request.star,
      radius: request.star.radius * scale.size,
    };
    const flare = scale.flare;
    const { x, y, radius, color } = star;
    const twinkle =
      1 +
      0.05 * Math.sin(this.clock * 3.1) +
      0.03 * Math.sin(this.clock * 7.7 + 1);
    const blaze = (1 + flare * 0.55) * twinkle;
    const halo: GlowRequest = {
      x,
      y,
      radius: radius * 6 * Math.min(blaze, 1.8),
      color,
      alpha: Math.min(0.42, 0.18 + flare * 0.1),
      kind: GlowKind.Halo,
    };
    painter.glow(halo);
    const corona = c.createRadialGradient(
      x,
      y,
      radius * 0.45,
      x,
      y,
      radius * 2.4 * blaze,
    );
    const white: Blend = { from: color, to: "#ffffff", amount: 0.3 };
    const inner: Shade = { color: this.palette.mix(white), alpha: 0.32 };
    const middle: Shade = { color, alpha: 0.1 };
    const outer: Shade = { color, alpha: 0 };
    corona.addColorStop(0, painter.palette.rgba(inner));
    corona.addColorStop(0.35, painter.palette.rgba(middle));
    corona.addColorStop(1, painter.palette.rgba(outer));
    c.strokeStyle = corona;
    c.lineCap = "round";
    c.lineWidth = Math.max(0.5, radius * 0.012);
    c.beginPath();
    for (const ray of AgentFocus.RAYS) {
      const angle =
        (ray / AgentFocus.RAYS.length) * Math.PI * 2 +
        Math.sin(ray * 12.9898) * 0.02 +
        this.clock * 0.02;
      const wave =
        (0.5 + 0.5 * Math.sin(this.clock * 0.9 + ray * 2.39)) *
        (0.5 + 0.5 * Math.sin(this.clock * 0.37 + ray * 0.71));
      const length = radius * (0.6 + wave * wave * 1.6) * blaze;
      c.moveTo(
        x + Math.cos(angle) * radius * 0.5,
        y + Math.sin(angle) * radius * 0.5,
      );
      c.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    }
    c.stroke();
    for (const streamer of [0, 1, 2, 3, 4, 5]) {
      const angle =
        streamer * 1.047 +
        this.clock * 0.05 +
        Math.sin(this.clock * 0.4 + streamer) * 0.2;
      const distance =
        radius * (0.9 + 0.25 * Math.sin(this.clock * 0.7 + streamer * 2));
      const glow: GlowRequest = {
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        radius: radius * 0.9 * blaze,
        color,
        alpha: 0.22,
        kind: GlowKind.Halo,
      };
      painter.glow(glow);
    }
    const body: GlowRequest = {
      x,
      y,
      radius: radius * 2.2 * blaze,
      color,
      alpha: 0.75,
      kind: GlowKind.Core,
    };
    painter.glow(body);
    const photosphere = c.createRadialGradient(
      x - radius * 0.12,
      y - radius * 0.12,
      0,
      x,
      y,
      radius * 0.62,
    );
    const bright: Blend = { from: color, to: "#ffffff", amount: 0.55 };
    const edge: Shade = { color, alpha: 0 };
    photosphere.addColorStop(0, "#ffffff");
    photosphere.addColorStop(0.5, this.palette.mix(bright));
    photosphere.addColorStop(0.88, color);
    photosphere.addColorStop(1, painter.palette.rgba(edge));
    c.fillStyle = photosphere;
    c.beginPath();
    c.arc(x, y, radius * 0.62, 0, Math.PI * 2);
    c.fill();
    const long: SpikeRequest = {
      x,
      y,
      length: radius * 3.2 * blaze,
      color: "#ffffff",
      alpha: 0.3 + flare * 0.2,
      angle: 0.18,
    };
    painter.spikes(long);
  }
  static readonly RAYS: ReadonlyArray<number> = Array.from(
    { length: 180 },
    (_, i) => i,
  );
  /** Supernova: a flash, then the star re-ignites from a pinpoint. */
  private boomScale(request: StarDraw): BoomScale {
    switch (this.boom.kind) {
      case BoomKind.Quiet:
        return { size: 1, flare: this.flare };
      case BoomKind.Exploding: {
        const explosion: Explosion = { ...request, boom: this.boom };
        return this.exploding(explosion);
      }
    }
  }
  private exploding(request: Explosion): BoomScale {
    const { painter, star, boom } = request;
    const age = boom.age;
    switch (boom.ignition) {
      case Ignition.Pending:
        boom.ignition = Ignition.Fired;
        this.sparks.burst({
          x: star.x,
          y: star.y,
          color: star.color,
          count: 220,
          speed: star.radius * 9,
          life: 2.6,
        });
        this.sparks.burst({
          x: star.x,
          y: star.y,
          color: "#ffffff",
          count: 60,
          speed: star.radius * 5,
          life: 1.4,
        });
        this.sparks.ring({
          x: star.x,
          y: star.y,
          color: "#ffffff",
          radius: star.radius * 7,
          life: 1.4,
        });
        this.sparks.ring({
          x: star.x,
          y: star.y,
          color: star.color,
          radius: star.radius * 11,
          life: 2.2,
        });
        break;
      case Ignition.Fired:
        break;
    }
    const flash = Math.max(0, 1 - age / 0.25);
    const remnant = Math.min(1, Math.max(0, (age - 0.25) / 2.6));
    const flashGlow: GlowRequest = {
      x: star.x,
      y: star.y,
      radius: star.radius * 12,
      color: "#ffffff",
      alpha: flash * 0.85,
      kind: GlowKind.Core,
    };
    painter.glow(flashGlow);
    const nebula: GlowRequest = {
      x: star.x,
      y: star.y,
      radius: star.radius * (3 + remnant * 9),
      color: star.color,
      alpha: (1 - remnant) * 0.5 * Number(age >= 0.25),
      kind: GlowKind.Halo,
    };
    painter.glow(nebula);
    const reignite =
      1 - Math.pow(1 - Math.min(1, Math.max(0, (age - 1.4) / 1.2)), 3);
    const size =
      (1 + age * 3) * Number(age < 0.25) +
      Math.max(0.05, reignite) * Number(age >= 0.25);
    return { size, flare: 1.4 - 0.2 * Number(age >= 0.25) };
  }
  /** Rotating gauge rings around the star, like a mission feed. */
  private drawInstrument(request: InstrumentDraw): void {
    const { painter, star, look, intro } = request;
    const c = painter.context;
    const inner = star.radius * 2.25;
    const outer = star.radius * 2.75;
    c.save();
    c.globalAlpha = intro;
    c.translate(star.x, star.y);
    c.strokeStyle = "rgba(207,224,255,0.22)";
    c.lineWidth = 1;
    c.rotate(this.clock * 0.04);
    for (const tick of AgentFocus.TICKS) {
      const angle = (tick / AgentFocus.TICKS.length) * Math.PI * 2;
      const length = 4 + 5 * Number(tick % 10 === 0);
      c.beginPath();
      c.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      c.lineTo(
        Math.cos(angle) * (inner + length),
        Math.sin(angle) * (inner + length),
      );
      c.stroke();
    }
    c.rotate(-this.clock * 0.1);
    c.setLineDash([2, 6]);
    c.strokeStyle = "rgba(207,224,255,0.16)";
    c.beginPath();
    c.arc(0, 0, outer, 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.fillStyle = "rgba(207,224,255,0.4)";
    c.font = `9px ${AgentFocus.MONO}`;
    c.textAlign = "center";
    for (const mark of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      const angle = (mark / 12) * Math.PI * 2;
      c.fillText(
        String(mark * 30).padStart(3, "0"),
        Math.cos(angle) * (outer + 12),
        Math.sin(angle) * (outer + 12) + 3,
      );
    }
    c.restore();
    const glow = look.task
      .map((task) => this.world.heat(task))
      .reduce((_, h) => h, 0);
    const start = -Math.PI / 2;
    const track: Shade = { color: star.color, alpha: 0.18 * intro };
    c.lineCap = "butt";
    c.strokeStyle = painter.palette.rgba(track);
    c.lineWidth = 3;
    c.beginPath();
    c.arc(star.x, star.y, inner - 6, 0, Math.PI * 2);
    c.stroke();
    const arc: Shade = { color: star.color, alpha: 0.95 * intro };
    c.strokeStyle = painter.palette.rgba(arc);
    c.beginPath();
    c.arc(star.x, star.y, inner - 6, start, start + glow * Math.PI * 2);
    c.stroke();
    const tip: GlowRequest = {
      x: star.x + Math.cos(start + glow * Math.PI * 2) * (inner - 6),
      y: star.y + Math.sin(start + glow * Math.PI * 2) * (inner - 6),
      radius: 10,
      color: star.color,
      alpha: intro,
      kind: GlowKind.Core,
    };
    painter.glow(tip);
  }
  static readonly TICKS: ReadonlyArray<number> = Array.from(
    { length: 120 },
    (_, i) => i,
  );
  /** Laser links to coordinators; they blink while a message is in flight. */
  private drawLink(request: LinkDraw): void {
    const { painter, star, peer, reach, intro } = request;
    const c = painter.context;
    const end: Point = {
      x: star.x + Math.cos(peer.angle) * reach * peer.distance,
      y: star.y + Math.sin(peer.angle) * reach * peer.distance,
    };
    const since = this.clock - peer.last;
    const talking = Number(since < 1.8);
    const recency = Math.max(0, 1 - (this.clock - peer.seen) / 25);
    const thread: Shade = {
      color: AgentFocus.GOLD,
      alpha: (0.07 + recency * 0.18) * intro,
    };
    c.strokeStyle = painter.palette.rgba(thread);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(star.x, star.y);
    c.lineTo(end.x, end.y);
    c.stroke();
    const fade = Math.max(0, 1 - since / 1.8) * talking;
    const blink = 0.3 + 0.7 * Number(Math.sin(this.clock * 38) > -0.2);
    const beam: Shade = { color: AgentFocus.GOLD, alpha: 0.28 * blink * fade };
    c.strokeStyle = painter.palette.rgba(beam);
    c.lineWidth = 7;
    c.stroke();
    const core: Shade = { color: "#ffffff", alpha: 0.95 * blink * fade };
    c.strokeStyle = painter.palette.rgba(core);
    c.lineWidth = 1.4;
    c.stroke();
    for (const packet of [0, 0.2, 0.4, 0.6, 0.8]) {
      const raw = (this.clock * 1.4 + packet) % 1;
      const q =
        raw * Number(peer.direction > 0) +
        (1 - raw) * Number(peer.direction < 0);
      const glow: GlowRequest = {
        x: star.x + (end.x - star.x) * q,
        y: star.y + (end.y - star.y) * q,
        radius: 9,
        color: AgentFocus.GOLD,
        alpha: fade,
        kind: GlowKind.Core,
      };
      painter.glow(glow);
    }
    const node: GlowRequest = {
      x: end.x,
      y: end.y,
      radius: 22 * (1 + recency * 0.5),
      color: AgentFocus.GOLD,
      alpha: (0.5 + recency * 0.5) * intro,
      kind: GlowKind.Core,
    };
    painter.glow(node);
    c.globalCompositeOperation = "source-over";
    c.font = `600 10px ${AgentFocus.MONO}`;
    c.textAlign = "center";
    c.fillStyle = `rgba(255,226,168,${0.85 * intro})`;
    c.fillText(peer.name.toUpperCase(), end.x, end.y + 36);
    c.globalAlpha = fade;
    const mid: Point = {
      x: (star.x + end.x) / 2,
      y: (star.y + end.y) / 2 - 12,
    };
    const width = c.measureText(peer.label).width + 14;
    c.fillStyle = "rgba(4,6,14,0.85)";
    c.fillRect(mid.x - width / 2, mid.y - 9, width, 18);
    c.strokeStyle = "rgba(255,226,168,0.8)";
    c.strokeRect(mid.x - width / 2, mid.y - 9, width, 18);
    c.fillStyle = AgentFocus.GOLD;
    c.fillText(peer.label, mid.x, mid.y + 3.5);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "lighter";
  }
}

interface ReactRequest {
  readonly event: SkyEvent;
  readonly coordinator: string;
}
interface LinkFor {
  readonly entry: FeedEntry;
  readonly coordinator: string;
  readonly failed: number;
}
interface CaptionFor {
  readonly entry: FeedEntry;
  readonly failed: string;
}
interface ReadingRequest {
  readonly agent: SkyAgent;
  readonly seconds: number;
}
interface AgentDraw extends FocusDrawRequest {
  readonly agent: SkyAgent;
}
interface Explosion extends StarDraw {
  readonly boom: Extract<Boom, { kind: BoomKind.Exploding }>;
}
interface BoomScale {
  readonly size: number;
  readonly flare: number;
}

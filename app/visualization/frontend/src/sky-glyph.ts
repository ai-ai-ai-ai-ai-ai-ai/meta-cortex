import type { FlowState } from "./contracts";
import { LeaseKind } from "./sky-ledger";
import { Match } from "effect";
import {
  GlowKind,
  Painter,
  type Blend,
  type DiamondRequest,
  type GlowRequest,
  type Shade,
  type SpikeRequest,
} from "./sky-paint";

/** The visible state of a task star; `Stalled` is working with a lapsed lease. */
export enum GlyphKind {
  Queued = "queued",
  Working = "working",
  Stalled = "stalled",
  Blocked = "blocked",
  Ready = "ready",
  Integrated = "integrated",
  Completed = "completed",
  Cancelled = "cancelled",
}
export interface GlyphRequest {
  readonly x: number;
  readonly y: number;
  readonly kind: GlyphKind;
  /** 0..1 recency glow. */
  readonly heat: number;
  /** Base radius in pixels. */
  readonly size: number;
  readonly tint: string;
  readonly time: number;
  readonly seed: number;
  /** 0..1, how recently a completed star was born. */
  readonly fresh: number;
}
export interface GlyphState {
  readonly state: FlowState;
  readonly lease: LeaseKind;
}
interface GlyphRing extends GlyphRequest {
  readonly radius: number;
}
interface LegendEntry {
  readonly kind: GlyphKind;
  readonly label: string;
}

/** Maps a task's flow state and lease to the glyph that draws it. */
export class GlyphKinds {
  kind(request: GlyphState): GlyphKind {
    switch (request.state) {
      case "working":
        return this.workingKind(request.lease);
      case "queued":
        return GlyphKind.Queued;
      case "blocked":
        return GlyphKind.Blocked;
      case "ready":
        return GlyphKind.Ready;
      case "integrated":
        return GlyphKind.Integrated;
      case "completed":
        return GlyphKind.Completed;
      case "cancelled":
        return GlyphKind.Cancelled;
    }
  }
  private workingKind(lease: LeaseKind): GlyphKind {
    switch (lease) {
      case LeaseKind.Expired:
        return GlyphKind.Stalled;
      case LeaseKind.Idle:
      case LeaseKind.Current:
        return GlyphKind.Working;
    }
  }
}

/**
 * One drawing per task state, shared by the scene, the side rails and the key,
 * so the legend always matches what is on screen.
 */
export class Glyphs {
  static readonly COLOR: Record<GlyphKind, string> = {
    queued: "#8a97b8",
    working: "#ffb35c",
    stalled: "#8f9dc4",
    blocked: "#ff4d63",
    ready: "#ffe2a8",
    integrated: "#ffffff",
    completed: "#a6f3ff",
    cancelled: "#5c5f70",
  };
  static readonly LEGEND: ReadonlyArray<LegendEntry> = [
    { kind: GlyphKind.Queued, label: "Queued · not lit yet" },
    { kind: GlyphKind.Working, label: "Working · glow is fresh activity" },
    { kind: GlyphKind.Blocked, label: "Blocked" },
    { kind: GlyphKind.Stalled, label: "Lease expired · signal lost" },
    { kind: GlyphKind.Ready, label: "Ready · waiting for review" },
    { kind: GlyphKind.Integrated, label: "Integrated · commit landed" },
    { kind: GlyphKind.Completed, label: "Completed · a fixed star" },
  ];
  constructor(private readonly painter: Painter) {}
  private readonly kinds = new GlyphKinds();
  kind(request: GlyphState): GlyphKind {
    return this.kinds.kind(request);
  }
  draw(request: GlyphRequest): void {
    switch (request.kind) {
      case GlyphKind.Queued:
        return this.queued(request);
      case GlyphKind.Working:
        return this.working(request);
      case GlyphKind.Stalled:
        return this.stalled(request);
      case GlyphKind.Blocked:
        return this.blocked(request);
      case GlyphKind.Ready:
        return this.ready(request);
      case GlyphKind.Integrated:
        return this.integrated(request);
      case GlyphKind.Completed:
        return this.completed(request);
      case GlyphKind.Cancelled:
        return this.cancelled(request);
    }
  }
  private glow(request: GlowRequest): void {
    this.painter.glow(request);
  }
  private shade(shade: Shade): string {
    return this.painter.palette.rgba(shade);
  }
  private ring(request: GlyphRing): void {
    const c = this.painter.context;
    c.beginPath();
    c.arc(request.x, request.y, request.radius, 0, Math.PI * 2);
    c.stroke();
  }
  private queued(r: GlyphRequest): void {
    const c = this.painter.context;
    const stroke: Shade = { color: Glyphs.COLOR.queued, alpha: 0.75 };
    c.strokeStyle = this.shade(stroke);
    c.lineWidth = Math.max(1, r.size * 0.28);
    const ring: GlyphRing = { ...r, radius: r.size * 0.95 };
    this.ring(ring);
    const halo: GlowRequest = {
      x: r.x,
      y: r.y,
      radius: r.size * 2.4,
      color: Glyphs.COLOR.queued,
      alpha: 0.18 + 0.1 * Math.sin(r.time * 2 + r.seed * 9),
      kind: GlowKind.Core,
    };
    this.glow(halo);
  }
  private working(r: GlyphRequest): void {
    const color = this.painter.palette.heat(0.28 + r.heat * 0.72);
    const twinkle =
      1 +
      0.14 * Math.sin(r.time * 8 + r.seed * 30) +
      0.06 * Math.sin(r.time * 17 + r.seed * 7);
    const body: GlowRequest = {
      x: r.x,
      y: r.y,
      radius: r.size * (3.4 + r.heat * 3.2) * twinkle,
      color,
      alpha: 0.65 + r.heat * 0.35,
      kind: GlowKind.Core,
    };
    this.glow(body);
    const core: GlowRequest = {
      ...body,
      radius: r.size * 1.3,
      color: "#ffffff",
      alpha: 0.5 + r.heat * 0.5,
    };
    this.glow(core);
    const spikes: SpikeRequest = {
      x: r.x,
      y: r.y,
      length: r.size * 4 * r.heat,
      color,
      alpha: Math.max(0, r.heat - 0.72) * 2,
      angle: 0.3 + r.seed,
    };
    this.painter.spikes(spikes);
  }
  private stalled(r: GlyphRequest): void {
    const c = this.painter.context;
    const body: GlowRequest = {
      x: r.x,
      y: r.y,
      radius: r.size * 3,
      color: Glyphs.COLOR.stalled,
      alpha: 0.35 + 0.2 * Math.sin(r.time * 1.4 + r.seed),
      kind: GlowKind.Core,
    };
    this.glow(body);
    const stroke: Shade = { color: "#9fb0d8", alpha: 0.55 };
    c.setLineDash([2, 3]);
    c.strokeStyle = this.shade(stroke);
    c.lineWidth = 1;
    c.beginPath();
    c.arc(r.x, r.y, r.size * 2.1, r.time * 0.6, r.time * 0.6 + Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
  }
  private blocked(r: GlyphRequest): void {
    const c = this.painter.context;
    const flicker =
      0.35 + 0.65 * Number(Math.sin(r.time * 23 + r.seed * 50) > -0.6);
    const body: GlowRequest = {
      x: r.x,
      y: r.y,
      radius: r.size * 3.6,
      color: Glyphs.COLOR.blocked,
      alpha: 0.9 * flicker,
      kind: GlowKind.Core,
    };
    this.glow(body);
    const halo: GlowRequest = {
      ...body,
      radius: r.size * (6 + 1.6 * Math.sin(r.time * 4)),
      alpha: 0.22,
      kind: GlowKind.Halo,
    };
    this.glow(halo);
    const stroke: Shade = { color: Glyphs.COLOR.blocked, alpha: 0.7 };
    c.strokeStyle = this.shade(stroke);
    c.lineWidth = 1.2;
    const ring: GlyphRing = { ...r, radius: r.size * 2.2 };
    this.ring(ring);
  }
  private ready(r: GlyphRequest): void {
    const c = this.painter.context;
    const gold = Glyphs.COLOR.ready;
    const body: GlowRequest = {
      x: r.x,
      y: r.y,
      radius: r.size * 4.2,
      color: gold,
      alpha: 0.95,
      kind: GlowKind.Core,
    };
    this.glow(body);
    const spikes: SpikeRequest = {
      x: r.x,
      y: r.y,
      length: r.size * 3.2,
      color: gold,
      alpha: 0.3,
      angle: 0.2,
    };
    this.painter.spikes(spikes);
    // Ripples: waiting for Gizmo Prime's review.
    for (const offset of [0, 0.5]) {
      const q = (r.time * 0.6 + offset + r.seed) % 1;
      const stroke: Shade = { color: gold, alpha: (1 - q) * 0.6 };
      c.strokeStyle = this.shade(stroke);
      c.lineWidth = 1;
      const ring: GlyphRing = { ...r, radius: r.size * (1.6 + q * 4.5) };
      this.ring(ring);
    }
  }
  private integrated(r: GlyphRequest): void {
    const body: GlowRequest = {
      x: r.x,
      y: r.y,
      radius: r.size * 6,
      color: "#ffffff",
      alpha: 1,
      kind: GlowKind.Core,
    };
    this.glow(body);
    const spikes: SpikeRequest = {
      x: r.x,
      y: r.y,
      length: r.size * 5,
      color: "#ffffff",
      alpha: 0.45,
      angle: r.time * 0.4,
    };
    this.painter.spikes(spikes);
    const angle = r.time * 2.4 + r.seed * 6;
    const commit: DiamondRequest = {
      x: r.x + Math.cos(angle) * r.size * 3,
      y: r.y + Math.sin(angle) * r.size * 3,
      radius: r.size * 0.9,
      color: "#8ff3ff",
      alpha: 0.9,
    };
    this.painter.diamond(commit);
  }
  private completed(r: GlyphRequest): void {
    const blend: Blend = { from: r.tint, to: "#ffffff", amount: 0.45 };
    const color = this.painter.palette.mix(blend);
    const body: GlowRequest = {
      x: r.x,
      y: r.y,
      radius: r.size * (2.4 + r.fresh * 4),
      color,
      alpha: 0.55 + r.fresh * 0.45,
      kind: GlowKind.Core,
    };
    this.glow(body);
    const spikes: SpikeRequest = {
      x: r.x,
      y: r.y,
      length: r.size * (2 + r.fresh * 4),
      color,
      alpha: r.fresh * 0.45,
      angle: 0.25,
    };
    this.painter.spikes(spikes);
  }
  private cancelled(r: GlyphRequest): void {
    const c = this.painter.context;
    const stroke: Shade = { color: Glyphs.COLOR.cancelled, alpha: 0.8 };
    const d = r.size * 0.8;
    c.strokeStyle = this.shade(stroke);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(r.x - d, r.y - d);
    c.lineTo(r.x + d, r.y + d);
    c.moveTo(r.x + d, r.y - d);
    c.lineTo(r.x - d, r.y + d);
    c.stroke();
  }
}

export interface IconDraw {
  readonly canvas: HTMLCanvasElement;
  readonly kind: GlyphKind;
  readonly heat: number;
  readonly tint: string;
  /** CSS pixels. */
  readonly size: number;
  readonly ratio: number;
}

/** Small glyphs for the side rails, drawn with the scene's own drawings. */
export class GlyphIcons {
  draw(request: IconDraw): void {
    Match.value(request.canvas.getContext("2d")).pipe(
      Match.when(Match.null, () => {}),
      Match.orElse((context) => {
        const { size, ratio } = request;
        request.canvas.width = Math.round(size * ratio);
        request.canvas.height = Math.round(size * ratio);
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        context.clearRect(0, 0, size, size);
        context.globalCompositeOperation = "lighter";
        const glyph: GlyphRequest = {
          x: size / 2,
          y: size / 2,
          kind: request.kind,
          heat: request.heat,
          size: size / 7,
          tint: request.tint,
          time: 1.2,
          seed: 0,
          fresh: 0.3,
        };
        new Glyphs(new Painter(context)).draw(glyph);
        context.globalCompositeOperation = "source-over";
      }),
    );
  }
}

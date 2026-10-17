import { Match } from "effect";

/** Whether a glow keeps its white-hot core or is a soft halo only. */
export enum GlowKind {
  Core = "core",
  Halo = "halo",
}
export interface Point {
  readonly x: number;
  readonly y: number;
}
export type Points = ReadonlyArray<Point>;
export interface Viewport {
  readonly width: number;
  readonly height: number;
}
export interface Shade {
  readonly color: string;
  readonly alpha: number;
}
export interface Blend {
  readonly from: string;
  readonly to: string;
  readonly amount: number;
}
export interface GlowRequest {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: string;
  readonly alpha: number;
  readonly kind: GlowKind;
}
export interface SpikeRequest {
  readonly x: number;
  readonly y: number;
  readonly length: number;
  readonly color: string;
  readonly alpha: number;
  readonly angle: number;
}
export interface TailRequest {
  readonly points: Points;
  readonly color: string;
  readonly width: number;
}
export interface DiamondRequest {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly color: string;
  readonly alpha: number;
}
type Rgb = readonly [number, number, number];

/** Colour arithmetic for the sky; every colour is a `#rrggbb` token. */
export class Palette {
  /** Ember → flame → white-hot → blue-white: recency glow as temperature. */
  static readonly HEAT: ReadonlyArray<string> = [
    "#5c1208",
    "#c2350f",
    "#ff7a1f",
    "#ffc457",
    "#fff1d0",
    "#d8ecff",
  ];
  rgb(color: string): Rgb {
    const value = parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  }
  rgba(shade: Shade): string {
    const [r, g, b] = this.rgb(shade.color);
    return `rgba(${r},${g},${b},${shade.alpha})`;
  }
  mix(blend: Blend): string {
    const [r1, g1, b1] = this.rgb(blend.from);
    const [r2, g2, b2] = this.rgb(blend.to);
    const channels: Rgb = [
      Math.round(r1 + (r2 - r1) * blend.amount),
      Math.round(g1 + (g2 - g1) * blend.amount),
      Math.round(b1 + (b2 - b1) * blend.amount),
    ];
    return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  }
  /** Quantised so the sprite cache stays small. */
  heat(level: number): string {
    const steps = Palette.HEAT.length - 1;
    const scaled = Math.min(1, Math.max(0, level)) * steps;
    const index = Math.min(steps - 1, Math.floor(scaled));
    const blend: Blend = {
      from: Palette.HEAT.slice(index, index + 1).join(""),
      to: Palette.HEAT.slice(index + 1, index + 2).join(""),
      amount: Math.round((scaled - index) * 8) / 8,
    };
    return this.mix(blend);
  }
}

type Sprites = Map<string, HTMLCanvasElement>;

/** Draws glows, spikes, tails and markers onto one 2D context. */
export class Painter {
  static readonly SPRITE = 128;
  readonly palette = new Palette();
  private readonly sprites: Sprites = new Map();
  constructor(readonly context: CanvasRenderingContext2D) {}
  glow(request: GlowRequest): void {
    switch (request.radius > 0.2 && request.alpha > 0.01) {
      case true:
        break;
      case false:
        return;
    }
    const { x, y, radius } = request;
    this.context.globalAlpha = Math.min(1, request.alpha);
    for (const sprite of this.sprite(request)) {
      this.context.drawImage(
        sprite,
        x - radius,
        y - radius,
        radius * 2,
        radius * 2,
      );
    }
    this.context.globalAlpha = 1;
  }
  private sprite(request: GlowRequest): ReadonlyArray<HTMLCanvasElement> {
    const key = `${request.kind}${request.color}`;
    for (const cached of this.cached(key)) return [cached];
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Painter.SPRITE;
    return Match.value(canvas.getContext("2d")).pipe(
      Match.when(Match.null, (): ReadonlyArray<HTMLCanvasElement> => []),
      Match.orElse((context): ReadonlyArray<HTMLCanvasElement> => {
        const half = Painter.SPRITE / 2;
        const gradient = context.createRadialGradient(
          half,
          half,
          0,
          half,
          half,
          half,
        );
        for (const [offset, shade] of this.stops(request)) {
          gradient.addColorStop(offset, shade);
        }
        context.fillStyle = gradient;
        context.fillRect(0, 0, Painter.SPRITE, Painter.SPRITE);
        this.sprites.set(key, canvas);
        return [canvas];
      }),
    );
  }
  private cached(key: string): ReadonlyArray<HTMLCanvasElement> {
    return Match.value(this.sprites.get(key)).pipe(
      Match.when(Match.undefined, (): ReadonlyArray<HTMLCanvasElement> => []),
      Match.orElse((sprite): ReadonlyArray<HTMLCanvasElement> => [sprite]),
    );
  }
  private stops(
    request: GlowRequest,
  ): ReadonlyArray<readonly [number, string]> {
    const shade = (alpha: number): string => {
      const value: Shade = { color: request.color, alpha };
      return this.palette.rgba(value);
    };
    switch (request.kind) {
      case GlowKind.Core:
        return [
          [0, "rgba(255,255,255,1)"],
          [0.08, shade(1)],
          [0.25, shade(0.45)],
          [0.55, shade(0.12)],
          [1, shade(0)],
        ];
      case GlowKind.Halo:
        return [
          [0, shade(0.55)],
          [0.4, shade(0.18)],
          [1, shade(0)],
        ];
    }
  }
  /** Thin diffraction spikes that fall off fast from the core. */
  spikes(request: SpikeRequest): void {
    switch (request.alpha > 0.02 && request.length > 2) {
      case true:
        break;
      case false:
        return;
    }
    const c = this.context;
    const alpha = request.alpha * 0.5;
    c.save();
    c.translate(request.x, request.y);
    c.rotate(request.angle);
    for (const turn of [0, Math.PI / 2]) {
      c.rotate(turn);
      const gradient = c.createLinearGradient(
        -request.length,
        0,
        request.length,
        0,
      );
      for (const [offset, strength] of Painter.SPIKE_STOPS) {
        const shade: Shade = { color: request.color, alpha: alpha * strength };
        gradient.addColorStop(offset, this.palette.rgba(shade));
      }
      c.fillStyle = gradient;
      c.fillRect(-request.length, -0.4, request.length * 2, 0.8);
    }
    c.restore();
  }
  static readonly SPIKE_STOPS: ReadonlyArray<readonly [number, number]> = [
    [0, 0],
    [0.38, 0.18],
    [0.5, 1],
    [0.62, 0.18],
    [1, 0],
  ];
  /** A fading polyline: comet tails and pulse trails. */
  tail(request: TailRequest): void {
    const c = this.context;
    const count = request.points.length;
    c.globalCompositeOperation = "lighter";
    c.lineCap = "round";
    request.points.slice(1).forEach((point, index) => {
      const k = (index + 1) / count;
      const shade: Shade = { color: request.color, alpha: k * k * 0.9 };
      c.strokeStyle = this.palette.rgba(shade);
      c.lineWidth = request.width * k;
      for (const previous of request.points.slice(index, index + 1)) {
        c.beginPath();
        c.moveTo(previous.x, previous.y);
        c.lineTo(point.x, point.y);
        c.stroke();
      }
    });
  }
  diamond(request: DiamondRequest): void {
    const c = this.context;
    const halo: GlowRequest = {
      x: request.x,
      y: request.y,
      radius: request.radius * 4,
      color: request.color,
      alpha: request.alpha * 0.6,
      kind: GlowKind.Core,
    };
    this.glow(halo);
    const shade: Shade = { color: request.color, alpha: request.alpha };
    c.fillStyle = this.palette.rgba(shade);
    c.beginPath();
    c.moveTo(request.x, request.y - request.radius * 1.4);
    c.lineTo(request.x + request.radius, request.y);
    c.lineTo(request.x, request.y + request.radius * 1.4);
    c.lineTo(request.x - request.radius, request.y);
    c.closePath();
    c.fill();
  }
}

interface Star {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
  readonly phase: number;
  readonly color: string;
}
export interface SkyDrawRequest {
  readonly painter: Painter;
  readonly time: number;
  readonly drift: Point;
}

/** Parallax stars over a nebula painted once per resize. */
export class Starfield {
  static readonly SPACE = "#020309";
  static readonly COLORS: ReadonlyArray<string> = [
    "#ffffff",
    "#ffffff",
    "#ffffff",
    "#b8d4ff",
    "#b8d4ff",
    "#ffd9b0",
  ];
  static readonly NEBULA: ReadonlyArray<string> = [
    "#2b1858",
    "#0b2e5c",
    "#4c173f",
  ];
  /** Seven clouds of each tint. */
  static readonly CLOUDS: ReadonlyArray<string> = Starfield.NEBULA.flatMap(
    (tint) => [tint, tint, tint, tint, tint, tint, tint],
  );
  private stars: ReadonlyArray<Star> = [];
  private nebula: ReadonlyArray<HTMLCanvasElement> = [];
  private viewport: Viewport = { width: 0, height: 0 };
  resize(viewport: Viewport): void {
    this.viewport = viewport;
    const count = Math.round((viewport.width * viewport.height) / 2400);
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * viewport.width,
      y: Math.random() * viewport.height,
      depth: Math.random() ** 2,
      phase: Math.random() * Math.PI * 2,
      color: this.color(Math.floor(Math.random() * Starfield.COLORS.length)),
    }));
    this.nebula = this.paintNebula(viewport);
  }
  private color(index: number): string {
    return Starfield.COLORS.slice(index, index + 1).join("");
  }
  draw(request: SkyDrawRequest): void {
    const c = request.painter.context;
    const { width, height } = this.viewport;
    c.fillStyle = Starfield.SPACE;
    c.fillRect(0, 0, width, height);
    for (const nebula of this.nebula) {
      c.globalAlpha = 0.9;
      c.drawImage(
        nebula,
        -request.drift.x * 0.02,
        -request.drift.y * 0.02,
        width,
        height,
      );
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = "lighter";
    for (const star of this.stars) {
      const parallax = 0.01 + star.depth * 0.06;
      const x =
        (((star.x - request.drift.x * parallax) % width) + width) % width;
      const y =
        (((star.y - request.drift.y * parallax) % height) + height) % height;
      const twinkle =
        0.65 +
        0.35 * Math.sin(request.time * (0.6 + star.depth * 2) + star.phase);
      const alpha = (0.25 + star.depth * 0.75) * twinkle;
      const size = 0.5 + star.depth * 1.3;
      c.globalAlpha = alpha;
      c.fillStyle = star.color;
      c.fillRect(x - size / 2, y - size / 2, size, size);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
  }
  private paintNebula(viewport: Viewport): ReadonlyArray<HTMLCanvasElement> {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width / 4));
    canvas.height = Math.max(1, Math.round(viewport.height / 4));
    return Match.value(canvas.getContext("2d")).pipe(
      Match.when(Match.null, (): ReadonlyArray<HTMLCanvasElement> => []),
      Match.orElse((context): ReadonlyArray<HTMLCanvasElement> => {
        const palette = new Palette();
        const size = Math.max(canvas.width, canvas.height);
        context.globalCompositeOperation = "lighter";
        Starfield.CLOUDS.forEach((tint) => {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const gradient = context.createRadialGradient(
            x,
            y,
            0,
            x,
            y,
            (0.15 + Math.random() * 0.45) * size,
          );
          const core: Shade = {
            color: tint,
            alpha: 0.1 + Math.random() * 0.08,
          };
          const edge: Shade = { color: tint, alpha: 0 };
          gradient.addColorStop(0, palette.rgba(core));
          gradient.addColorStop(1, palette.rgba(edge));
          context.fillStyle = gradient;
          context.fillRect(0, 0, canvas.width, canvas.height);
        });
        return [canvas];
      }),
    );
  }
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  readonly life: number;
  readonly color: string;
  readonly size: number;
}
interface Ring {
  age: number;
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly radius: number;
  readonly life: number;
}
export interface BurstRequest {
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly count: number;
  readonly speed: number;
  readonly life: number;
}
interface SparkPick {
  readonly request: BurstRequest;
  readonly index: number;
}
interface RingRequest {
  readonly x: number;
  readonly y: number;
  readonly color: string;
  readonly radius: number;
  readonly life: number;
}

/** Short-lived sparks and shock rings in screen space. */
export class Sparks {
  private sparks: Spark[] = [];
  private rings: Ring[] = [];
  burst(request: BurstRequest): void {
    for (let i = 0; i < request.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = request.speed * (0.25 + Math.random() * 0.9);
      this.sparks.push({
        x: request.x,
        y: request.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        age: 0,
        life: request.life * (0.5 + Math.random() * 0.6),
        color: this.sparkColor({ request, index: i }),
        size: 1 + Math.random() * 1.8,
      });
    }
  }
  /** Every third spark burns white. */
  private sparkColor(pick: SparkPick): string {
    switch (pick.index % 3 === 2) {
      case true:
        return "#ffffff";
      case false:
        return pick.request.color;
    }
  }
  ring(request: RingRequest): void {
    this.rings.push({ ...request, age: 0 });
  }
  update(seconds: number): void {
    const drag = Math.pow(0.12, seconds);
    for (const spark of this.sparks) {
      spark.age += seconds;
      spark.vx *= drag;
      spark.vy = spark.vy * drag + 10 * seconds;
      spark.x += spark.vx * seconds;
      spark.y += spark.vy * seconds;
    }
    this.sparks = this.sparks.filter((spark) => spark.age < spark.life);
    for (const ring of this.rings) ring.age += seconds;
    this.rings = this.rings.filter((ring) => ring.age < ring.life);
  }
  draw(painter: Painter): void {
    const c = painter.context;
    c.globalCompositeOperation = "lighter";
    for (const spark of this.sparks) {
      const k = 1 - spark.age / spark.life;
      const shade: Shade = { color: spark.color, alpha: k };
      c.strokeStyle = painter.palette.rgba(shade);
      c.lineWidth = spark.size * k;
      c.beginPath();
      c.moveTo(spark.x, spark.y);
      c.lineTo(spark.x - spark.vx * 0.06, spark.y - spark.vy * 0.06);
      c.stroke();
    }
    for (const ring of this.rings) {
      const k = ring.age / ring.life;
      const shade: Shade = { color: ring.color, alpha: (1 - k) * 0.8 };
      c.strokeStyle = painter.palette.rgba(shade);
      c.lineWidth = 2.5 * (1 - k) + 0.5;
      c.beginPath();
      c.arc(
        ring.x,
        ring.y,
        ring.radius * (1 - Math.pow(1 - k, 3)),
        0,
        Math.PI * 2,
      );
      c.stroke();
    }
    c.globalCompositeOperation = "source-over";
  }
}

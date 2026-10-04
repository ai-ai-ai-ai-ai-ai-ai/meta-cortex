import {
  CircleCheck,
  CircleDashed,
  CirclePause,
  CircleSlash,
  GitMerge,
  Inbox,
  LoaderCircle,
  OctagonAlert,
  PackageCheck,
  Play,
  TriangleAlert,
} from "@lucide/svelte";
import type { AgentId, FlowState, WorkflowCondition } from "./contracts";

type Icon = typeof CircleCheck;
type AgentRole = AgentId["role"];
/** Token suffix shared by the `status-*` color utilities. */
export enum Tone {
  Queued = "queued",
  Working = "working",
  Blocked = "blocked",
  Stalled = "stalled",
  Ready = "ready",
  Integrated = "integrated",
  Completed = "completed",
  Cancelled = "cancelled",
}
export class ToneClasses {
  static readonly TEXT: Record<Tone, string> = {
    [Tone.Queued]: "text-status-queued",
    [Tone.Working]: "text-status-working",
    [Tone.Blocked]: "text-status-blocked",
    [Tone.Stalled]: "text-status-stalled",
    [Tone.Ready]: "text-status-ready",
    [Tone.Integrated]: "text-status-integrated",
    [Tone.Completed]: "text-status-completed",
    [Tone.Cancelled]: "text-status-cancelled",
  };
  static readonly SOFT: Record<Tone, string> = {
    [Tone.Queued]:
      "bg-status-queued/10 text-status-queued border-status-queued/25",
    [Tone.Working]:
      "bg-status-working/12 text-status-working border-status-working/30",
    [Tone.Blocked]:
      "bg-status-blocked/12 text-status-blocked border-status-blocked/30",
    [Tone.Stalled]:
      "bg-status-stalled/12 text-status-stalled border-status-stalled/30",
    [Tone.Ready]: "bg-status-ready/12 text-status-ready border-status-ready/30",
    [Tone.Integrated]:
      "bg-status-integrated/12 text-status-integrated border-status-integrated/30",
    [Tone.Completed]:
      "bg-status-completed/12 text-status-completed border-status-completed/30",
    [Tone.Cancelled]:
      "bg-status-cancelled/10 text-status-cancelled border-status-cancelled/25",
  };
  static readonly FILL: Record<Tone, string> = {
    [Tone.Queued]: "bg-status-queued/45",
    [Tone.Working]: "bg-status-working",
    [Tone.Blocked]: "bg-status-blocked",
    [Tone.Stalled]: "bg-status-stalled",
    [Tone.Ready]: "bg-status-ready",
    [Tone.Integrated]: "bg-status-integrated",
    [Tone.Completed]: "bg-status-completed",
    [Tone.Cancelled]: "bg-status-cancelled/60",
  };
  static readonly RING: Record<Tone, string> = {
    [Tone.Queued]: "border-status-queued",
    [Tone.Working]: "border-status-working",
    [Tone.Blocked]: "border-status-blocked",
    [Tone.Stalled]: "border-status-stalled",
    [Tone.Ready]: "border-status-ready",
    [Tone.Integrated]: "border-status-integrated",
    [Tone.Completed]: "border-status-completed",
    [Tone.Cancelled]: "border-status-cancelled",
  };
}

export interface Look {
  readonly label: string;
  readonly tone: Tone;
  readonly icon: Icon;
}
export class StatusLook {
  static readonly ORDER: ReadonlyArray<FlowState> = [
    "integrated",
    "completed",
    "ready",
    "working",
    "blocked",
    "queued",
    "cancelled",
  ];
  constructor(private readonly state: FlowState) {}
  look(): Look {
    switch (this.state) {
      case "queued":
        return { label: "Queued", tone: Tone.Queued, icon: CircleDashed };
      case "working":
        return { label: "Working", tone: Tone.Working, icon: LoaderCircle };
      case "blocked":
        return { label: "Blocked", tone: Tone.Blocked, icon: OctagonAlert };
      case "ready":
        return {
          label: "Awaiting handoff",
          tone: Tone.Ready,
          icon: PackageCheck,
        };
      case "integrated":
        return { label: "Integrated", tone: Tone.Integrated, icon: GitMerge };
      case "completed":
        return { label: "Completed", tone: Tone.Completed, icon: CircleCheck };
      case "cancelled":
        return { label: "Cancelled", tone: Tone.Cancelled, icon: CircleSlash };
    }
  }
  rank(): number {
    return StatusLook.ORDER.indexOf(this.state);
  }
}
export class ConditionLook {
  constructor(private readonly condition: WorkflowCondition) {}
  look(): Look {
    switch (this.condition) {
      case "attention":
        return {
          label: "Needs attention",
          tone: Tone.Blocked,
          icon: TriangleAlert,
        };
      case "active":
        return { label: "In progress", tone: Tone.Working, icon: Play };
      case "waiting":
        return { label: "Waiting", tone: Tone.Queued, icon: CirclePause };
      case "empty":
        return { label: "No tasks yet", tone: Tone.Cancelled, icon: Inbox };
      case "finished":
        return { label: "Finished", tone: Tone.Completed, icon: CircleCheck };
    }
  }
}
export class AgentLook {
  static readonly ROLES: Record<AgentRole, string> = {
    GizmoPrime: "Gizmo Prime",
    Gizmo: "Team Gizmo",
    RustDev: "Rust Dev",
    RustRefactoring: "Rust Refactoring",
    RustVerifier: "Rust Verifier",
    TypescriptDev: "TypeScript Dev",
    TypescriptVerifier: "TypeScript Verifier",
    WebDesigner: "Web Designer",
    TechWriter: "Tech Writer",
    TechWriterVerifier: "Tech Writer Verifier",
    SecurityAgent: "Security Agent",
    CicdAgent: "CI/CD Agent",
    DockerSpecialist: "Docker Specialist",
    KubernetesSpecialist: "Kubernetes Specialist",
    IntegrationAgent: "Integration Agent",
    PrAgent: "PR Agent",
  };
  constructor(private readonly agent: AgentId) {}
  name(): string {
    return AgentLook.ROLES[this.agent.role];
  }
}

interface TimeUnit {
  readonly from: number;
  readonly size: number;
  readonly suffix: string;
}
interface DurationUnit {
  readonly size: number;
  readonly suffix: string;
  readonly minor: number;
  readonly minorSuffix: string;
  readonly modulo: number;
}
/** Human time relative to one observation instant. */
export class TimeLook {
  static readonly SECOND = 1000;
  static readonly MINUTE = 60 * TimeLook.SECOND;
  static readonly HOUR = 60 * TimeLook.MINUTE;
  static readonly DAY = 24 * TimeLook.HOUR;
  static readonly UNITS: ReadonlyArray<TimeUnit> = [
    { from: TimeLook.DAY, size: TimeLook.DAY, suffix: "d" },
    { from: TimeLook.HOUR, size: TimeLook.HOUR, suffix: "h" },
    { from: TimeLook.MINUTE, size: TimeLook.MINUTE, suffix: "m" },
    { from: 5 * TimeLook.SECOND, size: TimeLook.SECOND, suffix: "s" },
  ];
  static readonly LOCALES: Intl.LocalesArgument = [];
  static readonly MONTH_DAY: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  static readonly WEEKDAY: Intl.DateTimeFormatOptions = { weekday: "short" };
  constructor(private readonly now: number) {}
  relative(at: number): string {
    const elapsed = Math.max(0, this.now - at);
    for (const unit of TimeLook.UNITS) {
      switch (elapsed >= unit.from) {
        case true:
          return `${Math.floor(elapsed / unit.size)}${unit.suffix} ago`;
        case false:
          continue;
      }
    }
    return "just now";
  }
  absolute(at: number): string {
    return new Date(at).toLocaleString();
  }
  date(at: number): string {
    return new Date(at).toLocaleDateString(
      TimeLook.LOCALES,
      TimeLook.MONTH_DAY,
    );
  }
  weekday(at: number): string {
    return new Date(at).toLocaleDateString(TimeLook.LOCALES, TimeLook.WEEKDAY);
  }
}
export class Duration {
  static readonly UNITS: ReadonlyArray<DurationUnit> = [
    {
      size: TimeLook.DAY,
      suffix: "d",
      minor: TimeLook.HOUR,
      minorSuffix: "h",
      modulo: 24,
    },
    {
      size: TimeLook.HOUR,
      suffix: "h",
      minor: TimeLook.MINUTE,
      minorSuffix: "m",
      modulo: 60,
    },
  ];
  constructor(private readonly milliseconds: number) {}
  label(): string {
    const span = Math.max(0, Math.round(this.milliseconds));
    for (const unit of Duration.UNITS) {
      switch (span >= unit.size) {
        case true:
          return `${Math.floor(span / unit.size)}${unit.suffix} ${Math.floor(span / unit.minor) % unit.modulo}${unit.minorSuffix}`;
        case false:
          continue;
      }
    }
    switch (span >= TimeLook.MINUTE) {
      case true:
        return `${Math.floor(span / TimeLook.MINUTE)}m`;
      case false:
        return "under a minute";
    }
  }
}

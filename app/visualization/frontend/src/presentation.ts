import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  GitMerge,
  LoaderCircle,
  OctagonAlert,
  PackageCheck,
} from "@lucide/svelte";
import type { AgentId, FlowState } from "./contracts";

type Icon = typeof CircleCheck;
type AgentRole = AgentId["role"];
/** Token suffix shared by the `status-*` color utilities. */
enum Tone {
  Queued = "queued",
  Working = "working",
  Blocked = "blocked",
  Stalled = "stalled",
  Ready = "ready",
  Integrated = "integrated",
  Completed = "completed",
  Cancelled = "cancelled",
}
interface Look {
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

import type { TaskV2, TaskFlow, FeatureFlow, DesktopReply } from "./contracts";
export class Fixture {
  task: TaskV2 = {
    version: 2,
    ownership: {
      kind: "Assigned",
      assignment: {
        agent: { team: "Development", role: "TypescriptDev" },
        reports_to: { kind: "Gizmo", coordinator: "Gizmo" },
      },
    },
    workspace: { kind: "git", branch: "codex/worker", path: "/fixture" },
    state: { kind: "integrated", commit: "b".repeat(40) },
    common: {
      id: "implement",
      feature: "dashboard",
      attempt: 1,
      revision: 5,
      objective: "Build workflow",
      acceptance: ["Show recorded work"],
      dependencies: [],
      created_at: 1000,
      last_update: 2000,
      last_progress: 1500,
      checkpoint: { kind: "git", commit: "a".repeat(40) },
      progress: {
        summary: "Graph completed",
        findings: [],
        next_steps: [],
        checks: [],
        extensions: { artifact: "native-contract-v2" },
      },
    },
  };
  contribution: TaskFlow = {
    task: this.task,
    created_by: { kind: "recorded", agent: { team: "Gizmo", role: "Gizmo" } },
    worker: {
      kind: "recorded",
      agent: { team: "Development", role: "TypescriptDev" },
    },
    checkpoints: [
      {
        commit: "a".repeat(40),
        actor: { team: "Development", role: "TypescriptDev" },
        at: 1500,
        revision: 3,
      },
    ],
    integrations: [
      {
        commit: "b".repeat(40),
        actor: { team: "Delivery", role: "IntegrationAgent" },
        at: 2000,
        revision: 5,
      },
    ],
    milestones: [],
    history_end: "Complete",
  };
  flow: FeatureFlow = {
    feature: {
      id: "dashboard",
      branch: "codex/feature",
      objective: "Build workflow",
      version: 1,
      worktree: "/feature",
    },
    counts: [{ state: "integrated", count: 101 }],
    tasks: { end: "More", records: [this.contribution] },
    observed_at: 2000,
  };
  workflowReply(): DesktopReply {
    return {
      content: { kind: "Workflow", value: this.flow },
      selection: {
        view: { kind: "Tasks", feature: this.flow.feature.id },
        feature: this.flow.feature.id,
        page: 0,
      },
    };
  }
  featuresReply(): DesktopReply {
    return {
      content: {
        kind: "Features",
        value: { records: [this.flow.feature], end: "Complete" },
      },
      selection: { view: { kind: "Features" }, page: 0 },
    };
  }
  taskReply(): DesktopReply {
    return {
      content: { kind: "Task", value: this.task },
      selection: {
        view: {
          kind: "Task",
          query: {
            feature: this.task.common.feature,
            task: this.task.common.id,
          },
        },
        feature: this.task.common.feature,
        page: 0,
      },
    };
  }
}

// JSDOM has no matchMedia. Svelte's MediaQuery uses matches/media and
// EventTarget change listeners; keep real graph components and handlers intact.
class BrowserMediaQuery extends EventTarget {
  readonly matches = false;
  constructor(readonly media: string) {
    super();
  }
}
export class BrowserMediaQueries {
  matchMedia(query: string): BrowserMediaQuery {
    return new BrowserMediaQuery(query);
  }
}
// JSDOM has no layout-driven resize notifications. Track native observer
// lifecycles while leaving SvelteFlow rendering and selection handlers real.
export class BrowserResizeObserver implements ResizeObserver {
  private readonly targets = new Set<Element>();
  observe(target: Element): void {
    this.targets.add(target);
  }
  unobserve(target: Element): void {
    this.targets.delete(target);
  }
  disconnect(): void {
    this.targets.clear();
  }
}

// JSDOM returns no client rectangles even for rendered controls. Supply only
// visibility geometry for Bits/tabbable; leave native focus and events intact.
export function renderedClientRects(this: Element): DOMRectList {
  const ancestors: Element[] = [this];
  for (
    let element: Element | null = this.parentElement;
    element;
    element = element.parentElement
  ) {
    ancestors.push(element);
  }
  const rectangles: DOMRect[] = [];
  const hidden = ancestors.some((element) => {
    const style = getComputedStyle(element);
    return (
      element.hasAttribute("hidden") ||
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse"
    );
  });
  switch (this.isConnected && !hidden) {
    case true:
      rectangles.push(new DOMRect(0, 0, 1, 1));
      break;
    case false:
      break;
  }
  return Object.assign(rectangles, {
    item(index: number): DOMRect | null {
      return rectangles[index] ?? null;
    },
  });
}

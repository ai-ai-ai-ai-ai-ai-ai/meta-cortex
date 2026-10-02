import type { TaskV2, TaskFlow, FeatureFlow } from "./contracts";
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
}

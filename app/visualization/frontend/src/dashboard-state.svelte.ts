import { Effect } from "effect";
import type { Fiber } from "effect";
import type {
  DesktopRead,
  DesktopReply,
  Feature,
  TaskV2,
  TaskQuery,
} from "./contracts";
import { DashboardApi } from "./api";
import type { DashboardFailure } from "./api";
export enum LoadKind {
  Loading = "loading",
  Ready = "ready",
  Failed = "failed",
}
type Load =
  | { kind: LoadKind.Loading; request: DesktopRead }
  | { kind: LoadKind.Ready; reply: DesktopReply; request: DesktopRead }
  | { kind: LoadKind.Failed; failure: DashboardFailure; request: DesktopRead };
enum ExecutionKind {
  Idle = "idle",
  Running = "running",
}
type Execution =
  | { kind: ExecutionKind.Idle }
  | { kind: ExecutionKind.Running; fiber: Fiber.Fiber<void> };
export class DashboardController {
  state = $state<Load>({
    kind: LoadKind.Loading,
    request: { kind: "Initial" },
  });
  features = $state<Feature[]>([]);
  private execution: Execution = { kind: ExecutionKind.Idle };
  constructor(private readonly api: DashboardApi) {}
  load(request: DesktopRead): void {
    this.stop();
    this.state = { kind: LoadKind.Loading, request };
    const reading = this.api.read(request).pipe(
      Effect.flatMap((reply) => this.withFeatures(reply)),
      Effect.match({
        onFailure: (failure) => {
          this.state = { kind: LoadKind.Failed, failure, request };
        },
        onSuccess: (reply) => {
          this.state = { kind: LoadKind.Ready, reply, request };
        },
      }),
    );
    this.execution = {
      kind: ExecutionKind.Running,
      fiber: Effect.runFork(reading),
    };
  }
  private withFeatures(
    reply: DesktopReply,
  ): Effect.Effect<DesktopReply, DashboardFailure> {
    switch (reply.content.kind) {
      case "Features":
        this.features = reply.content.value.records;
        return Effect.succeed(reply);
      case "Workflow":
      case "Task":
      case "History":
        break;
    }
    switch (this.features.length) {
      case 0:
        return this.api.read({ kind: "Features", page: 0 }).pipe(
          Effect.map((sidebar) => {
            this.sidebar(sidebar);
            return reply;
          }),
        );
      default:
        return Effect.succeed(reply);
    }
  }
  private sidebar(reply: DesktopReply): void {
    switch (reply.content.kind) {
      case "Features":
        this.features = reply.content.value.records;
        return;
      case "Workflow":
      case "Task":
      case "History":
        throw new Error("Expected feature navigation");
    }
  }
  stop(): void {
    switch (this.execution.kind) {
      case ExecutionKind.Idle:
        return;
      case ExecutionKind.Running:
        this.execution.fiber.interruptUnsafe();
        this.execution = { kind: ExecutionKind.Idle };
    }
  }
  task(task: TaskV2): void {
    const request: DesktopRead = {
      kind: "Task",
      query: { feature: task.common.feature, task: task.common.id },
    };
    this.load(request);
  }
  feature(feature: Feature): void {
    this.load({ kind: "Workflow", feature: feature.id, page: 0 });
  }
  historyQuery(reply: DesktopReply): TaskQuery {
    switch (reply.selection.view.kind) {
      case "History":
      case "Task":
        return reply.selection.view.query;
      case "Features":
      case "Tasks":
        throw new Error("Expected task selection");
    }
  }
  pageRequest(reply: DesktopReply, page: number): DesktopRead {
    switch (reply.selection.view.kind) {
      case "Features":
        return { kind: "Features", page };
      case "Tasks":
        return {
          kind: "Workflow",
          feature: reply.selection.view.feature,
          page,
        };
      case "History":
        return { kind: "History", query: reply.selection.view.query, page };
      case "Task":
        return { kind: "Task", query: reply.selection.view.query };
    }
  }
  pageEnd(reply: DesktopReply): string {
    switch (reply.content.kind) {
      case "Workflow":
        return reply.content.value.tasks.end;
      case "Features":
      case "History":
        return reply.content.value.end;
      case "Task":
        return "Complete";
    }
  }
  private requestFeature(request: DesktopRead): string {
    switch (request.kind) {
      case "Workflow":
        return request.feature;
      case "Task":
      case "History":
        return request.query.feature;
      case "Features":
      case "Initial":
        return "";
    }
  }
  history(task: TaskV2): void {
    const request: DesktopRead = {
      kind: "History",
      query: { feature: task.common.feature, task: task.common.id },
      page: 0,
    };
    this.load(request);
  }
  currentFeature(): string {
    switch (this.state.kind) {
      case LoadKind.Loading:
      case LoadKind.Failed:
        return this.requestFeature(this.state.request);
      case LoadKind.Ready:
        switch (this.state.reply.selection.view.kind) {
          case "Features":
            return "";
          case "Tasks":
            return this.state.reply.selection.view.feature;
          case "Task":
          case "History":
            return this.state.reply.selection.view.query.feature;
        }
    }
  }
}

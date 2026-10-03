import { Effect } from "effect";
import type {
  DesktopRead,
  DesktopReply,
  DashboardView,
  Feature,
  TaskV2,
  TaskFlow,
} from "./contracts";
import { DashboardApi } from "./api";
import type { DashboardFailure } from "./api";
export enum LoadKind {
  Loading = "loading",
  Ready = "ready",
  Failed = "failed",
}
export enum DetailView {
  Workflow = "workflow",
  Task = "task",
  History = "history",
}
export type DetailSelection =
  | { kind: DetailView.Workflow }
  | { kind: DetailView.Task; task: TaskV2; flow?: TaskFlow }
  | { kind: DetailView.History };
type Load =
  | { kind: LoadKind.Loading; request: DesktopRead }
  | { kind: LoadKind.Ready; reply: DesktopReply; request: DesktopRead }
  | { kind: LoadKind.Failed; failure: DashboardFailure; request: DesktopRead };
export class DashboardController {
  reply = $state<DesktopReply | null>(null);
  state = $state<Load>({
    kind: LoadKind.Loading,
    request: { kind: "Initial" },
  });
  features = $state<Feature[]>([]);
  private interrupt: () => void = () => {};
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
          this.reply = reply;
          this.state = { kind: LoadKind.Ready, reply, request };
        },
      }),
    );
    this.interrupt = Effect.runCallback(reading);
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
      case 0: {
        const request: DesktopRead = { kind: "Features", page: 0 };
        return this.api.read(request).pipe(
          Effect.map((sidebar) => {
            this.sidebar(sidebar);
            return reply;
          }),
        );
      }
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
  private view(): DesktopRead | DashboardView {
    switch (this.state.kind) {
      case LoadKind.Ready:
        return this.state.reply.selection.view;
      case LoadKind.Loading:
      case LoadKind.Failed:
        return this.state.request;
    }
  }
  currentFeature(): string {
    const view = this.view();
    switch (view.kind) {
      case "Features":
      case "Initial":
        return "";
      case "Tasks":
      case "Workflow":
        return view.feature;
      case "Task":
      case "History":
        return view.query.feature;
    }
  }
  page(page: number): void {
    const view = this.view();
    switch (view.kind) {
      case "Initial":
        this.load({ kind: "Initial" });
        return;
      case "Features":
        this.load({ kind: "Features", page });
        return;
      case "Tasks":
      case "Workflow":
        this.load({ kind: "Workflow", feature: view.feature, page });
        return;
      case "Task":
        this.load({ kind: "Task", query: view.query });
        return;
      case "History":
        this.load({ kind: "History", query: view.query, page });
    }
  }
  stop(): void {
    this.interrupt();
  }
  refresh(): void {
    switch (this.state.kind) {
      case LoadKind.Ready:
      case LoadKind.Failed:
        this.load(this.state.request);
        return;
      case LoadKind.Loading:
        return;
    }
  }
}

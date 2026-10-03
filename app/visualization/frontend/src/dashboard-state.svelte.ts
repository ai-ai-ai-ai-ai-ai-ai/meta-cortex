import { Effect } from "effect";
import type { DesktopRead, DesktopReply, Feature } from "./contracts";
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
export class DashboardController {
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
  stop(): void {
    this.interrupt();
  }
}

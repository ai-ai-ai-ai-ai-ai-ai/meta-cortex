import { invoke } from "@tauri-apps/api/core";
import { Effect, Match } from "effect";
import { reply, failure, workflow } from "virtual:dashboard-validators";
import type {
  DesktopReply,
  DesktopFailure,
  FeatureWorkflow,
} from "./contracts";
export enum ReadFailureKind {
  InvalidReply = "InvalidReply",
  Transport = "Transport",
}
export type DashboardFailure =
  | DesktopFailure
  | { kind: ReadFailureKind; message: string; cause: unknown };
enum WorkflowCommand {
  Read = "dashboard_workflow",
  Upgrade = "dashboard_upgrade",
}
type WorkflowArguments = {
  feature: string;
};
interface WorkflowRequest {
  command: WorkflowCommand;
  feature: string;
}
export class DashboardApi {
  workflow(feature: string): Effect.Effect<FeatureWorkflow, DashboardFailure> {
    const request: WorkflowRequest = { command: WorkflowCommand.Read, feature };
    return this.loadWorkflow(request);
  }
  upgrade(feature: string): Effect.Effect<FeatureWorkflow, DashboardFailure> {
    const request: WorkflowRequest = {
      command: WorkflowCommand.Upgrade,
      feature,
    };
    return this.loadWorkflow(request);
  }
  private loadWorkflow(
    request: WorkflowRequest,
  ): Effect.Effect<FeatureWorkflow, DashboardFailure> {
    const args: WorkflowArguments = { feature: request.feature };
    return Effect.tryPromise({
      try: () => invoke<unknown>(request.command, args),
      catch: (cause) =>
        Match.value(cause).pipe(
          Match.when(failure, (value) => value),
          Match.orElse((value) => ({
            kind: ReadFailureKind.Transport,
            message:
              "The workflow operation could not be completed. Retry the selected action.",
            cause: value,
          })),
        ),
    }).pipe(
      Effect.filterOrFail(workflow, (cause) => ({
        kind: ReadFailureKind.InvalidReply,
        message: "The native workflow reply is invalid. Refresh to retry.",
        cause,
      })),
    );
  }
  read(): Effect.Effect<DesktopReply, DashboardFailure> {
    return Effect.tryPromise({
      try: () => invoke<unknown>("dashboard_read"),
      catch: (cause) =>
        Match.value(cause).pipe(
          Match.when(failure, (value) => value),
          Match.orElse((value) => ({
            kind: ReadFailureKind.Transport,
            message: "The ledger could not be read. Refresh to retry.",
            cause: value,
          })),
        ),
    }).pipe(
      Effect.filterOrFail(reply, (cause) => ({
        kind: ReadFailureKind.InvalidReply,
        message: "The native reply is invalid. Refresh to retry.",
        cause,
      })),
    );
  }
}

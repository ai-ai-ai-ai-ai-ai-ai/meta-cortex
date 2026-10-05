import { invoke } from "@tauri-apps/api/core";
import { Effect, Match } from "effect";
import { reply, failure, workflow, guide } from "virtual:dashboard-validators";
import type {
  AgentGuide,
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
export class DashboardApi {
  guide(): Effect.Effect<AgentGuide, DashboardFailure> {
    const transport: {
      try: () => Promise<unknown>;
      catch: (cause: unknown) => DashboardFailure;
    } = {
      try: () => invoke<unknown>("dashboard_guide"),
      catch: (cause: unknown): DashboardFailure => ({
        kind: ReadFailureKind.Transport,
        message: "The agent guide could not be loaded. Retry to read it again.",
        cause,
      }),
    };
    return Effect.tryPromise(transport).pipe(
      Effect.filterOrFail(
        guide,
        (cause): DashboardFailure => ({
          kind: ReadFailureKind.InvalidReply,
          message: "The native agent guide reply is invalid.",
          cause,
        }),
      ),
    );
  }

  workflow(feature: string): Effect.Effect<FeatureWorkflow, DashboardFailure> {
    return Effect.tryPromise({
      try: () => invoke<unknown>("dashboard_workflow", { feature }),
      catch: (cause) =>
        Match.value(cause).pipe(
          Match.when(failure, (value) => value),
          Match.orElse((value) => ({
            kind: ReadFailureKind.Transport,
            message: "The workflow could not be read. Refresh to retry.",
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

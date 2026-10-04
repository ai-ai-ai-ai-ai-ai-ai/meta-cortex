import { invoke } from "@tauri-apps/api/core";
import { Effect, Match } from "effect";
import { reply, failure } from "virtual:dashboard-validators";
import type { DesktopReply, DesktopFailure } from "./contracts";
export enum ReadFailureKind {
  InvalidReply = "InvalidReply",
  Transport = "Transport",
}
export type DashboardFailure =
  | DesktopFailure
  | { kind: ReadFailureKind; message: string; cause: unknown };
export class DashboardApi {
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

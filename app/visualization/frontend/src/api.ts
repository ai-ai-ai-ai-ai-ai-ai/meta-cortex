import { invoke } from "@tauri-apps/api/core";
import { Effect, Match } from "effect";
import { reply, failure } from "./validators.cjs";
import type { DesktopRead, DesktopReply, DesktopFailure } from "./contracts";
enum ReadFailureKind {
  InvalidReply = "InvalidReply",
  Transport = "Transport",
}
export type DashboardFailure =
  | DesktopFailure
  | { kind: ReadFailureKind; message: string; cause: unknown };
class NativeDecoder {
  decode(raw: unknown): Effect.Effect<DesktopReply, DashboardFailure> {
    return Match.value(raw).pipe(
      Match.when(reply, (value) => Effect.succeed(value)),
      Match.orElse((value) =>
        Effect.fail({
          kind: ReadFailureKind.InvalidReply,
          message: "The native reply is invalid. Refresh to retry.",
          cause: value,
        }),
      ),
    );
  }
  failure(cause: unknown): DashboardFailure {
    return Match.value(cause).pipe(
      Match.when(failure, (value) => value),
      Match.orElse((value) => ({
        kind: ReadFailureKind.Transport,
        message: "The ledger could not be read. Refresh to retry.",
        cause: value,
      })),
    );
  }
}
export class DashboardApi {
  private readonly decoder = new NativeDecoder();
  read(request: DesktopRead): Effect.Effect<DesktopReply, DashboardFailure> {
    return Effect.tryPromise({
      try: () => invoke<unknown>("dashboard_read", { request }),
      catch: (cause) => this.decoder.failure(cause),
    }).pipe(Effect.flatMap((raw) => this.decoder.decode(raw)));
  }
}

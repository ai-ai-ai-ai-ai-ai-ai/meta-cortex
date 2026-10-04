import { Effect } from "effect";
import type { DesktopReply, FeatureSummary } from "./contracts";
import type { DashboardApi, DashboardFailure } from "./api";

enum LoadKind {
  Loading = "loading",
  Ready = "ready",
  Failed = "failed",
}
type Load =
  | { readonly kind: LoadKind.Loading }
  | { readonly kind: LoadKind.Ready }
  | { readonly kind: LoadKind.Failed; readonly failure: DashboardFailure };
enum ReplyKind {
  Empty = "empty",
  Loaded = "loaded",
}
type Reply =
  | { readonly kind: ReplyKind.Empty }
  | {
      readonly kind: ReplyKind.Loaded;
      readonly reply: DesktopReply;
      readonly received: number;
    };

/**
 * The ledger read behind the journal. A refresh keeps the last reply on
 * screen, so live updates never blank the view and failures mark it stale.
 */
export class ReadController {
  load = $state<Load>({ kind: LoadKind.Loading });
  reply = $state<Reply>({ kind: ReplyKind.Empty });
  private interrupt: () => void = () => {};
  constructor(private readonly api: DashboardApi) {}
  read(): void {
    this.stop();
    this.load = { kind: LoadKind.Loading };
    const reading = this.api.read().pipe(
      Effect.match({
        onFailure: (failure) => {
          this.load = { kind: LoadKind.Failed, failure };
        },
        onSuccess: (reply) => {
          this.reply = { kind: ReplyKind.Loaded, reply, received: Date.now() };
          this.load = { kind: LoadKind.Ready };
        },
      }),
    );
    this.interrupt = Effect.runCallback(reading);
  }
  refresh(): void {
    switch (this.load.kind) {
      case LoadKind.Loading:
        return;
      case LoadKind.Ready:
      case LoadKind.Failed:
        this.read();
    }
  }
  stop(): void {
    this.interrupt();
  }
  /** Empty until the first reply; a loaded journal may itself hold no features. */
  journals(): ReadonlyArray<ReadonlyArray<FeatureSummary>> {
    switch (this.reply.kind) {
      case ReplyKind.Empty:
        return [];
      case ReplyKind.Loaded:
        return [this.reply.reply.features.records];
    }
  }
  truncated(): boolean {
    switch (this.reply.kind) {
      case ReplyKind.Empty:
        return false;
      case ReplyKind.Loaded:
        return this.reply.reply.features.end === "More";
    }
  }
  failures(): ReadonlyArray<DashboardFailure> {
    switch (this.load.kind) {
      case LoadKind.Loading:
      case LoadKind.Ready:
        return [];
      case LoadKind.Failed:
        return [this.load.failure];
    }
  }
  received(): ReadonlyArray<number> {
    switch (this.reply.kind) {
      case ReplyKind.Empty:
        return [];
      case ReplyKind.Loaded:
        return [this.reply.received];
    }
  }
  busy(): boolean {
    return this.load.kind === LoadKind.Loading;
  }
}

export enum LiveMode {
  Live = "live",
  Paused = "paused",
}
/** Periodic refresh while live; pausing interrupts the schedule. */
export class LiveRefresh {
  static readonly INTERVAL = "5 seconds";
  mode = $state<LiveMode>(LiveMode.Live);
  toggle(): void {
    switch (this.mode) {
      case LiveMode.Live:
        this.mode = LiveMode.Paused;
        return;
      case LiveMode.Paused:
        this.mode = LiveMode.Live;
    }
  }
  label(): string {
    switch (this.mode) {
      case LiveMode.Live:
        return "Pause live updates";
      case LiveMode.Paused:
        return "Resume live updates";
    }
  }
  run(tick: Effect.Effect<void>): () => void {
    switch (this.mode) {
      case LiveMode.Paused:
        return () => {};
      case LiveMode.Live:
        return Effect.runCallback(
          Effect.forever(
            Effect.sleep(LiveRefresh.INTERVAL).pipe(Effect.andThen(tick)),
          ),
        );
    }
  }
}
/** Wall time for relative labels; it advances independently of ledger reads. */
export class Clock {
  now = $state(Date.now());
  run(): () => void {
    return Effect.runCallback(
      Effect.forever(
        Effect.sleep("1 second").pipe(
          Effect.andThen(Effect.sync(() => (this.now = Date.now()))),
        ),
      ),
    );
  }
}

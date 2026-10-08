import { Effect, DateTime } from "effect";
import type { DesktopCatalogReply } from "./contracts";
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
      readonly reply: DesktopCatalogReply;
      readonly received: DateTime.Utc;
    };

/**
 * The read behind the global repository list. A refresh keeps the last reply on
 * screen, so live updates never blank the view and failures mark it stale.
 */
type RepositoryPages = ReadonlyArray<DesktopCatalogReply["repositories"]>;
interface CatalogReadHandlers {
  onFailure: (failure: DashboardFailure) => void;
  onSuccess: (reply: DesktopCatalogReply) => void;
}
export class CatalogController {
  load = $state<Load>({ kind: LoadKind.Loading });
  reply = $state.raw<Reply>({ kind: ReplyKind.Empty });
  private interrupt: () => void = () => {};
  constructor(private readonly api: DashboardApi) {}
  read(): void {
    this.stop();
    this.load = { kind: LoadKind.Loading };
    const handlers: CatalogReadHandlers = {
      onFailure: (failure) => {
        this.load = { kind: LoadKind.Failed, failure };
      },
      onSuccess: (reply) => {
        this.reply = {
          kind: ReplyKind.Loaded,
          reply,
          received: DateTime.nowUnsafe(),
        };
        this.load = { kind: LoadKind.Ready };
      },
    };
    const reading = this.api.read().pipe(Effect.match(handlers));
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
  /** Empty until the first reply; a loaded page may itself hold no repositories. */
  repositoryPages(): RepositoryPages {
    switch (this.reply.kind) {
      case ReplyKind.Empty:
        return [];
      case ReplyKind.Loaded:
        return [this.reply.reply.repositories];
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
  received(): ReadonlyArray<DateTime.Utc> {
    switch (this.reply.kind) {
      case ReplyKind.Empty:
        return [];
      case ReplyKind.Loaded:
        return [this.reply.received];
    }
  }
  /** HTML disabled/animation attributes consume this boolean presentation edge. */
  busy(): boolean {
    return this.load.kind === LoadKind.Loading;
  }
}

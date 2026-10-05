import { Effect } from "effect";
import type { FeatureWorkflow } from "./contracts";
import type { DashboardApi, DashboardFailure } from "./api";
export enum UpgradeKind {
  Idle = "Idle",
  Pending = "Pending",
  Failed = "Failed",
  Opened = "Opened",
}
type UpgradeState =
  | { kind: UpgradeKind.Idle }
  | { kind: UpgradeKind.Pending; feature: string }
  | { kind: UpgradeKind.Failed; feature: string; failure: DashboardFailure }
  | { kind: UpgradeKind.Opened; workflow: FeatureWorkflow };
interface UpgradeRequest {
  feature: string;
  opened: (workflow: FeatureWorkflow) => void;
}
interface UpgradeHandlers {
  onFailure: (failure: DashboardFailure) => Effect.Effect<void>;
  onSuccess: (workflow: FeatureWorkflow) => Effect.Effect<void>;
}
export class FeatureUpgrade {
  state = $state.raw<UpgradeState>({ kind: UpgradeKind.Idle });
  private interrupt: () => void = () => {};
  constructor(private readonly api: DashboardApi) {}
  open(request: UpgradeRequest): void {
    switch (this.state.kind) {
      case UpgradeKind.Pending:
        return;
      case UpgradeKind.Idle:
      case UpgradeKind.Failed:
      case UpgradeKind.Opened:
        break;
    }
    this.state = { kind: UpgradeKind.Pending, feature: request.feature };
    const handlers: UpgradeHandlers = {
      onFailure: (failure) =>
        Effect.sync(() => {
          this.state = {
            kind: UpgradeKind.Failed,
            feature: request.feature,
            failure,
          };
        }),
      onSuccess: (workflow) =>
        Effect.sync(() => {
          this.state = { kind: UpgradeKind.Opened, workflow };
          request.opened(workflow);
        }),
    };
    const upgrading = this.api
      .upgrade(request.feature)
      .pipe(Effect.matchEffect(handlers));
    this.interrupt = Effect.runCallback(upgrading);
  }
  stop(): void {
    this.interrupt();
  }
}
export type { UpgradeRequest };

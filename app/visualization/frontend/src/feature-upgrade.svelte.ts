import { Effect } from "effect";
import type { FeatureWorkflow, StoredFeatureSelection } from "./contracts";
import type { DashboardApi, DashboardFailure } from "./api";
export enum UpgradeKind {
  Idle = "Idle",
  Pending = "Pending",
  Failed = "Failed",
  Opened = "Opened",
}
type UpgradeState =
  | { kind: UpgradeKind.Idle }
  | { kind: UpgradeKind.Pending; feature: StoredFeatureSelection["feature"] }
  | {
      kind: UpgradeKind.Failed;
      feature: StoredFeatureSelection["feature"];
      failure: DashboardFailure;
    }
  | { kind: UpgradeKind.Opened; workflow: FeatureWorkflow };
interface UpgradeRequest {
  feature: StoredFeatureSelection["feature"];
  opened: (workflow: FeatureWorkflow) => void;
}
interface UpgradeHandlers {
  onFailure: (failure: DashboardFailure) => Effect.Effect<void>;
  onSuccess: (workflow: FeatureWorkflow) => Effect.Effect<void>;
}
export interface UpgradeScope {
  api: DashboardApi;
  repository: StoredFeatureSelection["repository"];
}
export class FeatureUpgrade {
  state = $state.raw<UpgradeState>({ kind: UpgradeKind.Idle });
  private interrupt: () => void = () => {};
  constructor(private readonly request: UpgradeScope) {}
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
    const selection: StoredFeatureSelection = {
      repository: this.request.repository,
      feature: request.feature,
    };
    const upgrading = this.request.api
      .upgrade(selection)
      .pipe(Effect.matchEffect(handlers));
    this.interrupt = Effect.runCallback(upgrading);
  }
  stop(): void {
    this.interrupt();
  }
}
export type { UpgradeRequest };

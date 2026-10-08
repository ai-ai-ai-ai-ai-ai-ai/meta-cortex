import { Effect } from "effect";
import type { FeatureWorkflow, StoredFeatureSelection } from "./contracts";
import type { DashboardApi, DashboardFailure } from "./api";
export enum DetailKind {
  Empty = "Empty",
  Loading = "Loading",
  Loaded = "Loaded",
  Failed = "Failed",
}
type Detail =
  | { kind: DetailKind.Empty }
  | { kind: DetailKind.Loading; feature: StoredFeatureSelection["feature"] }
  | { kind: DetailKind.Loaded; workflow: FeatureWorkflow }
  | { kind: DetailKind.Failed; failure: DashboardFailure };
export interface WorkflowReadRequest {
  api: DashboardApi;
  repository: StoredFeatureSelection["repository"];
}
export class WorkflowController {
  state = $state.raw<Detail>({ kind: DetailKind.Empty });
  failures = $state<ReadonlyArray<DashboardFailure>>([]);
  private interrupt: () => void = () => {};
  constructor(private readonly request: WorkflowReadRequest) {}
  read(feature: StoredFeatureSelection["feature"]): void {
    this.interrupt();
    this.failures = [];
    switch (this.state.kind) {
      case DetailKind.Loaded:
        switch (this.state.workflow.feature === feature) {
          case true:
            break;
          case false:
            this.state = { kind: DetailKind.Loading, feature };
        }
        break;
      case DetailKind.Empty:
      case DetailKind.Loading:
      case DetailKind.Failed:
        this.state = { kind: DetailKind.Loading, feature };
    }
    const selection: StoredFeatureSelection = {
      repository: this.request.repository,
      feature,
    };
    const read = this.request.api.workflow(selection).pipe(
      Effect.match({
        onFailure: (failure) => {
          this.failures = [failure];
          switch (this.state.kind) {
            case DetailKind.Loaded:
              break;
            case DetailKind.Empty:
            case DetailKind.Loading:
            case DetailKind.Failed:
              this.state = { kind: DetailKind.Failed, failure };
          }
        },
        onSuccess: (workflow) => {
          this.state = { kind: DetailKind.Loaded, workflow };
        },
      }),
    );
    this.interrupt = Effect.runCallback(read);
  }
  show(workflow: FeatureWorkflow): void {
    this.interrupt();
    this.failures = [];
    this.state = { kind: DetailKind.Loaded, workflow };
  }
  clear(): void {
    this.interrupt();
    this.failures = [];
    this.state = { kind: DetailKind.Empty };
  }
  stop(): void {
    this.interrupt();
  }
}

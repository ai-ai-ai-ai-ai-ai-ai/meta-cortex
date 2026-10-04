import { GuideRoute } from "./agent-guide";
import { Effect } from "effect";
import type { AgentGuide } from "./contracts";
import type { DashboardApi, DashboardFailure } from "./api";
export enum GuideLoad {
  Loading = "Loading",
  Ready = "Ready",
  Failed = "Failed",
}
type GuideState =
  | { kind: GuideLoad.Loading }
  | { kind: GuideLoad.Ready; guide: AgentGuide }
  | { kind: GuideLoad.Failed; failure: DashboardFailure };
export class GuideController {
  state = $state<GuideState>({ kind: GuideLoad.Loading });
  private interrupt: () => void = () => {};
  constructor(private readonly api: DashboardApi) {}
  read(): void {
    this.stop();
    this.state = { kind: GuideLoad.Loading };
    const handlers: {
      onFailure: (failure: DashboardFailure) => void;
      onSuccess: (guide: AgentGuide) => void;
    } = {
      onFailure: (failure: DashboardFailure) => {
        this.state = { kind: GuideLoad.Failed, failure };
      },
      onSuccess: (guide: AgentGuide) => {
        this.state = { kind: GuideLoad.Ready, guide };
      },
    };
    this.interrupt = Effect.runCallback(
      this.api.guide().pipe(Effect.match(handlers)),
    );
  }
  stop(): void {
    this.interrupt();
  }
}

export class GuideNavigation {
  route = $state(GuideRoute.Dashboard);
  guide(): void {
    this.route = GuideRoute.Guide;
  }
  dashboard(): void {
    this.route = GuideRoute.Dashboard;
  }
}

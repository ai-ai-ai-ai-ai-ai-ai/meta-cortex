import { GuideRoute } from "./agent-guide";
export class GuideNavigation {
  route = $state(GuideRoute.Dashboard);
  guide(): void {
    this.route = GuideRoute.Guide;
  }
  dashboard(): void {
    this.route = GuideRoute.Dashboard;
  }
}

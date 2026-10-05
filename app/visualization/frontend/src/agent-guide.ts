import { Match } from "effect";
import type {
  AgentGuide,
  GuideAgent,
  GuideTeamId,
  ReportingTarget,
} from "./contracts";
import { AgentLook } from "./presentation";
export enum GuideRoute {
  Dashboard = "Dashboard",
  Guide = "Agent guide",
}
export class GuideLook {
  static readonly TEAMS: Record<GuideTeamId, string> = {
    Gizmo: "Coordination",
    Development: "Development",
    Ai: "AI & documentation",
    Security: "Security",
    Sre: "Infrastructure",
    Delivery: "Delivery",
  };
  constructor(readonly guide: AgentGuide) {}
  agents(team: GuideTeamId): ReadonlyArray<GuideAgent> {
    return this.guide.agents.filter((entry) => entry.agent.team === team);
  }
  teamTargets(team: GuideTeamId): ReadonlyArray<string> {
    return [
      ...new Set(
        this.agents(team).map((agent) => this.target(agent.reports_to)),
      ),
    ];
  }
  reveal(): void {
    const focusOptions: FocusOptions = { preventScroll: true };
    const scrollOptions: ScrollIntoViewOptions = { block: "nearest" };
    Match.value(document.getElementById("guide-detail")).pipe(
      Match.when(Match.instanceOf(HTMLElement), (element) => {
        element.focus(focusOptions);
        element.scrollIntoView(scrollOptions);
      }),
      Match.orElse(() => {}),
    );
  }
  selected(role: string): ReadonlyArray<GuideAgent> {
    return this.guide.agents.filter((entry) => entry.agent.role === role);
  }
  target(target: ReportingTarget): string {
    switch (target.kind) {
      case "Host":
        return GuideLook.TEXT.host;
      case "Gizmo":
        return AgentLook.ROLES[target.coordinator];
    }
  }
  documents(agent: GuideAgent) {
    return this.guide.documents.filter(
      (document) =>
        JSON.stringify(document.id) === JSON.stringify(agent.source.document),
    );
  }
  reviews(agent: GuideAgent) {
    return this.guide.reviews.filter(
      (review) =>
        review.author.role === agent.agent.role ||
        review.reviewer.role === agent.agent.role,
    );
  }

  static readonly TEXT = {
    title: "Agent guide",
    host: "Host / User",
    reportsTo: "Reports to",
    membership: "Team membership",
    via: "review via",
    back: "Workbench",
    structure: "Reporting structure",
    select: "Select a role to explore its responsibilities and handoffs.",
    owns: "Owns the outcome",
    reports: "Results and blockers to",
    handoff: "Handoff policy",
    documentation: "Canonical documentation",
    reviews: "Review relationships",
    loading: "Loading agent guide…",
    retry: "Retry",
  };
}

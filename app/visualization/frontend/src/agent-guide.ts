import { tick } from "svelte";
import { Effect, Match } from "effect";
import {
  GuideTeamId,
  GuideReporting,
  type AgentGuide,
  type GuideAgent,
  type GuideDocumentPath,
} from "./guide-content";
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
  static readonly GROUPS = [
    GuideTeamId.Development,
    GuideTeamId.Ai,
    GuideTeamId.Security,
    GuideTeamId.Sre,
    GuideTeamId.Delivery,
  ];
  constructor(readonly guide: AgentGuide) {}
  agents(team: GuideTeamId): ReadonlyArray<GuideAgent> {
    return this.guide.agents.filter((entry) => entry.team === team);
  }
  teamTargets(team: GuideTeamId): ReadonlyArray<GuideReporting> {
    return [...new Set(this.agents(team).map((agent) => agent.reports_to))];
  }
  revealAfterRender(): void {
    Effect.runFork(
      Effect.promise(tick).pipe(
        Effect.andThen(Effect.sync(() => this.reveal())),
      ),
    );
  }
  private reveal(): void {
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
  selected(path: GuideDocumentPath): ReadonlyArray<GuideAgent> {
    return this.guide.agents.filter((entry) => entry.path === path);
  }
  documents(agent: GuideAgent) {
    return this.guide.documents.filter(
      (document) => document.path === agent.path,
    );
  }
  reviews(agent: GuideAgent) {
    return this.guide.reviews.filter(
      (review) =>
        review.author === agent.path || review.reviewer === agent.path,
    );
  }
  static readonly TEXT = {
    title: "Agent guide",
    host: "Host / User",
    reportsTo: "Reports to",
    membership: "Team membership",
    via: "review via",
    structure: "Reporting structure",
    select: "Select a role to explore its responsibilities and handoffs.",
    owns: "Owns the outcome",
    reports: "Results and blockers to",
    handoff: "Handoff policy",
    documentation: "Canonical documentation",
  };
}

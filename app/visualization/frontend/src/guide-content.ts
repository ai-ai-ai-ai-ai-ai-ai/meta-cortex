import { Schema } from "effect";

/** Presentation sections of the documentation graph, independent of ledger state. */
export enum GuideTeamId {
  Gizmo = "Gizmo",
  Development = "Development",
  Ai = "Ai",
  Security = "Security",
  Sre = "Sre",
  Delivery = "Delivery",
}
export enum GuideReporting {
  Host = "Host / User",
  Prime = "Gizmo Prime",
  Team = "Team Gizmo",
}
export class GuideContent {
  static readonly PATH = Schema.String.pipe(Schema.brand("GuideDocumentPath"));
  static readonly TEXT = Schema.String.pipe(Schema.brand("GuideText"));
  static readonly BASE = Schema.String.pipe(Schema.brand("GuideSourceBase"));
  static readonly TEAM = Schema.Enum(GuideTeamId);
  static readonly REPORTING = Schema.Enum(GuideReporting);
  static readonly DOCUMENT_FIELDS: DocumentFields = {
    path: GuideContent.PATH,
    markdown: GuideContent.TEXT,
  };
  static readonly DOCUMENT = Schema.Struct(GuideContent.DOCUMENT_FIELDS);
  static readonly AGENT_FIELDS: AgentFields = {
    team: GuideContent.TEAM,
    label: GuideContent.TEXT,
    path: GuideContent.PATH,
    reports_to: GuideContent.REPORTING,
    responsibility: GuideContent.TEXT,
    handoff: GuideContent.TEXT,
  };
  static readonly AGENT = Schema.Struct(GuideContent.AGENT_FIELDS);
  static readonly REVIEW_FIELDS: ReviewFields = {
    author: GuideContent.PATH,
    reviewer: GuideContent.PATH,
  };
  static readonly REVIEW = Schema.Struct(GuideContent.REVIEW_FIELDS);
  static readonly AGENTS = Schema.Array(GuideContent.AGENT);
  static readonly REVIEWS = Schema.Array(GuideContent.REVIEW);
  static readonly DOCUMENTS = Schema.Array(GuideContent.DOCUMENT);
  static readonly FIELDS: ContentFields = {
    sourceBase: GuideContent.BASE,
    agents: GuideContent.AGENTS,
    reviews: GuideContent.REVIEWS,
    documents: GuideContent.DOCUMENTS,
  };
  static readonly SCHEMA = Schema.Struct(GuideContent.FIELDS);
}
type DocumentFields = {
  readonly path: typeof GuideContent.PATH;
  readonly markdown: typeof GuideContent.TEXT;
};
type AgentFields = {
  readonly team: typeof GuideContent.TEAM;
  readonly label: typeof GuideContent.TEXT;
  readonly path: typeof GuideContent.PATH;
  readonly reports_to: typeof GuideContent.REPORTING;
  readonly responsibility: typeof GuideContent.TEXT;
  readonly handoff: typeof GuideContent.TEXT;
};
type ReviewFields = {
  readonly author: typeof GuideContent.PATH;
  readonly reviewer: typeof GuideContent.PATH;
};
type ContentFields = {
  readonly sourceBase: typeof GuideContent.BASE;
  readonly agents: typeof GuideContent.AGENTS;
  readonly reviews: typeof GuideContent.REVIEWS;
  readonly documents: typeof GuideContent.DOCUMENTS;
};
export type GuideSourceBase = typeof GuideContent.BASE.Type;
export type GuideDocumentPath = typeof GuideContent.PATH.Type;
export type GuideText = typeof GuideContent.TEXT.Type;
export type GuideDocument = typeof GuideContent.DOCUMENT.Type;
export type GuideAgent = typeof GuideContent.AGENT.Type;
export type AgentGuide = typeof GuideContent.SCHEMA.Type;
export type GuidePayload = typeof GuideContent.SCHEMA.Encoded;

export enum ReaderNoticeKind {
  Quiet = "Quiet",
  Reported = "Reported",
}
export type ReaderNotice =
  | { readonly kind: ReaderNoticeKind.Quiet }
  | { readonly kind: ReaderNoticeKind.Reported; readonly message: GuideText };

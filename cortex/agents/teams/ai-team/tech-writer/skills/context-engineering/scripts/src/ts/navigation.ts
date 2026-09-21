// Adapts Nook's document-map ownership checks; no Nook topology is retained.
import { Schema } from "effect";
import { DocumentFields } from "./documents.ts";

export class NavigationSchema {
  private static readonly documentFields = {
    path: DocumentFields.path,
    owner: DocumentFields.path,
    anchors: Schema.Array(DocumentFields.anchor).pipe(Schema.maxItems(1000)),
  } satisfies Schema.Struct.Fields;
  private static readonly entryFields = {
    target: DocumentFields.path,
    anchor: DocumentFields.anchor,
    line: DocumentFields.line,
  } satisfies Schema.Struct.Fields;
  private static readonly graphFields = {
    path: DocumentFields.path,
    entries: Schema.Array(Schema.Struct(NavigationSchema.entryFields)).pipe(
      Schema.maxItems(2000),
    ),
  } satisfies Schema.Struct.Fields;
  private static readonly requestFields = {
    documents: Schema.Array(
      Schema.Struct(NavigationSchema.documentFields),
    ).pipe(Schema.maxItems(500)),
    graphs: Schema.Array(Schema.Struct(NavigationSchema.graphFields)).pipe(
      Schema.maxItems(100),
    ),
  } satisfies Schema.Struct.Fields;
  static readonly value = Schema.Struct(NavigationSchema.requestFields);
}
export type NavigationRequest = typeof NavigationSchema.value.Type;

export enum NavigationFindingCode {
  MissingOwner = "missing-owner-graph",
  MissingEntry = "missing-owner-entry",
  MissingTarget = "missing-target",
  MissingAnchor = "missing-anchor",
  DuplicateEntry = "duplicate-entry",
  ForeignOwner = "foreign-owner-entry",
}

export type NavigationDocument = NavigationRequest["documents"][number];
export type NavigationGraph = NavigationRequest["graphs"][number];
export type NavigationEntry = NavigationGraph["entries"][number];
export type NavigationFinding = {
  readonly code: NavigationFindingCode;
  readonly file: NavigationDocument["path"];
  readonly target: NavigationDocument["path"];
};
export type NavigationFindings = readonly NavigationFinding[];

export class NavigationAudit {
  constructor(private readonly request: NavigationRequest) {}

  execute(): NavigationFindings {
    const findings: NavigationFinding[] = [];
    for (const document of this.request.documents) {
      const owner = this.request.graphs.find(
        (graph) => graph.path === document.owner,
      );
      if (!owner) {
        const finding: NavigationFinding = {
          code: NavigationFindingCode.MissingOwner,
          file: document.path,
          target: document.owner,
        };
        findings.push(finding);
      } else if (
        !owner.entries.some((entry) => entry.target === document.path)
      ) {
        const finding: NavigationFinding = {
          code: NavigationFindingCode.MissingEntry,
          file: owner.path,
          target: document.path,
        };
        findings.push(finding);
      }
    }
    for (const graph of this.request.graphs) {
      const seen = new Set<string>();
      for (const entry of graph.entries) {
        const key = `${entry.target}#${entry.anchor}`;
        if (seen.has(key)) {
          const finding: NavigationFinding = {
            code: NavigationFindingCode.DuplicateEntry,
            file: graph.path,
            target: entry.target,
          };
          findings.push(finding);
        }
        seen.add(key);
        const document = this.request.documents.find(
          (candidate) => candidate.path === entry.target,
        );
        if (!document) {
          const finding: NavigationFinding = {
            code: NavigationFindingCode.MissingTarget,
            file: graph.path,
            target: entry.target,
          };
          findings.push(finding);
          continue;
        }
        if (document.owner !== graph.path) {
          const finding: NavigationFinding = {
            code: NavigationFindingCode.ForeignOwner,
            file: graph.path,
            target: entry.target,
          };
          findings.push(finding);
        }
        if (
          entry.anchor.length > 0 &&
          !document.anchors.includes(entry.anchor)
        ) {
          const finding: NavigationFinding = {
            code: NavigationFindingCode.MissingAnchor,
            file: graph.path,
            target: entry.target,
          };
          findings.push(finding);
        }
      }
    }
    return findings;
  }
}

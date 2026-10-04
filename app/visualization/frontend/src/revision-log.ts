import type { RevisionLogEntry } from "./contracts";
export class RevisionLook {
  static readonly TEXT = {
    description:
      "Global R is the repository-wide event sequence; Task r is the revision within one task. This view shows the selected feature, so gaps can belong to other features. Legacy storage order does not recover historical commit chronology.",
    global: "Global R",
    legacy: "Legacy storage order",
    committed: "Committed append",
    open: "Open task log",
    empty: "No revisions recorded for this feature.",
  };
  constructor(readonly record: RevisionLogEntry) {}
  global(): string {
    return `${RevisionLook.TEXT.global}${this.record.sequence}`;
  }
  provenance(): string {
    switch (this.record.provenance) {
      case "LegacyStorageOrder":
        return RevisionLook.TEXT.legacy;
      case "CommittedAppend":
        return RevisionLook.TEXT.committed;
    }
  }
}

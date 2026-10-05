import type { RevisionLogEntry } from "./contracts";
export class RevisionLook {
  static readonly TEXT = {
    description:
      "Feature R is the event sequence within this feature; Task r is the revision within one task. Imported sequence values, gaps, and provenance are preserved. New events append within this feature. Legacy storage order does not recover historical commit chronology.",
    sequence: "Feature R",
    legacy: "Legacy storage order",
    committed: "Committed append",
    open: "Open task log",
    empty: "No revisions recorded for this feature.",
  };
  constructor(readonly record: RevisionLogEntry) {}
  sequence(): string {
    return `${RevisionLook.TEXT.sequence}${this.record.sequence}`;
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

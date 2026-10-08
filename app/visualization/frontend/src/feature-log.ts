import type { FeatureLogEntry, FeedEntry } from "./contracts";

/** Select the original recorded task revision from a milestone's evidence. */
export interface EvidenceSelection {
  readonly task: FeatureLogEntry["task"];
  readonly revision: FeedEntry["revision"];
}

import type { FeatureCard, FeatureSummary } from "./contracts";
import { FeatureFilter, FeatureLook } from "./observability";
export enum FilterMatch {
  Included = "Included",
  Excluded = "Excluded",
}
/** Presentation of catalog availability without reading unavailable records. */
export class CatalogLook {
  constructor(readonly card: FeatureCard) {}
  id(): string {
    switch (this.card.kind) {
      case "current":
        return this.card.summary.feature.id;
      case "upgrade_required":
        return this.card.feature.id;
      case "unavailable":
        return this.card.feature;
    }
  }
  searchText(): string {
    switch (this.card.kind) {
      case "current":
        return `${this.card.summary.feature.id} ${this.card.summary.feature.objective} ${this.card.summary.feature.branch}`;
      case "upgrade_required":
        return `${this.card.feature.id} ${this.card.feature.objective} ${this.card.feature.branch}`;
      case "unavailable":
        return this.card.feature;
    }
  }
  match(filter: FeatureFilter): FilterMatch {
    switch (this.card.kind) {
      case "current":
        switch (new FeatureLook(this.card.summary).matches(filter)) {
          case true:
            return FilterMatch.Included;
          case false:
            return FilterMatch.Excluded;
        }
        break;
      case "upgrade_required":
      case "unavailable":
        switch (filter) {
          case FeatureFilter.All:
            return FilterMatch.Included;
          case FeatureFilter.Attention:
          case FeatureFilter.Ready:
          case FeatureFilter.Active:
          case FeatureFilter.Closed:
            return FilterMatch.Excluded;
        }
    }
  }
  summaries(): ReadonlyArray<FeatureSummary> {
    switch (this.card.kind) {
      case "current":
        return [this.card.summary];
      case "upgrade_required":
      case "unavailable":
        return [];
    }
  }
  detailKey(): string {
    switch (this.card.kind) {
      case "current":
        return `${this.card.summary.feature.id}:${JSON.stringify(this.card.summary.totals.activity)}`;
      case "upgrade_required":
      case "unavailable":
        return `${this.id()}:${this.card.kind}`;
    }
  }
}

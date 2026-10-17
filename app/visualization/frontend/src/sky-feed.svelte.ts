import { Effect } from "effect";
import type {
  FeatureCard,
  RepositorySelection,
  StoredFeatureSelection,
} from "./contracts";
import type { DashboardApi, DashboardFailure } from "./api";
import { SkyLedger, type SkyLedgerRequest } from "./sky-ledger";

export interface SkyFeedRequest {
  readonly api: DashboardApi;
  readonly repository: RepositorySelection;
}
type FeatureCards = ReadonlyArray<FeatureCard>;

/**
 * Reads the workflows behind the sky. A refresh keeps the last ledger on
 * screen, so a failed read marks the sky stale instead of blanking it.
 */
export class SkyFeed {
  /** The most recently active features drawn as constellations. */
  static readonly LIMIT = 12;
  static readonly CONCURRENCY = 4;
  ledger = $state.raw<ReadonlyArray<SkyLedger>>([]);
  failures = $state.raw<ReadonlyArray<DashboardFailure>>([]);
  private interrupt: () => void = () => {};
  constructor(private readonly request: SkyFeedRequest) {}
  read(cards: FeatureCards): void {
    this.interrupt();
    const chosen = this.recent(cards);
    const reads = chosen.map((feature) => {
      const selection: StoredFeatureSelection = {
        repository: this.request.repository,
        feature,
      };
      return this.request.api.workflow(selection);
    });
    const reading = Effect.all(reads, {
      concurrency: SkyFeed.CONCURRENCY,
    }).pipe(
      Effect.match({
        onFailure: (failure) => {
          this.failures = [failure];
        },
        onSuccess: (workflows) => {
          const request: SkyLedgerRequest = { cards, workflows };
          this.ledger = [new SkyLedger(request)];
          this.failures = [];
        },
      }),
    );
    this.interrupt = Effect.runCallback(reading);
  }
  stop(): void {
    this.interrupt();
  }
  private recent(cards: FeatureCards): ReadonlyArray<string> {
    return cards
      .flatMap((card) => this.activity(card))
      .sort((a, b) => b.at - a.at)
      .slice(0, SkyFeed.LIMIT)
      .map((feature) => feature.id);
  }
  private activity(card: FeatureCard): ReadonlyArray<FeatureActivity> {
    switch (card.kind) {
      case "current":
        return [
          {
            id: card.summary.feature.id,
            at: this.lastActivity(card.summary.totals.activity),
          },
        ];
      case "upgrade_required":
      case "unavailable":
        return [];
    }
  }
  private lastActivity(
    activity: Extract<
      FeatureCard,
      { kind: "current" }
    >["summary"]["totals"]["activity"],
  ): number {
    switch (activity.kind) {
      case "recorded":
        return activity.last_activity_at;
      case "empty":
        return 0;
    }
  }
}
interface FeatureActivity {
  readonly id: string;
  readonly at: number;
}

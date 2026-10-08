import { Effect, Match } from "effect";
import { tick } from "svelte";
import type { RepositoryCard } from "./contracts";
import { DashboardApi } from "./api";
import { CatalogController } from "./catalog-state.svelte";
import {
  ReadController,
  type FeatureReadRequest,
} from "./dashboard-state.svelte";
enum ReturnTargetKind {
  Found = "Found",
  Missing = "Missing",
}
type RepositoryReturnTarget =
  | { kind: ReturnTargetKind.Found; node: HTMLElement }
  | { kind: ReturnTargetKind.Missing };
enum RepositoryRoute {
  Catalog = "Catalog",
  Features = "Features",
}
interface SelectedRepositoryScreen {
  kind: RepositoryRoute.Features;
  card: RepositoryCard;
  read: ReadController;
}
type RepositoryScreen =
  | { kind: RepositoryRoute.Catalog }
  | SelectedRepositoryScreen;
type SelectedRepositoryScreens = ReadonlyArray<SelectedRepositoryScreen>;
type ActiveRead = CatalogController | ReadController;
/** Repository selection owns the scope and lifetime of feature observations. */
export class RepositoryNavigation {
  readonly catalog = new CatalogController(new DashboardApi());
  screen = $state.raw<RepositoryScreen>({ kind: RepositoryRoute.Catalog });
  selected(): SelectedRepositoryScreens {
    switch (this.screen.kind) {
      case RepositoryRoute.Catalog:
        return [];
      case RepositoryRoute.Features:
        return [this.screen];
    }
  }
  reading(): ActiveRead {
    switch (this.screen.kind) {
      case RepositoryRoute.Catalog:
        return this.catalog;
      case RepositoryRoute.Features:
        return this.screen.read;
    }
  }
  select(card: RepositoryCard): void {
    this.stopSelection();
    const request: FeatureReadRequest = {
      api: new DashboardApi(),
      repository: card.repository,
    };
    const read = new ReadController(request);
    this.screen = { kind: RepositoryRoute.Features, card, read };
    read.read();
  }
  back(): void {
    switch (this.screen.kind) {
      case RepositoryRoute.Catalog:
        return;
      case RepositoryRoute.Features: {
        const id = `repository-${this.screen.card.repository.repository_id}`;
        this.stopSelection();
        this.screen = { kind: RepositoryRoute.Catalog };
        Effect.runCallback(
          Effect.promise(() => tick()).pipe(
            Effect.andThen(Effect.sync(() => this.focusReturnTarget(id))),
          ),
        );
      }
    }
  }
  private focusReturnTarget(id: string): void {
    const target: RepositoryReturnTarget = Match.value(
      document.getElementById(id),
    ).pipe(
      Match.when(
        Match.instanceOf(HTMLElement),
        (node): RepositoryReturnTarget => ({
          kind: ReturnTargetKind.Found,
          node,
        }),
      ),
      Match.orElse(
        (): RepositoryReturnTarget => ({ kind: ReturnTargetKind.Missing }),
      ),
    );
    switch (target.kind) {
      case ReturnTargetKind.Found:
        target.node.focus();
        return;
      case ReturnTargetKind.Missing:
        return;
    }
  }
  private stopSelection(): void {
    switch (this.screen.kind) {
      case RepositoryRoute.Catalog:
        break;
      case RepositoryRoute.Features:
        this.screen.read.stop();
        break;
    }
  }
  stop(): void {
    this.catalog.stop();
    this.stopSelection();
  }
}

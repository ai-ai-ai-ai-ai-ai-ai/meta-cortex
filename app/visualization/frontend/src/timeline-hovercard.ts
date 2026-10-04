import { Match } from "effect";
enum CardActivation {
  Active = "active",
  Inactive = "inactive",
}
enum CardSide {
  Above = "above",
  Below = "below",
}
interface CardPlacement {
  readonly anchor: DOMRect;
  readonly height: number;
}
export class TimelineHovercard {
  private timer = 0;
  constructor(readonly id: string) {}
  open(button: HTMLElement): void {
    this.keep();
    Match.value(document.getElementById(this.id)).pipe(
      Match.when(Match.instanceOf(HTMLElement), (card) => {
        card.showPopover();
        const anchor = button.getBoundingClientRect();
        card.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - card.offsetWidth - 12))}px`;
        const placement: CardPlacement = { anchor, height: card.offsetHeight };
        card.style.top = `${this.top(placement)}px`;
      }),
      Match.orElse(() => {}),
    );
  }
  private side(placement: CardPlacement): CardSide {
    switch (
      placement.anchor.bottom + placement.height + 20 >
      window.innerHeight
    ) {
      case true:
        return CardSide.Above;
      case false:
        return CardSide.Below;
    }
  }
  private top(placement: CardPlacement): number {
    switch (this.side(placement)) {
      case CardSide.Above:
        return Math.max(12, placement.anchor.top - placement.height - 8);
      case CardSide.Below:
        return placement.anchor.bottom + 8;
    }
  }
  keep(): void {
    window.clearTimeout(this.timer);
  }
  leave(): void {
    this.keep();
    this.timer = window.setTimeout(() => this.dismiss(), 160);
  }
  private activation(element: HTMLElement): CardActivation {
    switch (
      element.matches(":hover") ||
      element.contains(document.activeElement)
    ) {
      case true:
        return CardActivation.Active;
      case false:
        return CardActivation.Inactive;
    }
  }
  private triggerActivation(): CardActivation {
    return Match.value(document.getElementById(`${this.id}-trigger`)).pipe(
      Match.when(Match.instanceOf(HTMLElement), (trigger) =>
        this.activation(trigger),
      ),
      Match.orElse(() => CardActivation.Inactive),
    );
  }
  private dismiss(): void {
    Match.value(document.getElementById(this.id)).pipe(
      Match.when(Match.instanceOf(HTMLElement), (card) =>
        this.dismissCard(card),
      ),
      Match.orElse(() => {}),
    );
  }
  private dismissCard(card: HTMLElement): void {
    switch (this.activation(card)) {
      case CardActivation.Active:
        return;
      case CardActivation.Inactive:
        break;
    }
    switch (this.triggerActivation()) {
      case CardActivation.Active:
        return;
      case CardActivation.Inactive:
        card.hidePopover();
    }
  }
}

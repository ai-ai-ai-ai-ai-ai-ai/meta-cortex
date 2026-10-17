/** How a repository's features are shown: the workbench lists or the sky. */
export enum ViewMode {
  Classic = "classic",
  Animated = "animated",
}
/** The sky's code loads on the first switch to Animated, then stays. */
export enum SkyLoad {
  Idle = "idle",
  Requested = "requested",
}
export interface Origin {
  readonly x: number;
  readonly y: number;
}
/** A press on one of the switch's buttons. */
export type SwitchClick = MouseEvent & {
  readonly currentTarget: EventTarget & HTMLButtonElement;
};
export interface ViewChoice {
  readonly mode: ViewMode;
  readonly origin: Origin;
}

/** The Classic ⇄ Animated choice and where the switch was pressed. */
export class ViewModes {
  mode = $state<ViewMode>(ViewMode.Classic);
  origin = $state.raw<Origin>({ x: 0, y: 0 });
  load = $state<SkyLoad>(SkyLoad.Idle);
  choose(choice: ViewChoice): void {
    this.origin = choice.origin;
    this.mode = choice.mode;
    switch (choice.mode) {
      case ViewMode.Animated:
        this.load = SkyLoad.Requested;
        return;
      case ViewMode.Classic:
        return;
    }
  }
  /** The sky opens from the centre of the pressed button. */
  originOf(click: SwitchClick): Origin {
    const box = click.currentTarget.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  }
}

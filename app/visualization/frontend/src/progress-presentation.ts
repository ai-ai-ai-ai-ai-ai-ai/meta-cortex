import type { FlowCount, FlowState } from "./contracts";

export class ProgressSummary {
  readonly total: number;
  readonly finished: number;
  readonly visible: ReadonlyArray<FlowCount>;
  constructor(counts: ReadonlyArray<FlowCount>) {
    const order: ReadonlyArray<FlowState> = [
      "integrated",
      "completed",
      "working",
      "blocked",
      "ready",
      "queued",
      "cancelled",
    ];
    this.total = counts.reduce((sum, item) => sum + item.count, 0);
    this.finished = counts
      .filter(
        (item) => item.state === "integrated" || item.state === "completed",
      )
      .reduce((sum, item) => sum + item.count, 0);
    this.visible = counts
      .filter((item) => item.count > 0)
      .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
  }
  get label(): string {
    return `${this.finished}/${this.total} finished`;
  }
}

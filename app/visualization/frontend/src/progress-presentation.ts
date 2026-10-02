import type { FlowCount, FlowState } from "./contracts";

export class ProgressPresentation {
  constructor(readonly counts: ReadonlyArray<FlowCount>) {}
  total(): number {
    return this.counts.reduce((sum, item) => sum + item.count, 0);
  }
  finished(): number {
    return this.counts
      .filter(
        (item) => item.state === "integrated" || item.state === "completed",
      )
      .reduce((sum, item) => sum + item.count, 0);
  }
  percent(): number {
    return Math.round((this.finished() / Math.max(1, this.total())) * 100);
  }
  visible(): ReadonlyArray<FlowCount> {
    const order: FlowState[] = [
      "integrated",
      "completed",
      "working",
      "blocked",
      "ready",
      "queued",
      "cancelled",
    ];
    return order.flatMap((state) =>
      this.counts.filter((item) => item.state === state && item.count > 0),
    );
  }
}

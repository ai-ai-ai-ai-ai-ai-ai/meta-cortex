import type { FlowCount, FlowState } from "./contracts";
export type FlowCounts = ReadonlyArray<FlowCount>;
export interface FlowProgress {
  total: number;
  finished: number;
  percent: number;
  visible: FlowCounts;
  byState: Record<FlowState, number>;
}
export function summarizeCounts(counts: FlowCounts): FlowProgress {
  const byState: Record<FlowState, number> = {
    integrated: 0,
    completed: 0,
    working: 0,
    blocked: 0,
    ready: 0,
    queued: 0,
    cancelled: 0,
  };
  let total = 0;
  for (const item of counts) {
    total += item.count;
    byState[item.state] += item.count;
  }
  const finished = byState.integrated + byState.completed;
  const order: ReadonlyArray<FlowState> = [
    "integrated",
    "completed",
    "working",
    "blocked",
    "ready",
    "queued",
    "cancelled",
  ];
  return {
    total,
    finished,
    percent: Math.round((finished / Math.max(1, total)) * 100),
    visible: order.flatMap((state) =>
      counts.filter((item) => item.state === state && item.count > 0),
    ),
    byState,
  };
}

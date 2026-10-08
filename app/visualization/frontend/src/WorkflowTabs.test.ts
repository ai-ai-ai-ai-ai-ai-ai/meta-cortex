import { expect, it } from "vitest";
import { WorkflowTabs, WorkflowView } from "./observability";

it("places Feature log first and makes Home return to it", () => {
  expect(WorkflowTabs.VIEWS[0]).toBe(WorkflowView.FeatureLog);
  expect(new WorkflowTabs(WorkflowView.Revisions).next("Home")).toEqual([
    WorkflowView.FeatureLog,
  ]);
  expect(new WorkflowTabs(WorkflowView.Revisions).next("ArrowRight")).toEqual([
    WorkflowView.FeatureLog,
  ]);
  expect(new WorkflowTabs(WorkflowView.FeatureLog).next("ArrowRight")).toEqual([
    WorkflowView.Log,
  ]);
});

it("keeps the existing workflow views reachable in order", () => {
  expect(WorkflowTabs.VIEWS.slice(1)).toEqual([
    WorkflowView.Log,
    WorkflowView.Windows,
    WorkflowView.Revisions,
  ]);
  expect(new WorkflowTabs(WorkflowView.Log).next("ArrowRight")).toEqual([
    WorkflowView.Windows,
  ]);
  expect(new WorkflowTabs(WorkflowView.Windows).next("End")).toEqual([
    WorkflowView.Revisions,
  ]);
  expect(new WorkflowTabs(WorkflowView.Log).next("Escape")).toEqual([]);
});

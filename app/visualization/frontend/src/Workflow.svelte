<script lang="ts">
  import { GitBranch, Target, Users } from "@lucide/svelte";
  import * as Accordion from "$lib/components/ui/accordion";
  import * as Table from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Progress } from "$lib/components/ui/progress";
  import Contribution from "./Contribution.svelte";
  import DataTable from "./DataTable.svelte";
  import { ReportingTable } from "./agent-tree";
  import { WorkTiming } from "./execution-presentation";
  import { ProgressSummary } from "./progress-presentation";
  import { ContributionSection, TaskPresentation } from "./task-presentation";
  import type { FeatureFlow, TaskFlow } from "./contracts";

  interface WorkflowProperties {
    flow: FeatureFlow;
    select: (flow: TaskFlow) => void;
  }
  let { flow, select }: WorkflowProperties = $props();
  let query = $state("");
  let visible = $state<Record<ContributionSection, number>>({
    [ContributionSection.Attention]: 3,
    [ContributionSection.Ongoing]: 3,
    [ContributionSection.Upcoming]: 3,
    [ContributionSection.Finished]: 3,
    [ContributionSection.Cancelled]: 3,
  });
  let progress = $derived(new ProgressSummary(flow.counts));
  let tasks = $derived(
    flow.tasks.records
      .filter((item) =>
        `${item.task.common.id} ${item.task.common.objective} ${item.task.common.progress.summary} ${TaskPresentation.workerName(item)} ${TaskPresentation.status(item.task)}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
      .sort(TaskPresentation.compareActivity),
  );
  let sections = $derived(
    Object.values(ContributionSection)
      .map((label) => ({
        label,
        tasks: tasks.filter(
          (item) =>
            TaskPresentation.sections[TaskPresentation.status(item.task)] ===
            label,
        ),
      }))
      .filter((section) => section.tasks.length > 0),
  );
</script>

<section class="space-y-5" aria-label="Workflow overview">
  <header class="space-y-4">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0 space-y-2">
        <h1 class="break-words text-2xl font-semibold tracking-tight">
          {flow.feature.id}
        </h1>
        <p class="flex items-center gap-2 text-xs text-muted-foreground">
          <GitBranch class="size-3.5 shrink-0" /><span class="break-all"
            >{flow.feature.branch}</span
          >
        </p>
      </div>
      <div class="w-full space-y-2 sm:w-56">
        <span class="text-sm font-medium">{progress.label}</span>
        <Progress
          value={progress.finished}
          max={Math.max(1, progress.total)}
          aria-label="Feature progress"
        />
        <p class="text-xs text-muted-foreground">
          {progress.visible
            .map((item) => `${item.count} ${item.state}`)
            .join(" · ")}
        </p>
      </div>
    </div>
    <div class="space-y-2 border-l-2 border-primary pl-4">
      <h2
        class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
      >
        <Target class="size-4" />The requirement
      </h2>
      <p class="max-w-4xl text-sm leading-relaxed">{flow.feature.objective}</p>
    </div>
  </header>

  <dl
    class="grid gap-4 border-y py-4 sm:grid-cols-3"
    aria-label="Feature work dates"
  >
    {#each WorkTiming.feature(flow) as field (field.label)}<div
        class="space-y-1"
      >
        <dt class="text-xs text-muted-foreground">{field.label}</dt>
        <dd class="text-sm font-semibold">{field.value}</dd>
      </div>{/each}
  </dl>
  <p class="text-xs text-muted-foreground">
    Dates describe recorded task activity; elapsed time includes waiting.
  </p>

  <section class="space-y-3" aria-label="Agent execution tree">
    <h2 class="flex items-center gap-2 font-semibold">
      <Users class="size-4" />Agent execution tree
    </h2>
    <p class="text-xs text-muted-foreground">
      Expand an agent for tasks and attempts. Select a task for its
      requirements, delivered work and evidence.
    </p>
    {#if flow.tasks.records.length < progress.total}<p
        class="text-sm text-muted-foreground"
      >
        This page contains {flow.tasks.records.length} of {progress.total} tasks.
        Progress above covers the entire workflow.
      </p>{/if}
    <DataTable root={new ReportingTable(flow.tasks.records).root} {select} />
    <p class="text-xs text-muted-foreground">
      Reporting links use recorded assignments. Older work is grouped by its
      recorded creator. Own and team progress cover this page; attempt and
      commit counts cover loaded history.
    </p>
  </section>

  <Accordion.Root type="multiple">
    <Accordion.Item value="contributions">
      <Accordion.Trigger>Browse contributions by status</Accordion.Trigger>
      <Accordion.Content class="space-y-5">
        {#if flow.tasks.records.length > 1 || query}
          <div class="flex flex-wrap items-end justify-between gap-4">
            <h2 class="font-semibold">Agent contributions</h2>
            <div class="w-full space-y-1.5 sm:w-64">
              <label
                for="contribution-filter"
                class="text-xs text-muted-foreground">Find a contribution</label
              >
              <Input
                id="contribution-filter"
                placeholder="Agent, task, result or status…"
                bind:value={query}
              />
            </div>
          </div>
        {/if}
        {#each sections as section (section.label)}
          <section class="space-y-4" aria-label={section.label}>
            <h3 class="flex items-center gap-2 font-semibold">
              {section.label}<Badge variant="secondary"
                >{section.tasks.length}</Badge
              >
            </h3>
            {#each section.tasks.slice(0, visible[section.label]) as task (task.task.common.id)}<Contribution
                flow={task}
                {select}
              />{/each}
            {#if section.tasks.length > visible[section.label]}<Button
                variant="outline"
                onclick={() => (visible[section.label] += 3)}
                >Show more · {section.tasks.length - visible[section.label]} remaining
                in {section.label.toLowerCase()}</Button
              >{/if}
          </section>
        {:else}<p class="py-8 text-sm text-muted-foreground">
            {#if query}No contributions match your search.{:else}No tasks
              recorded yet.{/if}
          </p>{/each}
      </Accordion.Content>
    </Accordion.Item>
    <Accordion.Item value="record">
      <Accordion.Trigger>Workflow record &amp; data source</Accordion.Trigger>
      <Accordion.Content>
        <Table.Root aria-label="Workflow fields"
          ><Table.Body>
            {#if flow.activity.kind === "recorded"}<Table.Row
                ><Table.Head>Last activity</Table.Head><Table.Cell
                  >{WorkTiming.date(flow.activity.last_activity_at)}</Table.Cell
                ></Table.Row
              >{/if}
            {#each [{ name: "Feature", value: flow.feature.id }, { name: "Branch", value: flow.feature.branch }, { name: "Worktree", value: flow.feature.worktree }, { name: "Version", value: flow.feature.version }, { name: "Observed", value: new Date(flow.observed_at).toLocaleString() }] as field (field.name)}
              <Table.Row
                ><Table.Head>{field.name}</Table.Head><Table.Cell
                  class="whitespace-normal break-all">{field.value}</Table.Cell
                ></Table.Row
              >
            {/each}
          </Table.Body></Table.Root
        >
        <p class="mt-4 text-xs text-muted-foreground">
          Read-only Turso records. Commit descriptions are ledger event notes;
          Git commit messages and Git authorship are not recorded. Acceptance
          criteria describe requirements; check results are the recorded
          verification evidence. Feature creation and completion events are not
          recorded; work dates are derived from task activity.
        </p>
      </Accordion.Content>
    </Accordion.Item>
  </Accordion.Root>
</section>

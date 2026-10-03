<script lang="ts">
  import {
    GitBranch,
    GitCommitHorizontal,
    Activity,
    Users,
    Info,
    CheckCheck,
    CirclePlay,
    CircleAlert,
    GitPullRequest,
  } from "@lucide/svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Accordion from "$lib/components/ui/accordion";
  import * as Tabs from "$lib/components/ui/tabs";
  import * as Table from "$lib/components/ui/table";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Progress } from "$lib/components/ui/progress";
  import DataTable from "./DataTable.svelte";
  import { ReportingTable } from "./agent-tree";
  import { ProgressSummary } from "./progress-presentation";
  import { TaskPresentation } from "./task-presentation";
  import { WorkflowEvidence } from "./workflow-evidence";
  import type { FeatureFlow, TaskFlow } from "./contracts";
  let {
    flow,
    select,
  }: { flow: FeatureFlow; select: (flow: TaskFlow) => void } = $props();
  let view = $state("agents");
  let query = $state("");
  let visibleEvents = $state(30);
  let progress = $derived(new ProgressSummary(flow.counts));
  let evidence = $derived(new WorkflowEvidence(flow.tasks.records));
  let tasks = $derived(
    flow.tasks.records.filter((item) =>
      `${item.task.common.id} ${item.task.common.objective} ${TaskPresentation.describe(item.task).actor} ${TaskPresentation.status(item.task)}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
  );
  let stats = $derived([
    {
      label: "Finished",
      count: `${progress.finished} / ${progress.total}`,
      hint: "Completed or integrated",
      icon: CheckCheck,
    },
    {
      label: "Working",
      count: flow.counts.find((item) => item.state === "working")?.count ?? 0,
      hint: "Tasks in progress",
      icon: CirclePlay,
    },
    {
      label: "Ready",
      count: flow.counts.find((item) => item.state === "ready")?.count ?? 0,
      hint: "Awaiting the next handoff",
      icon: GitPullRequest,
    },
    {
      label: "Blocked",
      count: flow.counts.find((item) => item.state === "blocked")?.count ?? 0,
      hint: "Needs attention",
      icon: CircleAlert,
    },
  ]);
</script>

<section class="space-y-6" aria-label="Workflow overview">
  <div class="space-y-2">
    <h1 class="break-words text-2xl font-semibold tracking-tight">
      {flow.feature.id}
    </h1>
    <p class="max-w-3xl text-sm text-muted-foreground">
      {flow.feature.objective}
    </p>
    <div class="flex items-center gap-2 text-xs text-muted-foreground">
      <GitBranch class="size-3.5" /><span class="break-all"
        >{flow.feature.branch}</span
      >
    </div>
  </div>
  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    {#each stats as stat (stat.label)}
      <Card.Root size="sm"
        ><Card.Header>
          <Card.Description
            ><span class="flex items-center justify-between"
              >{stat.label}<stat.icon class="size-4" /></span
            ></Card.Description
          >
          <Card.Title class="text-2xl tabular-nums">{stat.count}</Card.Title>
        </Card.Header><Card.Content class="text-xs text-muted-foreground"
          >{stat.hint}</Card.Content
        ></Card.Root
      >
    {/each}
  </div>
  <div class="space-y-2">
    <div
      class="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"
    >
      <span>Feature total · {progress.label}</span><span
        >{progress.visible
          .map((item) => `${item.count} ${item.state}`)
          .join(" · ")}</span
      >
    </div>
    <Progress
      value={progress.finished}
      max={Math.max(1, progress.total)}
      aria-label="Feature progress"
    />
  </div>
  <Tabs.Root bind:value={view}>
    <Tabs.List aria-label="Workflow views" class="mb-4 h-auto flex-wrap">
      <Tabs.Trigger value="agents"><Users />Agents</Tabs.Trigger>
      <Tabs.Trigger value="commits"
        ><GitCommitHorizontal />Commits ({evidence.commits
          .length})</Tabs.Trigger
      >
      <Tabs.Trigger value="activity"
        ><Activity />Activity ({evidence.activity.length})</Tabs.Trigger
      >
      <Tabs.Trigger value="details"><Info />Details</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="agents" class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold">Agent lifecycle</h2>
          <p class="text-xs text-muted-foreground">
            Expand an agent to see its tasks. Select a row for full details.
          </p>
        </div>
        <Input
          aria-label="Filter agents and tasks"
          placeholder="Filter agents, tasks, or status…"
          bind:value={query}
          class="w-full sm:w-64"
        />
      </div>
      <DataTable root={new ReportingTable(tasks).root} {select} />
      <p class="text-xs text-muted-foreground">
        Showing {tasks.length} of {flow.tasks.records.length} loaded tasks. Own and
        team progress use these rows. Reporting links come from recorded assignments;
        historical work is grouped by its recorded creator.
      </p>
    </Tabs.Content>
    <Tabs.Content value="commits" class="space-y-4">
      <div>
        <h2 class="font-semibold">Git history</h2>
        <p class="text-xs text-muted-foreground">
          Checkpoints and integrations, newest first, across the loaded tasks.
          Actors identify who recorded the event.
        </p>
      </div>
      <div class="rounded-md border">
        <Table.Root aria-label="Workflow commits">
          <Table.Header
            ><Table.Row
              ><Table.Head>Commit</Table.Head><Table.Head>Event</Table.Head
              ><Table.Head>Task / recorded by</Table.Head><Table.Head
                >When</Table.Head
              ></Table.Row
            ></Table.Header
          >
          <Table.Body
            >{#each evidence.commits.slice(0, visibleEvents) as entry (`${entry.flow.task.common.id}:${entry.kind}:${entry.record.revision}`)}
              <Table.Row
                ><Table.Cell
                  ><code title={entry.record.commit}
                    >{entry.record.commit.slice(0, 8)}</code
                  ></Table.Cell
                >
                <Table.Cell
                  ><Badge variant="outline">{entry.kind}</Badge></Table.Cell
                >
                <Table.Cell
                  ><Button
                    variant="link"
                    class="h-auto p-0"
                    onclick={() => select(entry.flow)}
                    >{entry.flow.task.common.id}</Button
                  >
                  <p class="text-xs text-muted-foreground">
                    {TaskPresentation.agent(entry.record.actor)}
                  </p></Table.Cell
                >
                <Table.Cell class="text-xs text-muted-foreground"
                  >{new Date(entry.record.at).toLocaleString()}</Table.Cell
                ></Table.Row
              >
            {:else}<Table.Row
                ><Table.Cell
                  colspan={4}
                  class="py-10 text-center text-muted-foreground"
                  >No Git commits recorded for these tasks.</Table.Cell
                ></Table.Row
              >{/each}</Table.Body
          >
        </Table.Root>
      </div>
      {#if evidence.commits.length > visibleEvents}<Button
          variant="outline"
          onclick={() => (visibleEvents += 30)}>Show more commits</Button
        >{/if}
    </Tabs.Content>
    <Tabs.Content value="activity" class="space-y-4">
      <div>
        <h2 class="font-semibold">Recorded activity</h2>
        <p class="text-xs text-muted-foreground">
          Claims, progress, checkpoints, handoffs and restarts across the loaded
          tasks.
        </p>
      </div>
      <Accordion.Root type="multiple" class="rounded-md border px-4">
        {#each evidence.activity.slice(0, visibleEvents) as entry (`${entry.flow.task.common.id}:${entry.record.revision}`)}
          <Accordion.Item
            value={`${entry.flow.task.common.id}:${entry.record.revision}`}
          >
            <Accordion.Trigger>
              <Activity class="size-4 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1 space-y-1 text-left">
                <div class="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{entry.record.kind}</Badge><span
                    >{TaskPresentation.agentName(entry.record.actor)}</span
                  ><time
                    class="ml-auto text-xs font-normal text-muted-foreground"
                    >{new Date(entry.record.at).toLocaleString()}</time
                  >
                </div>
                <p class="truncate text-xs font-normal">
                  {entry.flow.task.common.id}
                </p>
                <p
                  class="line-clamp-1 text-xs font-normal text-muted-foreground"
                >
                  {entry.record.note}
                </p>
              </div>
            </Accordion.Trigger>
            <Accordion.Content class="space-y-3">
              <p class="break-words">{entry.record.note}</p>
              <p class="text-xs text-muted-foreground">
                {TaskPresentation.agent(entry.record.actor)} · attempt {entry
                  .record.attempt} · revision {entry.record.revision}
              </p>
              <Button
                variant="outline"
                size="sm"
                onclick={() => select(entry.flow)}>Open task details</Button
              >
            </Accordion.Content>
          </Accordion.Item>
        {:else}<p class="py-10 text-center text-sm text-muted-foreground">
            No lifecycle events recorded for these tasks.
          </p>{/each}
      </Accordion.Root>
      {#if evidence.activity.length > visibleEvents}<Button
          variant="outline"
          onclick={() => (visibleEvents += 30)}>Show more activity</Button
        >{/if}
    </Tabs.Content>
    <Tabs.Content value="details" class="space-y-4">
      <h2 class="font-semibold">Workflow record</h2>
      <Table.Root aria-label="Workflow fields"
        ><Table.Body>
          {#each [{ name: "Feature", value: flow.feature.id }, { name: "Objective", value: flow.feature.objective }, { name: "Branch", value: flow.feature.branch }, { name: "Worktree", value: flow.feature.worktree }, { name: "Version", value: flow.feature.version }, { name: "Observed", value: new Date(flow.observed_at).toLocaleString() }] as field (field.name)}<Table.Row
              ><Table.Head>{field.name}</Table.Head><Table.Cell
                class="whitespace-normal break-all">{field.value}</Table.Cell
              ></Table.Row
            >{/each}
        </Table.Body></Table.Root
      >
    </Tabs.Content>
  </Tabs.Root>
  {#if evidence.partial && (view === "commits" || view === "activity")}<p
      class="text-xs text-muted-foreground"
    >
      Some tasks have older events. Open a task’s full history to inspect them.
    </p>{/if}
</section>

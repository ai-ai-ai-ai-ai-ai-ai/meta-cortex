<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import * as Accordion from "$lib/components/ui/accordion";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import type { TaskV2, TaskFlow } from "./contracts";
  import { TaskPresentation } from "./task-presentation";
  interface RecordedTaskProperties {
    task: TaskV2;
    flow?: TaskFlow;
    history: (task: TaskV2) => void;
  }
  let { task, flow, history }: RecordedTaskProperties = $props();
  let display = $derived(TaskPresentation.describe(task));
</script>

<Badge variant="secondary">{display.statusLabel}</Badge>
<p>{task.common.objective}</p>
<p class="text-sm text-muted-foreground">
  Attempt {task.common.attempt} · revision {task.common.revision} · {new Date(
    task.common.last_update,
  ).toLocaleString()}
</p>
<Tabs.Root value="record">
  <Tabs.List aria-label="Recorded task sections">
    <Tabs.Trigger value="record">Record</Tabs.Trigger>
    <Tabs.Trigger value="checks"
      >Checks ({task.common.progress.checks.length})</Tabs.Trigger
    >
    <Tabs.Trigger value="history">History</Tabs.Trigger>
    <Tabs.Trigger value="raw">Raw</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="record" class="space-y-4">
    <h3 class="font-semibold">Latest contribution</h3>
    <p>{task.common.progress.summary || "No progress summary recorded."}</p>
    {#if display.reason}<p>{display.reason}</p>{/if}
    <dl class="grid grid-cols-2 gap-2 text-sm">
      {#if flow}<dt>Worker</dt>
        <dd>
          {#if flow.worker.kind === "recorded"}{TaskPresentation.agent(
              flow.worker.agent,
            )}{:else}Unrecorded{/if}
        </dd>{/if}
      <dt>Assignment</dt>
      <dd>{display.actor}</dd>
      <dt>Reports to</dt>
      <dd>{display.reportsTo}</dd>
      <dt>Workspace</dt>
      <dd>{display.workspaceLabel}</dd>
      {#if task.workspace.kind === "git"}<dt>Branch</dt>
        <dd class="break-all">{task.workspace.branch}</dd>
        <dt>Path</dt>
        <dd class="break-all">{task.workspace.path}</dd>{/if}
      <dt>Lease</dt>
      <dd>{display.lease}</dd>
      {#if task.common.checkpoint.kind === "git"}<dt>Checkpoint</dt>
        <dd class="break-all">{task.common.checkpoint.commit}</dd>{/if}
      {#if task.state.kind === "integrated"}<dt>Integration</dt>
        <dd class="break-all">{task.state.commit}</dd>{/if}
    </dl>
    <Accordion.Root type="multiple">
      {#each [{ label: "Findings", values: task.common.progress.findings }, { label: "Next steps", values: task.common.progress.next_steps }, { label: "Acceptance", values: task.common.acceptance }, { label: "Dependencies", values: task.common.dependencies }] as section (section.label)}
        <Accordion.Item value={section.label}>
          <Accordion.Trigger
            >{section.label} ({section.values.length})</Accordion.Trigger
          >
          <Accordion.Content
            ><ul class="space-y-2">
              {#each section.values as value, index (index)}<li>
                  {value}
                </li>{/each}
            </ul></Accordion.Content
          >
        </Accordion.Item>
      {/each}
    </Accordion.Root>
  </Tabs.Content>
  <Tabs.Content value="checks">
    {#if task.common.progress.checks.length === 0}<p>
        No checks recorded.
      </p>{/if}
    <Accordion.Root type="multiple">
      {#each task.common.progress.checks as check, index (index)}
        <Accordion.Item value={String(index)}>
          <Accordion.Trigger
            >{check.outcome} · {check.command}</Accordion.Trigger
          >
          <Accordion.Content
            ><pre
              class="whitespace-pre-wrap break-all">{check.evidence}</pre></Accordion.Content
          >
        </Accordion.Item>
      {/each}
    </Accordion.Root>
  </Tabs.Content>
  <Tabs.Content value="history" class="space-y-4">
    {#if flow}
      {#each [...flow.checkpoints, ...flow.integrations] as commit (`${commit.revision}:${commit.commit}`)}<p
          class="text-sm break-all"
        >
          {commit.commit} · {TaskPresentation.agent(commit.actor)} · revision {commit.revision}
          · {new Date(commit.at).toLocaleString()}
        </p>{/each}
      {#each flow.milestones as event (event.revision)}<p class="text-sm">
          {event.kind} · {TaskPresentation.agent(event.actor)} · attempt {event.attempt}
          · revision {event.revision} · {new Date(event.at).toLocaleString()}<br
          />{event.note}
        </p>{/each}
      {#if flow.history_end === "More"}<p>
          Older events are available in full history.
        </p>{/if}
    {:else}<p>
        Event actors and historical worker evidence are available in full
        history.
      </p>{/if}
    <Button variant="outline" onclick={() => history(task)}
      >Open full history</Button
    >
  </Tabs.Content>
  <Tabs.Content value="raw"
    ><pre class="whitespace-pre-wrap break-all">{JSON.stringify(
        flow ?? task,
        null,
        2,
      )}</pre></Tabs.Content
  >
</Tabs.Root>

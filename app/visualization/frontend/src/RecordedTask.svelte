<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs";
  import * as Table from "$lib/components/ui/table";
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

<div class="space-y-3">
  <div class="flex flex-wrap items-center gap-3">
    <Badge variant="secondary" class={TaskPresentation.tones[display.status]}
      >{display.statusLabel}</Badge
    >
    <p class="text-sm text-muted-foreground">
      Attempt {task.common.attempt} · revision {task.common.revision} · {new Date(
        task.common.last_update,
      ).toLocaleString()}
    </p>
  </div>
  <p class="max-w-5xl text-lg leading-relaxed break-words">
    {task.common.objective}
  </p>
</div>
<Tabs.Root value="record">
  <Tabs.List aria-label="Recorded task sections">
    <Tabs.Trigger value="record">Record</Tabs.Trigger>
    <Tabs.Trigger value="checks"
      >Checks ({task.common.progress.checks.length})</Tabs.Trigger
    >
    <Tabs.Trigger value="history">History</Tabs.Trigger>
    <Tabs.Trigger value="raw">Raw</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="record" class="grid gap-8 pt-4 lg:grid-cols-2">
    <section class="min-w-0 space-y-4" aria-label="Result and requirements">
      <h3 class="font-semibold">Latest contribution</h3>
      <p class="leading-relaxed break-words">
        {task.common.progress.summary || "No progress summary recorded."}
      </p>
      {#if display.reason}<p
          class="border-l-2 pl-4 text-sm leading-relaxed break-words"
        >
          {display.reason}
        </p>{/if}

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
    </section>
    <section class="min-w-0 space-y-4" aria-label="Assignment and Git evidence">
      <h3 class="font-semibold">Assignment &amp; Git evidence</h3>
      <Table.Root aria-label="Task fields">
        <Table.Body>
          {#if flow}<Table.Row
              ><Table.Head>Worker</Table.Head><Table.Cell
                >{#if flow.worker.kind === "recorded"}{TaskPresentation.agent(
                    flow.worker.agent,
                  )}{:else}Unrecorded{/if}</Table.Cell
              ></Table.Row
            >{/if}
          {#each [{ label: "Assignment", value: display.actor }, { label: "Reports to", value: display.reportsTo }, { label: "Workspace", value: display.workspaceLabel }, { label: "Workspace detail", value: display.workspace }, { label: "Lease", value: display.lease }, { label: "Checkpoint", value: display.checkpoint }, { label: "Integration", value: display.integration }, { label: "Created", value: new Date(task.common.created_at).toLocaleString() }, { label: "Progress updated", value: new Date(task.common.last_progress).toLocaleString() }] as field (field.label)}
            <Table.Row
              ><Table.Head>{field.label}</Table.Head><Table.Cell
                class="whitespace-normal break-all">{field.value}</Table.Cell
              ></Table.Row
            >
          {/each}
        </Table.Body>
      </Table.Root>
    </section>
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
      <Table.Root aria-label="Commit history">
        <Table.Header
          ><Table.Row
            ><Table.Head>Commit</Table.Head><Table.Head>Actor</Table.Head
            ><Table.Head>Revision / date</Table.Head></Table.Row
          ></Table.Header
        >
        <Table.Body
          >{#each [...flow.checkpoints, ...flow.integrations] as commit (`${commit.revision}:${commit.commit}`)}<Table.Row
              ><Table.Cell class="whitespace-normal break-all"
                >{commit.commit}</Table.Cell
              ><Table.Cell>{TaskPresentation.agent(commit.actor)}</Table.Cell
              ><Table.Cell
                >{commit.revision} · {new Date(
                  commit.at,
                ).toLocaleString()}</Table.Cell
              ></Table.Row
            >{/each}</Table.Body
        >
      </Table.Root>
      <Accordion.Root type="multiple">
        {#each flow.milestones as event (event.revision)}<Accordion.Item
            value={String(event.revision)}
            ><Accordion.Trigger
              >{event.kind} · {TaskPresentation.agent(event.actor)} · attempt {event.attempt}
              · revision {event.revision}</Accordion.Trigger
            ><Accordion.Content
              ><p>{new Date(event.at).toLocaleString()}</p>
              <p>{event.note}</p></Accordion.Content
            ></Accordion.Item
          >{/each}
      </Accordion.Root>
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

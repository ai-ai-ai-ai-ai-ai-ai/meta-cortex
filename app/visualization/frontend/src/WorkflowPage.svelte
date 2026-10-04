<script lang="ts">
  import { tick } from "svelte";
  import type { FeatureSummary, FeatureWorkflow } from "./contracts";
  import { ArrowLeft } from "@lucide/svelte";
  import {
    ChapterNavigation,
    FeatureLook,
    WorkflowLook,
    WorkflowView,
    WorkflowTabs,
    ChapterLook,
    RecordedTime,
  } from "./observability";
  import RevisionLog from "./RevisionLog.svelte";
  import Timeline from "./Timeline.svelte";
  import { TimelineScale } from "./timeline";
  import { WorkerTimeline } from "./worker-timeline";
  import { StatusLook } from "./presentation";
  import FeedCard from "./FeedCard.svelte";
  import PullRequests from "./PullRequests.svelte";
  interface Props {
    summary: FeatureSummary;
    workflow: FeatureWorkflow;
    initialTask: string;
    back: () => void;
  }
  let { summary, workflow, initialTask, back }: Props = $props();
  let view = $state(WorkflowView.Log);
  let selected = $derived(initialTask);
  let look = $derived(new WorkflowLook(workflow));
  let chapters = $derived(new TimelineScale(workflow).chapters());
  let workers = $derived(new WorkerTimeline(workflow));
  function jump(task: string): void {
    view = WorkflowView.Log;
    selected = task;
    new ChapterNavigation(selected).jump();
  }
  async function selectTab(tab: WorkflowView): Promise<void> {
    view = tab;
    await tick();
    new WorkflowTabs(tab).focus();
  }
  async function navigateTab(event: KeyboardEvent): Promise<void> {
    for (const tab of new WorkflowTabs(view).next(event.key)) {
      event.preventDefault();
      await selectTab(tab);
    }
  }
  $effect(() => {
    switch (view) {
      case WorkflowView.Log:
        new ChapterNavigation(selected).focus();
        break;
      case WorkflowView.Windows:
      case WorkflowView.Revisions:
        break;
    }
    new ChapterNavigation(selected).jump();
  });
</script>

<div class="page-heading">
  <div>
    <button class="back-link" onclick={back}
      ><ArrowLeft size={14} />Features</button
    >
    <h1>{new FeatureLook(summary).title()}</h1>
  </div>
  <PullRequests requests={summary.pull_requests} />
</div>
<div class="summary-bar">
  <span
    ><b>{workflow.chapters.length}</b> tasks
    <span class="summary-separator">·</span> <b>{look.events()}</b> recorded
    events <span class="summary-separator">·</span> <b>{look.roles().length}</b>
    roles</span
  ><span class="muted">{RecordedTime.ZONE_LABEL}</span>
</div>
<div class="workspace-layout">
  <nav class="agent-index" aria-label="Agent index">
    <h2 class="eyebrow">{WorkerTimeline.TEXT.title}</h2>
    {#each workers.rows() as row, index (row.look.key())}
      <details class="worker-index-group">
        <summary
          ><strong>{index + 1}. {row.look.title()}</strong><small
            title={row.look.detail()}
            aria-label={row.look.detail()}>{row.look.shortDetail()}</small
          ><span>{row.taskCount()}</span></summary
        >
        {#each row.chapters() as chapter (chapter.task.common.id)}
          <button
            class="task-link"
            class:selected={selected === chapter.task.common.id}
            onclick={() => jump(chapter.task.common.id)}
            ><span class="copy"
              ><strong>{chapter.task.common.id}</strong><small
                >{chapter.task.common.objective}</small
              ></span
            ><span class="count">{chapter.entries.length}</span></button
          >
        {/each}
      </details>
    {/each}
  </nav>
  <div class="content-panel">
    <div class="view-tabs" role="tablist" aria-label="Workflow view">
      {#each WorkflowTabs.VIEWS as tab (tab)}<button
          role="tab"
          id={WorkflowTabs.id(tab)}
          aria-controls="workflow-panel"
          tabindex={new WorkflowTabs(view).tabIndex(tab)}
          onkeydown={navigateTab}
          aria-selected={view === tab}
          onclick={() => selectTab(tab)}>{tab}</button
        >{/each}
    </div>
    <div
      id="workflow-panel"
      role="tabpanel"
      aria-labelledby={WorkflowTabs.id(view)}
      tabindex="0"
    >
      {#if view === WorkflowView.Log}<div class="feed">
          {#each chapters as chapter (chapter.task.common.id)}{@const item =
              new ChapterLook(chapter)}
            <section class="task-chapter" id={`task-${chapter.task.common.id}`}>
              <div class="chapter-heading">
                <span class="avatar">{item.mark()}</span>
                <div class="chapter-copy">
                  <div class="chapter-heading-line">
                    <h2 id={`heading-${chapter.task.common.id}`} tabindex="-1">
                      {item.agent()}
                    </h2>
                    <span
                      >{new RecordedTime(
                        chapter.task.common.created_at,
                      ).clock()}–{new RecordedTime(
                        chapter.task.common.last_update,
                      ).clock()}</span
                    >
                  </div>
                  <p>{chapter.task.common.objective}</p>
                </div>
                <span class="chapter-state"
                  >{new StatusLook(chapter.status).look().label}</span
                >
              </div>
              <p class="chapter-route">{item.reporting()}</p>
              <div class="window-events">
                {#each chapter.entries as entry (entry.revision)}<FeedCard
                    {entry}
                    task={chapter.task.common.id}
                  />{:else}<p class="empty">
                    No event history recorded.
                  </p>{/each}
              </div>
            </section>{/each}
        </div>
      {:else if view === WorkflowView.Revisions}<RevisionLog
          entries={workflow.revision_log}
          onselect={jump}
        />
      {:else if workflow.chapters.length}<Timeline
          {workflow}
          {selected}
          onselect={(task: string) => {
            selected = task;
            view = WorkflowView.Log;
            new ChapterNavigation(selected).jump();
          }}
        />{:else}<p class="empty">{WorkflowLook.EMPTY_TIMELINE}</p>{/if}
    </div>
  </div>
</div>

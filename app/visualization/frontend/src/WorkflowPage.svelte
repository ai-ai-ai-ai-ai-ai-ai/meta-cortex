<script lang="ts">
  import type {
    FeatureSummary,
    FeatureWorkflow,
    TaskChapter,
  } from "./contracts";
  import { ArrowLeft } from "@lucide/svelte";
  import {
    ChapterNavigation,
    FeatureLook,
    WorkflowLook,
    WorkflowView,
    ChapterLook,
    RecordedTime,
    Elapsed,
  } from "./observability";
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
  let first = $derived(
    Math.min(
      ...workflow.chapters.map((chapter) => chapter.task.common.created_at),
    ),
  );
  let last = $derived(
    Math.max(
      ...workflow.chapters.map((chapter) => chapter.task.common.last_update),
    ),
  );
  let span = $derived(Math.max(1, last - first));
  function jump(chapter: TaskChapter): void {
    selected = chapter.task.common.id;
    new ChapterNavigation(selected).jump();
  }
  $effect(() => {
    switch (view) {
      case WorkflowView.Log:
      case WorkflowView.Windows:
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
    <h2 class="eyebrow">Agents & tasks</h2>
    {#each workflow.chapters as chapter, index (chapter.task.common.id)}{@const item =
        new ChapterLook(chapter)}<button
        class="task-link"
        class:selected={selected === chapter.task.common.id}
        onclick={() => jump(chapter)}
        ><span class="avatar">{item.mark()}</span><span class="copy"
          ><strong>{index + 1}. {item.agent()}</strong><small
            >{chapter.task.common.id}</small
          ></span
        ><span class="count">{chapter.entries.length}</span></button
      >{/each}
  </nav>
  <div class="content-panel">
    <div class="view-tabs" role="tablist" aria-label="Workflow view">
      {#each Object.values(WorkflowView) as tab (tab)}<button
          role="tab"
          aria-selected={view === tab}
          onclick={() => (view = tab)}>{tab}</button
        >{/each}
    </div>
    {#if view === WorkflowView.Log}<div
        class="feed"
        role="tabpanel"
        aria-label="Log"
      >
        {#each workflow.chapters as chapter (chapter.task.common.id)}{@const item =
            new ChapterLook(chapter)}
          <section class="task-chapter" id={`task-${chapter.task.common.id}`}>
            <div class="chapter-heading">
              <span class="avatar">{item.mark()}</span>
              <div class="chapter-copy">
                <div class="chapter-heading-line">
                  <h2>{item.agent()}</h2>
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
                />{:else}<p class="empty">No event history recorded.</p>{/each}
            </div>
          </section>{/each}
      </div>
    {:else if workflow.chapters.length}<div
        class="execution-map"
        role="tabpanel"
        aria-label="Time windows"
      >
        <div class="window-map-heading">
          <div>
            <h2>Time windows</h2>
            <p>Recorded task activity, including parallel work.</p>
          </div>
          <span class="muted">{new Elapsed(last - first).label()}</span>
        </div>
        <div class="time-axis">
          <time>{new RecordedTime(first).clock()}</time><time
            >{new RecordedTime(first + span / 2).clock()}</time
          ><time>{new RecordedTime(last).clock()}</time>
        </div>
        {#each workflow.chapters as chapter (chapter.task.common.id)}<div
            class="duration-row"
            id={`task-${chapter.task.common.id}`}
            class:selected={selected === chapter.task.common.id}
          >
            <button
              class="duration-label"
              onclick={() => {
                selected = chapter.task.common.id;
                new ChapterNavigation(selected).jump();
                view = WorkflowView.Log;
              }}
              ><strong>{new ChapterLook(chapter).agent()}</strong><small
                >{chapter.task.common.id}</small
              ></button
            >
            <div class="duration-track">
              <button
                class="duration-bar"
                style:left={`${(100 * (chapter.task.common.created_at - first)) / span}%`}
                style:width={`${(100 * (chapter.task.common.last_update - chapter.task.common.created_at)) / span}%`}
                title={`${chapter.task.common.objective}: ${new RecordedTime(chapter.task.common.created_at).full()}–${new RecordedTime(chapter.task.common.last_update).full()}`}
                aria-label={`Read ${chapter.task.common.id} log`}
                onclick={() => {
                  selected = chapter.task.common.id;
                  new ChapterNavigation(selected).jump();
                  view = WorkflowView.Log;
                }}
              ></button>
            </div>
          </div>{/each}
        <p class="window-map-note">
          Each window runs from task creation to its last recorded update.
          Overlap shows concurrent task lifetimes; it does not measure
          uninterrupted agent execution. Select a window to read its log.
        </p>
      </div>{/if}
  </div>
</div>

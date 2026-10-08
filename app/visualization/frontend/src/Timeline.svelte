<script lang="ts">
  import type { FeatureWorkflow } from "./contracts";
  import {
    Elapsed,
    WorkflowOpeningKind,
    type WorkflowOpening,
  } from "./observability";
  import { TimelineScale, RecordedStateLook } from "./timeline";
  import StateMeanings from "./StateMeanings.svelte";
  import TimelineTaskCard from "./TimelineTaskCard.svelte";
  import { WorkerTimeline } from "./worker-timeline";
  interface Props {
    workflow: FeatureWorkflow;
    selected: WorkflowOpening;
    onselect: (task: string) => void;
  }
  let { workflow, selected, onselect }: Props = $props();
  let scale = $derived(new TimelineScale(workflow));
  let workers = $derived(new WorkerTimeline(workflow));
</script>

<div class="execution-map">
  <div class="window-map-heading">
    <div>
      <h2>{TimelineScale.TEXT.title}</h2>
      <p>{TimelineScale.TEXT.description}</p>
    </div>
    <span class="muted"
      >{new Elapsed(scale.last() - scale.first()).label()}</span
    >
  </div>
  <div
    class="timeline-scroll"
    role="region"
    aria-label={TimelineScale.TEXT.scrollRegion}
  >
    <div class="timeline-canvas">
      <div class="time-axis">
        {#each scale.ticks() as tick, index (index)}<time
            datetime={tick.iso()}
            style:left={scale.position(tick.at)}
            title={tick.full()}>{tick.clock()}</time
          >{/each}
      </div>
      {#each workers.rows() as row (row.look.key())}{@const lanes = row.lanes()}
        <div
          class="duration-row worker-row"
          id={row.look.key()}
          class:selected={row
            .chapters()
            .some(
              (chapter) =>
                selected.kind === WorkflowOpeningKind.Task &&
                chapter.task.common.id === selected.task,
            )}
        >
          <details class="worker-task-menu duration-label-group">
            <summary class="duration-label"
              ><strong>{row.look.title()}</strong><small
                title={row.look.detail()}
                aria-label={row.look.detail()}>{row.look.shortDetail()}</small
              ></summary
            >
            <div class="worker-task-options">
              {#each row.chapters() as chapter (chapter.task.common.id)}
                <button onclick={() => onselect(chapter.task.common.id)}
                  >{chapter.task.common.id}</button
                >
              {/each}
            </div>
          </details>
          <div
            class="worker-lanes"
            role="region"
            aria-label={row.laneLabel(lanes.length)}
            style:height={`${Math.max(36, Math.min(2, lanes.length) * 36)}px`}
          >
            {#each lanes as lane, index (index)}
              <div class="duration-track">
                {#each lane.pieces as piece (`${piece.window.task}-${piece.window.revision}`)}
                  <TimelineTaskCard {piece} {onselect} />
                {/each}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  <div class="timeline-legend" aria-label={TimelineScale.TEXT.legend}>
    {#each RecordedStateLook.LEGEND as tone (tone)}<span
        ><i class={`phase-swatch state-${tone}`} aria-hidden="true"
        ></i>{RecordedStateLook.LABELS[tone]}</span
      >{/each}
  </div>
  <StateMeanings meanings={workflow.state_meanings} />
  <p class="window-map-note">
    {TimelineScale.TEXT.note}
    {WorkerTimeline.TEXT.note}
  </p>
</div>

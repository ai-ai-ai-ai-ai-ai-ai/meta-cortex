<script lang="ts">
  import type { FeatureWorkflow, TaskChapter } from "./contracts";
  import {
    ActionLook,
    ChapterLook,
    RecordedTime,
    Elapsed,
  } from "./observability";
  import { TimelineScale, MilestoneLook } from "./timeline";
  interface Props {
    workflow: FeatureWorkflow;
    selected: string;
    onselect: (chapter: TaskChapter) => void;
  }
  let { workflow, selected, onselect }: Props = $props();
  let scale = $derived(new TimelineScale(workflow));
</script>

<div
  class="execution-map"
  role="tabpanel"
  aria-label={TimelineScale.TEXT.title}
>
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
      {#each workflow.chapters as chapter (chapter.task.common.id)}{@const row =
          scale.row(chapter)}
        <div
          class="duration-row"
          id={`task-${chapter.task.common.id}`}
          class:selected={selected === chapter.task.common.id}
        >
          <div class="duration-label-group">
            <button class="duration-label" onclick={() => onselect(chapter)}
              ><strong>{new ChapterLook(chapter).agent()}</strong><small
                >{chapter.task.common.id}</small
              ></button
            >
            <div class="task-bounds">
              <span
                >{TimelineScale.TEXT.created}
                <time
                  datetime={new RecordedTime(
                    chapter.task.common.created_at,
                  ).iso()}
                  >{new RecordedTime(
                    chapter.task.common.created_at,
                  ).clock()}</time
                ></span
              ><span>
                · {TimelineScale.TEXT.lastUpdate}
                <time
                  datetime={new RecordedTime(
                    chapter.task.common.last_update,
                  ).iso()}
                  >{new RecordedTime(
                    chapter.task.common.last_update,
                  ).clock()}</time
                ></span
              >
            </div>
          </div>
          <div class="duration-track" style:height={row.height}>
            <span
              class="duration-guide"
              aria-hidden="true"
              style:left={scale.position(chapter.task.common.created_at)}
              style:width={`${(100 * (chapter.task.common.last_update - chapter.task.common.created_at)) / Math.max(1, scale.last() - scale.first())}%`}
            ></span>
            {#each row.pieces as piece (piece.entry.revision)}{@const look =
                new MilestoneLook(piece.entry)}
              <button
                class={`timeline-piece milestone-${look.tone()}`}
                style:left={piece.left}
                style:width={piece.width}
                aria-label={`${look.label(chapter)} ${TimelineScale.TEXT.to} ${new RecordedTime(piece.end).full()}`}
                title={`${look.label(chapter)} ${TimelineScale.TEXT.to} ${new RecordedTime(piece.end).full()}`}
                onclick={() => onselect(chapter)}
              ></button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>
  <div class="timeline-legend" aria-label={TimelineScale.TEXT.legend}>
    {#each MilestoneLook.PHASES as kind (kind)}<span
        ><i
          class={`phase-swatch milestone-${MilestoneLook.TONES[kind]}`}
          aria-hidden="true"
        ></i>{ActionLook.LOOKS[kind].label}</span
      >{/each}
  </div>
  <p class="window-map-note">{TimelineScale.TEXT.note}</p>
</div>

<script lang="ts">
  import type { FeatureWorkflow, TaskChapter } from "./contracts";
  import { ChapterLook, Elapsed } from "./observability";
  import { TimelineScale, RecordedStateLook } from "./timeline";
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
      {#each scale.chapters() as chapter (chapter.task.common.id)}{@const row =
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
          </div>
          <div class="duration-track" style:height={row.height}>
            {#each row.pieces as piece (piece.entry.revision)}
              <button
                class={`timeline-piece state-${piece.look.tone()}`}
                class:endpoint={piece.entry.at === piece.end}
                style:left={piece.left}
                style:width={piece.width()}
                aria-label={piece.label(chapter)}
                title={piece.label(chapter)}
                onclick={() => onselect(chapter)}
                ><span>{piece.duration()}</span></button
              >
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
  <p class="window-map-note">{TimelineScale.TEXT.note}</p>
</div>

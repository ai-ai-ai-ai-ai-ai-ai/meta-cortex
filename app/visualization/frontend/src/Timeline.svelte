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
          <button class="duration-label" onclick={() => onselect(chapter)}
            ><strong>{new ChapterLook(chapter).agent()}</strong><small
              >{chapter.task.common.id}</small
            ></button
          >
          <div class="duration-detail">
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
              ><span
                >{TimelineScale.TEXT.lastUpdate}
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
            <div class="duration-track" style:min-height={row.height}>
              <button
                class="duration-bar"
                style:left={scale.position(chapter.task.common.created_at)}
                style:width={`${(100 * (chapter.task.common.last_update - chapter.task.common.created_at)) / Math.max(1, scale.last() - scale.first())}%`}
                aria-label={`${TimelineScale.TEXT.read} ${chapter.task.common.id} ${TimelineScale.TEXT.recordedLifetime}`}
                onclick={() => onselect(chapter)}
                ><span class="inline-task-bounds"
                  ><span
                    >{TimelineScale.TEXT.created}
                    <time
                      datetime={new RecordedTime(
                        chapter.task.common.created_at,
                      ).iso()}
                      >{new RecordedTime(
                        chapter.task.common.created_at,
                      ).clock()}</time
                    ></span
                  ><span
                    >{TimelineScale.TEXT.lastUpdate}
                    <time
                      datetime={new RecordedTime(
                        chapter.task.common.last_update,
                      ).iso()}
                      >{new RecordedTime(
                        chapter.task.common.last_update,
                      ).clock()}</time
                    ></span
                  ></span
                ></button
              >
              {#each row.markers as marker (marker.entry.revision)}{@const entry =
                  marker.entry}{@const look = new MilestoneLook(
                  entry,
                )}{@const Icon = new ActionLook(entry).icon()}
                <button
                  class={`timeline-milestone milestone-${look.tone()}`}
                  style:left={marker.left}
                  style:top={marker.top}
                  aria-label={look.label(chapter)}
                  title={look.label(chapter)}
                  onclick={() => onselect(chapter)}
                  ><Icon size={16} strokeWidth={2} /></button
                >
              {/each}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
  <div class="timeline-legend" aria-label={TimelineScale.TEXT.legend}>
    {#each Object.values(ActionLook.LOOKS) as appearance (appearance.kind)}{@const Icon =
        appearance.icon}<span data-type={appearance.kind}
        ><Icon size={16} strokeWidth={2} />{appearance.label}</span
      >{/each}
  </div>
  <p class="window-map-note">{TimelineScale.TEXT.note}</p>
</div>

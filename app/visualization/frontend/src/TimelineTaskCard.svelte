<script lang="ts">
  import { onDestroy } from "svelte";
  import type { TaskChapter } from "./contracts";
  import { TimelinePiece, StateTone } from "./timeline";
  import { TimelineHovercard } from "./timeline-hovercard";
  interface Props {
    piece: TimelinePiece;
    onselect: (chapter: TaskChapter) => void;
  }
  let { piece, onselect }: Props = $props();
  const id = $props.id();
  const card = new TimelineHovercard(id);
  onDestroy(() => card.keep());
</script>

<button
  id={`${id}-trigger`}
  class={`timeline-piece state-${piece.look.tone()}`}
  class:endpoint={piece.entry.at === piece.end}
  style:left={piece.left}
  style:width={piece.width()}
  aria-label={piece.label()}
  aria-describedby={id}
  onpointerenter={(event) => card.open(event.currentTarget)}
  onpointerleave={() => card.leave()}
  onfocus={(event) => card.open(event.currentTarget)}
  onblur={() => card.leave()}
  onclick={() => onselect(piece.chapter)}
  ><span>{piece.duration()}</span></button
>
<div
  {id}
  popover="auto"
  role="dialog"
  tabindex="-1"
  aria-label={piece.chapter.task.common.objective}
  class="timeline-task-card"
  onpointerenter={() => card.keep()}
  onpointerleave={() => card.leave()}
  onfocusin={() => card.keep()}
  onfocusout={() => card.leave()}
>
  <p class="task-card-objective">{piece.chapter.task.common.objective}</p>
  <p class="task-card-assignment">{piece.assignment()}</p>
  <p class="task-card-worker">{piece.worker()}</p>
  <p class={`task-card-state state-${piece.look.tone()}`}>
    {TimelinePiece.TEXT.recorded} · <strong>{piece.look.label()}</strong>
  </p>
  {#if piece.look.tone() === StateTone.Blocked}<p class="task-card-blocker">
      <strong>{TimelinePiece.TEXT.blocked}</strong>{piece.look.detail()}
    </p>{/if}
  <p class="task-card-summary">
    <span>{TimelinePiece.TEXT.progress}</span>{piece.summary()}
  </p>
  <footer>
    <time>{piece.times()}</time><button onclick={() => onselect(piece.chapter)}
      >{TimelinePiece.TEXT.open}</button
    >
  </footer>
</div>

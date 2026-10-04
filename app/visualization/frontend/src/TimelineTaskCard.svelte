<script lang="ts">
  import { onDestroy } from "svelte";
  import { TimelinePiece, StateTone } from "./timeline";
  import { TimelineHovercard } from "./timeline-hovercard";
  interface Props {
    piece: TimelinePiece;
    onselect: (task: string) => void;
  }
  let { piece, onselect }: Props = $props();
  const id = $props.id();
  const card = new TimelineHovercard(id);
  onDestroy(() => card.keep());
</script>

<button
  id={`${id}-trigger`}
  class={`timeline-piece state-${piece.look.tone()}`}
  class:endpoint={piece.window.start === piece.end}
  style:left={piece.left}
  style:width={piece.width()}
  aria-label={piece.label()}
  aria-describedby={id}
  onpointerenter={(event) => card.open(event.currentTarget)}
  onpointerleave={() => card.leave()}
  onfocus={(event) => card.open(event.currentTarget)}
  onblur={() => card.leave()}
  onclick={() => onselect(piece.window.task)}
  ><span>{piece.duration()}</span></button
>
<div
  {id}
  popover="auto"
  role="dialog"
  tabindex="-1"
  aria-label={piece.window.objective}
  class="timeline-task-card"
  onpointerenter={() => card.keep()}
  onpointerleave={() => card.leave()}
  onfocusin={() => card.keep()}
  onfocusout={() => card.leave()}
>
  <p class="task-card-objective">{piece.window.objective}</p>
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
    <dl class="task-card-times">
      <div>
        <dt>{TimelinePiece.TEXT.started}</dt>
        <dd><time>{piece.started()}</time></dd>
      </div>
      <div>
        <dt>{TimelinePiece.TEXT.ended}</dt>
        <dd><time>{piece.ended()}</time></dd>
      </div>
      <div>
        <dt>{TimelinePiece.TEXT.total}</dt>
        <dd>{piece.total()}</dd>
      </div>
    </dl>
    <button onclick={() => onselect(piece.window.task)}
      >{TimelinePiece.TEXT.open}</button
    >
  </footer>
</div>

<script lang="ts">
  import type { TipCard } from "./sky-stage.svelte";
  interface Props {
    card: TipCard;
    x: number;
    y: number;
  }
  let { card, x, y }: Props = $props();
</script>

<div class="sky-tip" role="tooltip" style:left={`${x}px`} style:top={`${y}px`}>
  <span class="sky-chip" style:--chip={card.tone}><i></i>{card.chip}</span>
  <h4>{card.title}</h4>
  {#if card.rows.length}
    <dl>
      {#each card.rows as [label, value] (label)}
        <dt>{label}</dt>
        <dd>{value}</dd>
      {/each}
    </dl>
  {/if}
  {#if card.action}<div class="sky-tip-action">{card.action}</div>{/if}
</div>

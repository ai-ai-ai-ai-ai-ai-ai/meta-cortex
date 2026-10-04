<script lang="ts">
  import type { StateMeaning } from "./contracts";
  import { TimelineScale, RecordedStateLook } from "./timeline";
  interface Props {
    meanings: ReadonlyArray<StateMeaning>;
  }
  let { meanings }: Props = $props();
</script>

<details class="state-meanings">
  <summary>{TimelineScale.TEXT.meanings}</summary>
  <table>
    <caption class="sr-only">{TimelineScale.TEXT.meanings}</caption>
    <thead>
      <tr>
        <th scope="col">{TimelineScale.TEXT.state}</th>
        <th scope="col">{TimelineScale.TEXT.meaning}</th>
        <th scope="col">{TimelineScale.TEXT.evidence}</th>
        <th scope="col">{TimelineScale.TEXT.nextStep}</th>
      </tr>
    </thead>
    <tbody>
      {#each meanings as meaning (meaning.state)}
        <tr>
          <th scope="row"
            ><i class={`phase-swatch state-${meaning.state}`} aria-hidden="true"
            ></i>{RecordedStateLook.LABELS[meaning.state]}</th
          >
          <td data-label={TimelineScale.TEXT.meaning}
            >{meaning.meaning}<small>{meaning.qualification}</small></td
          >
          <td data-label={TimelineScale.TEXT.evidence}>{meaning.evidence}</td>
          <td data-label={TimelineScale.TEXT.nextStep}>{meaning.next_step}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</details>

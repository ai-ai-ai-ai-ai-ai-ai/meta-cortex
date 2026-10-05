<script lang="ts">
  import type { RevisionLogEntry } from "./contracts";
  import FeedCard from "./FeedCard.svelte";
  import { RevisionLook } from "./revision-log";
  interface Props {
    entries: ReadonlyArray<RevisionLogEntry>;
    onselect: (task: string) => void;
  }
  let { entries, onselect }: Props = $props();
</script>

<div class="revision-log">
  <p class="window-map-note">{RevisionLook.TEXT.description}</p>
  {#each entries as record (record.sequence)}{@const look = new RevisionLook(
      record,
    )}
    <article class="revision-log-entry" aria-label={look.sequence()}>
      <div class="revision-log-heading">
        <strong>{look.sequence()}</strong><span>{look.provenance()}</span>
        <button onclick={() => onselect(record.task)}
          >{RevisionLook.TEXT.open}</button
        >
      </div>
      <p class="revision-objective">{record.entry.objective}</p>
      <FeedCard entry={record.entry} task={record.task} />
    </article>
  {:else}<p class="empty">{RevisionLook.TEXT.empty}</p>{/each}
</div>

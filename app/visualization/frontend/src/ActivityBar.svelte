<script lang="ts">
  import type { FeatureFlow } from "./contracts";
  import { FlowPresentation } from "./workflow";
  let { flow }: { flow: FeatureFlow } = $props();
  let presentation = $derived(new FlowPresentation(flow));
</script>

<footer
  class="activity-bar col-start-2 flex min-w-0 items-center gap-3 border-t border-border bg-tree px-[25px] text-[11px] text-activity max-[620px]:px-4"
>
  <svg
    class="activity-icon size-5 shrink-0 text-primary"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    aria-hidden="true"><path d="m2 13 4 0 3-9 4 16 3-10 2 3h4" /></svg
  >
  {#each presentation.activity().slice(0, 1) as item (item.event.revision)}
    <span
      class="activity-copy truncate [&_strong]:mr-2 [&_strong]:font-normal [&_strong]:text-foreground"
      title={`${item.event.note} · ${new Date(item.event.at).toLocaleString()}`}
      ><strong>Latest:</strong>
      {FlowPresentation.action(item.event)} · {item.event.actor.role}</span
    >
  {:else}<span
      class="activity-copy truncate [&_strong]:mr-2 [&_strong]:font-normal [&_strong]:text-foreground"
      >No activity recorded on this page.</span
    >{/each}
  <span
    class="read-only ml-auto flex items-center gap-2 whitespace-nowrap [&_svg]:size-4"
    title={`Observed ${new Date(flow.observed_at).toLocaleString()}`}
    ><svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      aria-hidden="true"
      ><rect x="6" y="10" width="12" height="11" rx="2" /><path
        d="M9 10V6a3 3 0 0 1 6 0v4m-3 5v2"
      /></svg
    >Read only</span
  >
</footer>

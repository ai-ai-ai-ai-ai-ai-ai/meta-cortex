<script lang="ts">
  import { cn } from "$lib/utils";
  import type { FlowState, CheckOutcome } from "./contracts";
  type RecordedStatus = FlowState | CheckOutcome;
  let {
    state,
    class: className = "",
  }: { state: RecordedStatus; class?: string } = $props();
</script>

<span
  class={cn(
    "state-mark size-[22px] before:text-base inline-grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground before:font-semibold before:content-['✓'] data-[state=working]:bg-working data-[state=working]:before:content-[''] data-[state=ready]:bg-ready data-[state=ready]:before:content-['→'] data-[state=queued]:border-2 data-[state=queued]:border-muted-foreground data-[state=queued]:bg-transparent data-[state=queued]:before:content-[''] data-[state=not_run]:border-2 data-[state=not_run]:border-muted-foreground data-[state=not_run]:bg-transparent data-[state=not_run]:before:content-[''] data-[state=cancelled]:border data-[state=cancelled]:border-cancelled data-[state=cancelled]:bg-transparent data-[state=cancelled]:text-cancelled data-[state=cancelled]:before:content-['×'] data-[state=blocked]:bg-blocked data-[state=blocked]:before:content-['!'] data-[state=failed]:bg-blocked data-[state=failed]:before:content-['!']",
    className,
  )}
  data-state={state}
  aria-hidden="true"
></span>

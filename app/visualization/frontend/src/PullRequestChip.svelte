<script lang="ts">
  import { Check, GitPullRequest } from "@lucide/svelte";
  import type { PullRequest } from "./contracts";
  interface Props {
    request: PullRequest;
  }
  let { request }: Props = $props();
  let copied = $state(false);
  function copy() {
    navigator.clipboard.writeText(request.url).then(
      () => {
        copied = true;
        setTimeout(() => (copied = false), 1500);
      },
      () => (copied = false),
    );
  }
</script>

<button
  type="button"
  onclick={copy}
  title={`${request.url} (click to copy)`}
  aria-label={`Copy link to pull request ${request.number} in ${request.repository}`}
  class="relative z-10 inline-flex shrink-0 items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
>
  {#if copied}
    <Check class="size-3 text-status-completed" aria-hidden="true" />Copied
  {:else}
    <GitPullRequest class="size-3" aria-hidden="true" />PR #{request.number}
  {/if}
</button>

<script lang="ts">
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { Effect } from "effect";
  import type { PullRequest } from "./contracts";
  interface Props {
    requests: ReadonlyArray<PullRequest>;
  }
  let failures = $state<ReadonlyArray<string>>([]);
  function open(request: PullRequest): void {
    const opening = Effect.tryPromise(() => openUrl(request.url)).pipe(
      Effect.match({
        onFailure: () => {
          failures = [
            "Could not open the PR. Copy its link to open it in your browser.",
          ];
        },
        onSuccess: () => {
          failures = [];
        },
      }),
    );
    Effect.runCallback(opening);
  }
  let { requests }: Props = $props();
</script>

<span class="feature-prs"
  >{#each requests as request (request.url)}<a
      onclick={(event) => {
        event.preventDefault();
        open(request);
      }}
      href={request.url}
      target="_blank"
      rel="noreferrer"
      title={request.repository}
      aria-label={`Open pull request ${request.number}`}>PR #{request.number}</a
    >{:else}<span class="muted" title="No explicit PR reference stored in Turso"
      >PR —</span
    >{/each}</span
>

{#each failures as failure (failure)}<span role="alert">{failure}</span>{/each}

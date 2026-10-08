<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { ArrowRight } from "@lucide/svelte";
  import type { RepositoryCard, PageEnd } from "./contracts";
  interface Props {
    repositories: ReadonlyArray<RepositoryCard>;
    end: PageEnd;
    select: (card: RepositoryCard) => void;
    refresh: () => void;
  }
  let { repositories, end, select, refresh }: Props = $props();
</script>

<div class="page-heading">
  <div>
    <h1>Repositories</h1>
    <p>Browse recorded work across repositories.</p>
  </div>
</div>
{#if end === "More"}<p class="notice">
    More repositories are available than this page can show.
  </p>{/if}
{#if repositories.length}
  <div class="repository-list" role="group" aria-label="Choose a repository">
    {#each repositories as card (card.repository.repository_id)}
      <button
        class="repository-row"
        id={`repository-${card.repository.repository_id}`}
        onclick={() => select(card)}
        aria-label={`Open ${card.repository.name}, ${card.repository.repository_id}`}
      >
        <span class="repository-identity"
          ><strong>{card.repository.name}</strong><code
            >{card.repository.repository_id}</code
          ></span
        >
        <span class="repository-count"
          >{card.feature_count} recorded features</span
        ><ArrowRight size={16} aria-hidden="true" />
      </button>
    {/each}
  </div>
{:else}
  <div class="empty">
    <h2>No repositories recorded yet</h2>
    <p>
      Repositories appear here when feature work is recorded. Refresh to check
      for new work.
    </p>
    <Button variant="outline" class="min-h-[44px]" onclick={refresh}
      >Refresh repositories</Button
    >
  </div>
{/if}

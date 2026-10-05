<script lang="ts">
  import type { GuideDocument } from "./contracts";
  import { GuideMarkdown } from "./guide-markdown";
  import "./guide-markdown.css";
  interface Props {
    source: GuideDocument;
    documents: ReadonlyArray<GuideDocument>;
  }
  let { source, documents }: Props = $props();
  let path = $state("");
  let notice = $state("");
  let current = $derived(
    documents.find((entry) => entry.path === path) ?? source,
  );
  let reader = $derived(new GuideMarkdown(documents, select, report));
  function select(next: string): void {
    path = next;
  }
  function report(message: string): void {
    notice = message;
  }
</script>

<div class="guide-document-reader">
  <p class="guide-document-path">{current.path}</p>
  {#if current.path !== source.path}
    <button class="guide-document-back" onclick={() => select(source.path)}
      >Back to agent document</button
    >
  {/if}
  {#if notice}
    <p class="guide-document-notice" role="status">{notice}</p>
  {/if}
  <div class="guide-markdown" tabindex="-1" use:reader.mount={current}></div>
</div>

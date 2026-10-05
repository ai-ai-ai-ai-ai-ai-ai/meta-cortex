<script lang="ts">
  import {
    ReaderNoticeKind,
    type ReaderNotice,
    type GuideDocument,
    type GuideDocumentPath,
    type GuideSourceBase,
  } from "./guide-content";
  import { untrack } from "svelte";
  import { GuideMarkdown, type ReaderOptions } from "./guide-markdown";
  import "./guide-markdown.css";
  interface Props {
    source: GuideDocument;
    documents: ReadonlyArray<GuideDocument>;
    sourceBase: GuideSourceBase;
  }
  let { source, documents, sourceBase }: Props = $props();
  let path = $state(untrack(() => source.path));
  let notice = $state<ReaderNotice>({ kind: ReaderNoticeKind.Quiet });
  let current = $derived(documents.filter((entry) => entry.path === path));
  let readerOptions = $derived<ReaderOptions>({
    documents,
    sourceBase,
    select,
    notice: report,
  });
  let reader = $derived(new GuideMarkdown(readerOptions));
  function select(next: GuideDocumentPath): void {
    path = next;
  }
  function report(next: ReaderNotice): void {
    notice = next;
  }
</script>

<div class="guide-document-reader">
  {#each current as document, index (index)}
    <p class="guide-document-path">{document.path}</p>
    {#if document.path !== source.path}
      <button class="guide-document-back" onclick={() => select(source.path)}
        >Back to agent document</button
      >
    {/if}
    {#if notice.kind === ReaderNoticeKind.Reported}<p
        class="guide-document-notice"
        role="status"
      >
        {notice.message}
      </p>{/if}
    <div class="guide-markdown" tabindex="-1" use:reader.mount={document}></div>
  {/each}
</div>

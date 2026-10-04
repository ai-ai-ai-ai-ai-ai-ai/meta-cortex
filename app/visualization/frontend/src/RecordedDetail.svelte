<script lang="ts">
  import {
    ChevronRight,
    FileText,
    ClipboardCheck,
    GitPullRequest,
    MessageSquare,
    FilePenLine,
  } from "@lucide/svelte";
  import { Disclosure, type EvidenceBlock } from "./observability";
  interface Props {
    block: EvidenceBlock;
  }
  let { block }: Props = $props();
  let disclosure = $state(Disclosure.Closed);
  let label = $derived(block.key.replace(/[_-]/g, " "));
  function toggle(event: Event): void {
    const target = event.currentTarget as HTMLDetailsElement;
    switch (target.open) {
      case true:
        disclosure = Disclosure.Open;
        return;
      case false:
        disclosure = Disclosure.Closed;
    }
  }
</script>

<details class="evidence recorded-detail" ontoggle={toggle}>
  <summary>
    {#if /verif|review|report/.test(block.key)}<ClipboardCheck
        size={15}
      />{:else if /pr|publication|publish/.test(block.key)}<GitPullRequest
        size={15}
      />{:else if /message|communication|reports_to/.test(block.key)}<MessageSquare
        size={15}
      />{:else if /file|edit|diff/.test(block.key)}<FilePenLine
        size={15}
      />{:else}<FileText size={15} />{/if}
    <strong>{label}</strong><ChevronRight size={12} /></summary
  >{#if disclosure === Disclosure.Open}<div class="evidence-body">
      <pre>{block.text}</pre>
    </div>{/if}
</details>

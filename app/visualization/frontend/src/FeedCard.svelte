<script lang="ts">
  import type { FeedEntry } from "./contracts";
  import {
    ChevronRight,
    Terminal,
    GitCommitHorizontal,
    ListChecks,
    ArrowRight,
    FileText,
  } from "@lucide/svelte";
  import { ActionLook, RecordedTime, EvidenceLook } from "./observability";
  import RecordedDetail from "./RecordedDetail.svelte";
  import { AgentLook } from "./presentation";
  interface Props {
    entry: FeedEntry;
    task: string;
  }
  let { entry, task }: Props = $props();
  let look = $derived(new ActionLook(entry));
  let Icon = $derived(look.icon());
</script>

<div class="window-event" data-type={entry.kind}>
  <span class="window-dot" aria-hidden="true"></span>
  <details class="event">
    <summary
      ><span class="event-icon"
        ><Icon size={16} strokeWidth={2} aria-hidden="true" /></span
      >
      <div class="event-copy">
        <div class="kind-line">
          <strong>{look.label()}</strong><span
            >{ActionLook.TEXT.recordedBy}
            {new AgentLook(entry.actor).name()}</span
          >
        </div>
        <div class="event-provenance">
          <span>{ActionLook.TEXT.task} <code>{task}</code></span><span
            >{ActionLook.TEXT.assignedTo} {look.recipient()}</span
          ><span>{ActionLook.TEXT.reportsTo} {look.reporting()}</span>
        </div>
        <div class="action-meta">
          <time
            datetime={new RecordedTime(entry.at).iso()}
            title={new RecordedTime(entry.at).full()}
            >{new RecordedTime(entry.at).clock()}</time
          ><span>· r{entry.revision}</span>
        </div>
        <p class="event-title">{entry.note}</p>
        <div class="child-tags">
          {#each entry.evidence as evidence, index (index)}{#if evidence.checks.length}<span
                ><Terminal size={11} />{evidence.checks.length} checks</span
              >{/if}{#if evidence.findings.length}<span
                ><ListChecks size={11} />{evidence.findings.length} findings</span
              >{/if}{#if evidence.next_steps.length}<span
                ><ArrowRight size={11} />{evidence.next_steps.length} next steps</span
              >{/if}{#if new EvidenceLook(evidence).blocks().length}<span
                ><FileText size={11} />Recorded details</span
              >{/if}{/each}
        </div>
      </div>
      <ChevronRight class="chevron" size={12} /></summary
    >
    <div class="event-body">
      {#if entry.checkpoint.kind === "git"}<div class="checkpoint">
          <GitCommitHorizontal size={15} /><span
            >Git checkpoint <code>{entry.checkpoint.commit}</code></span
          >
        </div>{/if}
      {#each entry.evidence as evidence, index (index)}
        {#if evidence.summary && evidence.summary !== entry.note}<p
            class="event-note"
          >
            {evidence.summary}
          </p>{/if}
        {#each evidence.checks as check, index (index)}<details
            class="evidence command"
          >
            <summary
              ><Terminal size={15} /><span class="evidence-title"
                ><strong>Shell command · recorded check</strong><code
                  >{check.command}</code
                ></span
              ><span class={`result ${check.outcome}`}
                >{check.outcome.replace("_", " ")}</span
              ><ChevronRight size={12} /></summary
            >
            <div class="evidence-body"><pre>{check.evidence}</pre></div>
          </details>{/each}
        {#if evidence.findings.length}<details class="evidence findings">
            <summary
              ><ListChecks size={15} /><strong
                >Findings · {evidence.findings.length}</strong
              ><ChevronRight size={12} /></summary
            >
            <ul class="evidence-body">
              {#each evidence.findings as finding, index (index)}<li>
                  {finding}
                </li>{/each}
            </ul>
          </details>{/if}
        {#if evidence.next_steps.length}<details class="evidence next">
            <summary
              ><ArrowRight size={15} /><strong
                >Next steps · {evidence.next_steps.length}</strong
              ><ChevronRight size={12} /></summary
            >
            <ul class="evidence-body">
              {#each evidence.next_steps as step, index (index)}<li>
                  {step}
                </li>{/each}
            </ul>
          </details>{/if}
        {#each new EvidenceLook(evidence).blocks() as block (block.key)}<RecordedDetail
            {block}
          />{/each}
      {/each}
    </div>
  </details>
</div>

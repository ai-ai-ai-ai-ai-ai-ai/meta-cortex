<script lang="ts">
  import type { FeatureLogEntry, StateMeaning } from "./contracts";
  import type { EvidenceSelection } from "./feature-log";
  import { ChevronRight } from "@lucide/svelte";
  import { RecordedTime } from "./observability";
  import { AgentLook } from "./presentation";
  import StateMeanings from "./StateMeanings.svelte";

  interface Props {
    entries: ReadonlyArray<FeatureLogEntry>;
    integrationMeaning: StateMeaning;
    onselect: (task: string) => void;
    onevidence: (selection: EvidenceSelection) => void;
  }
  let { entries, integrationMeaning, onselect, onevidence }: Props = $props();
</script>

<section class="feature-log" aria-label="Feature log">
  <div class="log-context">
    <p>
      Implementation milestones with recorded checkpoint and integration
      evidence.
    </p>
  </div>
  <div class="log-entries">
    {#each entries as entry (`${entry.task}:${entry.id}`)}
      <article class="log-entry">
        <h2 class="outcome-summary">{entry.summary}</h2>
        <div class="outcome-meta">
          <span
            >Integrated <time
              datetime={new RecordedTime(entry.integration.recorded.at).iso()}
              title={new RecordedTime(entry.integration.recorded.at).full()}
              >{new RecordedTime(entry.integration.recorded.at).card()}</time
            ></span
          >
          <span
            >Recorded by {new AgentLook(
              entry.checkpoint.recorded.actor,
            ).name()}</span
          >
          <span
            >Checkpoint <button
              class="checkpoint-reference"
              title={entry.checkpoint.commit}
              aria-label={`Open checkpoint evidence for task ${entry.task}, revision ${entry.checkpoint.recorded.revision}`}
              onclick={() => {
                const selection: EvidenceSelection = {
                  task: entry.task,
                  revision: entry.checkpoint.recorded.revision,
                };
                onevidence(selection);
              }}><code>{entry.checkpoint.commit.slice(0, 8)}</code></button
            ></span
          >
        </div>
        <div class="outcome-task">
          <span>Task <code>{entry.task}</code></span>
          <button
            class="task-log"
            aria-label={`Open Log for task ${entry.task}`}
            onclick={() => onselect(entry.task)}>Log</button
          >
        </div>
        <details class="outcome-evidence">
          <summary
            ><ChevronRight size={13} aria-hidden="true" /><span>Evidence</span
            ></summary
          >
          <div class="evidence-content">
            <p class="outcome-detail">{entry.detail}</p>
            <dl class="evidence-fields">
              <div>
                <dt>Milestone ID</dt>
                <dd><code>{entry.id}</code></dd>
              </div>
              <div>
                <dt>First milestone recorded</dt>
                <dd>
                  <time
                    datetime={new RecordedTime(entry.first_recorded.at).iso()}
                    >{new RecordedTime(entry.first_recorded.at).full()}</time
                  >
                  · {RecordedTime.ZONE_LABEL}<small
                    >Recorded by {new AgentLook(
                      entry.first_recorded.actor,
                    ).name()} · Task r{entry.first_recorded.revision} · R{entry
                      .first_recorded.sequence} · {entry.first_recorded
                      .provenance}</small
                  >
                </dd>
              </div>
              <div>
                <dt>Checkpoint</dt>
                <dd>
                  <code>{entry.checkpoint.commit}</code><button
                    class="evidence-link"
                    onclick={() => {
                      const selection: EvidenceSelection = {
                        task: entry.task,
                        revision: entry.checkpoint.recorded.revision,
                      };
                      onevidence(selection);
                    }}
                    >Checkpoint evidence · r{entry.checkpoint.recorded
                      .revision}</button
                  >
                </dd>
              </div>
              <div>
                <dt>Checkpoint recorded</dt>
                <dd>
                  <time
                    datetime={new RecordedTime(
                      entry.checkpoint.recorded.at,
                    ).iso()}
                    >{new RecordedTime(
                      entry.checkpoint.recorded.at,
                    ).full()}</time
                  >
                  · {RecordedTime.ZONE_LABEL}<small
                    >Recorded by {new AgentLook(
                      entry.checkpoint.recorded.actor,
                    ).name()} · Task r{entry.checkpoint.recorded.revision} · R{entry
                      .checkpoint.recorded.sequence} · {entry.checkpoint
                      .recorded.provenance}</small
                  >
                </dd>
              </div>
              <div>
                <dt>Integration commit</dt>
                <dd>
                  <code>{entry.integration.commit}</code><button
                    class="evidence-link"
                    onclick={() => {
                      const selection: EvidenceSelection = {
                        task: entry.task,
                        revision: entry.integration.recorded.revision,
                      };
                      onevidence(selection);
                    }}
                    >Integration evidence · r{entry.integration.recorded
                      .revision}</button
                  >
                </dd>
              </div>
              <div>
                <dt>Integration recorded</dt>
                <dd>
                  <time
                    datetime={new RecordedTime(
                      entry.integration.recorded.at,
                    ).iso()}
                    >{new RecordedTime(
                      entry.integration.recorded.at,
                    ).full()}</time
                  >
                  · {RecordedTime.ZONE_LABEL}<small
                    >Recorded by {new AgentLook(
                      entry.integration.recorded.actor,
                    ).name()} · Task r{entry.integration.recorded.revision} · R{entry
                      .integration.recorded.sequence} · {entry.integration
                      .recorded.provenance}</small
                  >
                </dd>
              </div>
            </dl>
            <p class="evidence-note">
              Actors identify who recorded evidence; Git authorship is
              unrecorded.
            </p>
            <div class="state-qualification">
              <StateMeanings meanings={[integrationMeaning]} />
            </div>
          </div>
        </details>
      </article>
    {:else}
      <div class="log-empty">
        <h2>No implementation outcomes recorded</h2>
        <p>
          Historical tasks may have checkpoints without recorded implementation
          milestones. Open a task's Log to inspect its recorded evidence.
        </p>
      </div>
    {/each}
  </div>
</section>

<style>
  .feature-log,
  .log-entries {
    min-width: 0;
  }
  .log-context {
    margin-bottom: 16px;
    color: var(--accent);
    font-size: 12px;
    line-height: 1.6;
  }
  .log-entry {
    border-top: 1px solid var(--line);
    padding: 16px 0 8px;
  }
  .outcome-summary {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .outcome-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px 18px;
    margin-top: 6px;
    color: var(--accent);
    font-size: 11px;
    line-height: 1.7;
  }
  .outcome-meta span {
    overflow-wrap: anywhere;
  }
  .outcome-task {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: var(--accent);
    font-size: 11px;
  }
  .outcome-task span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .task-log,
  .checkpoint-reference,
  .evidence-link {
    flex-shrink: 0;
    min-width: 44px;
    min-height: 44px;
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: transparent;
    padding: 8px;
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
    white-space: nowrap;
  }
  .task-log:hover,
  .task-log:active,
  .checkpoint-reference:hover,
  .checkpoint-reference:active,
  .evidence-link:hover,
  .evidence-link:active,
  .outcome-evidence summary:hover,
  .outcome-evidence summary:active {
    background: var(--subtle);
  }
  .task-log:focus-visible,
  .checkpoint-reference:focus-visible,
  .evidence-link:focus-visible,
  .outcome-evidence summary:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }
  .outcome-evidence summary {
    display: flex;
    align-items: center;
    gap: 6px;
    width: fit-content;
    min-width: 44px;
    min-height: 44px;
    border-radius: var(--radius);
    padding: 8px;
    color: var(--ink);
    font-size: 11px;
  }
  .outcome-evidence[open] summary :global(svg) {
    transform: rotate(90deg);
  }
  .evidence-content {
    border-left: 2px solid var(--line);
    margin: 4px 0 12px 8px;
    padding: 4px 0 4px 16px;
    font-size: 12px;
    line-height: 1.6;
  }
  .outcome-detail {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .evidence-fields {
    display: grid;
    gap: 12px;
    margin: 16px 0;
  }
  .evidence-fields div {
    display: grid;
    grid-template-columns: 155px minmax(0, 1fr);
    gap: 4px 16px;
  }
  .evidence-fields dt {
    color: var(--accent);
  }
  .evidence-fields dd {
    min-width: 0;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .evidence-fields small {
    display: block;
    margin-top: 2px;
    color: var(--accent);
    font-size: 11px;
  }
  .evidence-note {
    color: var(--accent);
    font-size: 11px;
  }
  .state-qualification {
    margin-top: 16px;
  }
  .state-qualification :global(summary) {
    display: flex;
    align-items: center;
    min-height: 44px;
  }
  .state-qualification :global(small) {
    color: var(--accent);
  }
  .evidence-link {
    display: block;
    padding-left: 0;
    text-align: left;
  }
  .checkpoint-reference {
    padding: 4px;
  }
  .log-empty {
    border-top: 1px solid var(--line);
    padding: 28px 0;
  }
  .log-empty h2 {
    font-size: 14px;
    font-weight: 600;
  }
  .log-empty p {
    max-width: 60ch;
    margin-top: 8px;
    color: var(--accent);
    font-size: 12px;
    line-height: 1.6;
  }
  @media (max-width: 600px) {
    .evidence-fields div {
      grid-template-columns: minmax(0, 1fr);
    }
    .outcome-meta {
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
    }
    .evidence-content {
      padding-left: 12px;
    }
  }
</style>

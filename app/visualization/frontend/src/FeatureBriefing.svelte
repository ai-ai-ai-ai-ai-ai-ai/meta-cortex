<script lang="ts">
  import type { FeatureSummary, FeatureWorkflow } from "./contracts";
  import { ArrowRight, GitBranch } from "@lucide/svelte";
  import {
    FeatureLook,
    WorkflowLook,
    RecordedTime,
    ChapterLook,
    ActionLook,
  } from "./observability";
  import { AgentLook } from "./presentation";
  import PullRequests from "./PullRequests.svelte";
  interface Props {
    summary: FeatureSummary;
    workflow: FeatureWorkflow;
    open: (task: string) => void;
  }
  let { summary, workflow, open }: Props = $props();
  let feature = $derived(new FeatureLook(summary));
  let look = $derived(new WorkflowLook(workflow));
</script>

<article class="feature-preview" aria-label="Selected feature">
  <div class="preview-heading">
    <div class="briefing-heading-label">
      <span class="eyebrow">Feature briefing</span><PullRequests
        requests={summary.pull_requests}
      />
    </div>
    <span class="pill">{feature.label()}</span>
  </div>
  <h2>{feature.title()}</h2>
  <p class="objective">{summary.feature.objective}</p>
  <dl class="briefing-dates">
    <div>
      <dt>Started <small>{RecordedTime.ZONE_LABEL}</small></dt>
      <dd>
        {#each look.started() as at (at)}<time
            datetime={new RecordedTime(at).iso()}
            >{new RecordedTime(at).full()}</time
          >{:else}No tasks yet{/each}
      </dd>
    </div>
    <div>
      <dt>Finished <small>{RecordedTime.ZONE_LABEL}</small></dt>
      <dd>
        {#each look.finished() as at (at)}<time
            datetime={new RecordedTime(at).iso()}
            >{new RecordedTime(at).full()}</time
          >{:else}<span class="muted">Not finished</span>{/each}
      </dd>
    </div>
    <div>
      <dt>Duration</dt>
      <dd>{look.duration()}</dd>
    </div>
  </dl>
  <div class="briefing-grid">
    <section>
      <h3 class="eyebrow">Task inventory</h3>
      <div class="inventory-number">
        {summary.totals.completion.total}<span>recorded tasks</span>
      </div>
      <div class="task-blocks">
        {#each look.inventory() as chapter (chapter.task.common.id)}<button
            class={`task-block ${new ChapterLook(chapter).block()}`}
            onclick={() => open(chapter.task.common.id)}
            title={`${new ChapterLook(chapter).agent()}: ${chapter.task.common.objective}`}
            aria-label={`Open task ${chapter.task.common.id}`}
          ></button>{/each}
      </div>
      <p class="inventory-note">
        {summary.totals.completion.finished} finished · {feature.open()} open · {summary
          .totals.completion.cancelled} cancelled
      </p>
      <p class="inventory-note">Each block represents one task.</p>
    </section>
    <section>
      <h3 class="eyebrow">Latest recorded update</h3>
      {#each look.latest() as entry (entry.at)}<blockquote>
          <p>
            {#if entry.summary}{entry.summary}{:else}{entry.note}{/if}
          </p>
          <footer>
            {new AgentLook(entry.actor).name()} · {new RecordedTime(
              entry.at,
            ).clock()}<span>{new ActionLook(entry).label()}</span>
          </footer>
        </blockquote>{:else}<p class="muted">
          No activity recorded yet.
        </p>{/each}
    </section>
  </div>
  <div class="role-summary">
    <span class="eyebrow">{summary.actors.length} task roles</span>
    <p>
      {summary.actors.map((actor) => new AgentLook(actor).name()).join(" · ")}
    </p>
  </div>
  <footer class="briefing-footer">
    <span class="branch"
      ><GitBranch size={14} /><code>{summary.feature.branch}</code></span
    ><button class="primary-link" onclick={() => open("")}
      >Open workflow<ArrowRight size={16} /></button
    >
  </footer>
</article>

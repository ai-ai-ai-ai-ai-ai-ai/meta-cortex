<script lang="ts">
  import type { Task } from "./contracts";
  import { TaskPresentation } from "./task-presentation";
  let {
    task,
    back,
    history,
  }: { task: Task; back: () => void; history: () => void } = $props();
  let presentation = $derived(new TaskPresentation(task));
</script>

<section class="task-detail">
  <div class="detail-toolbar">
    <button class="button" onclick={back}>← Workflow</button><button
      class="button"
      onclick={history}>History & attempts</button
    >
  </div>
  <div class="detail-title">
    <div>
      <span class="eyebrow">TASK · ATTEMPT {task.attempt}</span>
      <h2>{task.id}</h2>
      <p>{task.objective}</p>
    </div>
    <span class="status" data-state={presentation.status()}
      >{presentation.status()}</span
    >
  </div>
  <div class="detail-grid">
    <section class="detail-card">
      <h3>Latest contribution</h3>
      <p class="progress-summary">{task.progress.summary}</p>
      {#if presentation.reason()}<p class="block-reason">
          {presentation.reason()}
        </p>{/if}
      <h4>Findings</h4>
      {#each task.progress.findings as finding, index (index)}<p
          class="finding"
        >
          {finding}
        </p>{/each}
      <h4>Next steps</h4>
      {#each task.progress.next_steps as step, index (index)}<p class="finding">
          {step}
        </p>{/each}
    </section>
    <section class="detail-card">
      <h3>Git evidence</h3>
      <dl>
        <dt>Workspace</dt>
        <dd class="workspace">{presentation.workspace()}</dd>
        <dt>Checkpoint</dt>
        <dd><code>{presentation.checkpoint()}</code></dd>
        <dt>Integration</dt>
        <dd><code>{presentation.integration()}</code></dd>
        <dt>Updated</dt>
        <dd>{new Date(task.last_update).toLocaleString()}</dd>
      </dl>
      <p class="muted">
        Actors recording commits are available in history. Git authorship is not
        recorded.
      </p>
    </section>
    <section class="detail-card">
      <h3>Checks <span>{task.progress.checks.length}</span></h3>
      {#each task.progress.checks as check, index (index)}<details
          class="check"
        >
          <summary
            ><span class="status" data-state={check.outcome}
              >{check.outcome}</span
            ><code>{check.command}</code></summary
          >
          <pre>{check.evidence}</pre>
        </details>{/each}
    </section>
    <section class="detail-card">
      <h3>Acceptance & dependencies</h3>
      {#each task.acceptance as criterion, index (index)}<p class="finding">
          {criterion}
        </p>{/each}
      <div class="dependency-list">
        {#each task.dependencies as dependency (dependency)}<code
            >{dependency}</code
          >{/each}
      </div>
    </section>
  </div>
  <details class="recorded-snapshot">
    <summary>All recorded fields</summary>
    <pre>{JSON.stringify(task, null, 2)}</pre>
  </details>
</section>

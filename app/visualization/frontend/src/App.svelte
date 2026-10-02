<script lang="ts">
  import type { Task } from "./contracts";
  import { onMount } from "svelte";
  import { DashboardController, LoadKind } from "./dashboard-state.svelte";
  import { DashboardApi } from "./api";
  import Workflow from "./Workflow.svelte";
  import TaskDetail from "./TaskDetail.svelte";
  import { FlowPresentation } from "./workflow";
  import ActivityBar from "./ActivityBar.svelte";
  const dashboard = new DashboardController(new DashboardApi());
  onMount(() => {
    dashboard.load({ kind: "Initial" });
    return () => dashboard.stop();
  });
</script>

<div class="app-shell">
  <aside class="sidebar">
    <button
      class="brand"
      onclick={() => dashboard.load({ kind: "Features", page: 0 })}
      ><span class="brand-mark"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          aria-hidden="true"
          ><path
            d="M12 2 22 8v8l-10 6-10-6V8zM2 8l10 6 10-6M12 14v8M7 5l10 6v8M17 5 7 11v8"
          /></svg
        ></span
      >
      <div>Meta-Cortex<small>Workbench</small></div></button
    >
    <div class="sidebar-label">
      Features <span>{dashboard.features.length}</span>
    </div>
    <nav aria-label="Features">
      {#each dashboard.features as feature (feature.id)}<button
          class:selected={dashboard.currentFeature() === feature.id}
          aria-label={feature.id}
          title={feature.id}
          onclick={() => dashboard.feature(feature)}
          ><svg
            class="feature-dot"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"><path d="M3 5h7l2 3h9v11H3z" /></svg
          ><strong>{FlowPresentation.label(feature.id)}</strong><span
            class="feature-short"
            aria-hidden="true">{feature.id.slice(0, 2)}</span
          ></button
        >{/each}
    </nav>
    <div class="sidebar-note">
      Recorded in Turso<small>Read only · refresh to observe changes</small>
    </div>
  </aside>
  <main>
    {#if dashboard.state.kind !== LoadKind.Ready || dashboard.state.reply.content.kind !== "Workflow"}<header
        class="app-header"
      >
        <div>
          <h1>
            {FlowPresentation.label(dashboard.currentFeature()) || "Workbench"}
          </h1>
          <p class="header-subtitle">Recorded work · Turso</p>
        </div>
        <button
          class="button"
          onclick={() => dashboard.load(dashboard.state.request)}
          >Refresh</button
        >
      </header>{/if}
    {#if dashboard.state.kind === LoadKind.Loading}<div class="empty-state">
        <span class="loading-dot"></span>
        <h2>Reading recorded work…</h2>
      </div>
    {:else if dashboard.state.kind === LoadKind.Failed}<div class="empty-state">
        <h2>Unable to read the ledger</h2>
        <p>{dashboard.state.failure.message}</p>
        <button
          class="button"
          onclick={() => dashboard.load(dashboard.state.request)}>Retry</button
        >
      </div>
    {:else if dashboard.state.kind === LoadKind.Ready}
      {#key JSON.stringify(dashboard.state.reply.selection)}
        {@const reply = dashboard.state.reply}
        {#if reply.content.kind === "Features"}
          <section class="feature-catalog">
            <div class="section-heading">
              <h2>Choose a feature</h2>
              <p>
                Explore its agents, task dependencies, and recorded Git
                integrations.
              </p>
            </div>
            <div class="feature-grid">
              {#each reply.content.value.records as feature (feature.id)}<button
                  onclick={() => dashboard.feature(feature)}
                  ><span class="eyebrow">FEATURE</span>
                  <h3>{feature.id}</h3>
                  <p>{feature.objective}</p>
                  <code>{feature.branch}</code><span class="open-feature"
                    >Open workflow →</span
                  ></button
                >{/each}
            </div>
          </section>
        {:else if reply.content.kind === "Workflow"}
          <Workflow
            flow={reply.content.value}
            select={(task: Task) => dashboard.task(task)}
            history={(task: Task) => dashboard.history(task)}
            refresh={() => dashboard.load(dashboard.state.request)}
          />
        {:else if reply.content.kind === "Task"}
          {@const task = reply.content.value}
          <TaskDetail
            {task}
            back={() =>
              dashboard.load({
                kind: "Workflow",
                feature: task.feature,
                page: 0,
              })}
            history={() =>
              dashboard.load({
                kind: "History",
                query: { feature: task.feature, task: task.id },
                page: 0,
              })}
          />
        {:else if reply.content.kind === "History"}
          <section class="task-detail">
            <button
              class="button"
              onclick={() =>
                dashboard.load({
                  kind: "Task",
                  query: dashboard.historyQuery(reply),
                })}>← Task</button
            >
            <h2>Recorded history</h2>
            <div class="history-feed">
              {#each reply.content.value.records as event (event.task.revision)}<article
                >
                  <span class="status">{event.kind}</span>
                  <div>
                    <h3>{event.actor.team} / {event.actor.role}</h3>
                    <p>{event.note}</p>
                    <small
                      >Attempt {event.task.attempt} · revision {event.task
                        .revision} · {new Date(
                        event.task.last_update,
                      ).toLocaleString()}</small
                    >
                  </div>
                  <details class="recorded-snapshot">
                    <summary
                      >Event snapshot · revision {event.task.revision}</summary
                    >
                    <pre>{JSON.stringify(event, null, 2)}</pre>
                  </details>
                </article>{/each}
            </div>
          </section>
        {/if}
        {#if reply.selection.view.kind !== "Task"}
          <footer class="page-controls">
            <span
              >Page {reply.selection.page + 1} · recorded tasks and history are paged</span
            >
            <div>
              <button
                class="button"
                disabled={reply.selection.page === 0}
                onclick={() =>
                  dashboard.load(
                    dashboard.pageRequest(reply, reply.selection.page - 1),
                  )}>Previous</button
              ><button
                class="button"
                disabled={dashboard.pageEnd(reply) === "Complete"}
                onclick={() =>
                  dashboard.load(
                    dashboard.pageRequest(reply, reply.selection.page + 1),
                  )}>Next</button
              >
            </div>
          </footer>
        {/if}
      {/key}
    {/if}
  </main>
  {#if dashboard.state.kind === LoadKind.Ready && dashboard.state.reply.content.kind === "Workflow"}<ActivityBar
      flow={dashboard.state.reply.content.value}
    />{:else}<footer class="activity-bar">
      <span class="read-only">Read only · Turso</span>
    </footer>{/if}
</div>

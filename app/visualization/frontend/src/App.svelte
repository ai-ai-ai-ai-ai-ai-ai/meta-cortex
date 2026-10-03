<script lang="ts">
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import type { TaskV2, DesktopRead } from "./contracts";
  import { onMount } from "svelte";
  import { DashboardController, LoadKind } from "./dashboard-state.svelte";
  import { DashboardApi } from "./api";
  import Workflow from "./Workflow.svelte";
  import TaskDetail from "./TaskDetail.svelte";
  import { FlowPresentation } from "./workflow";
  import ActivityBar from "./ActivityBar.svelte";
  const dashboard = new DashboardController(new DashboardApi());
  onMount(() => {
    const request: DesktopRead = { kind: "Initial" };
    dashboard.load(request);
    return () => dashboard.stop();
  });
  let currentFeature = $derived.by(() => {
    switch (dashboard.state.kind) {
      case LoadKind.Ready:
        switch (dashboard.state.reply.selection.view.kind) {
          case "Features":
            return "";
          case "Tasks":
            return dashboard.state.reply.selection.view.feature;
          case "Task":
          case "History":
            return dashboard.state.reply.selection.view.query.feature;
        }
        break;
      case LoadKind.Loading:
      case LoadKind.Failed:
        switch (dashboard.state.request.kind) {
          case "Workflow":
            return dashboard.state.request.feature;
          case "Task":
          case "History":
            return dashboard.state.request.query.feature;
          case "Initial":
          case "Features":
            return "";
        }
    }
  });
  let pageEnd = $derived.by(() => {
    switch (dashboard.state.kind) {
      case LoadKind.Loading:
      case LoadKind.Failed:
        return "Complete";
      case LoadKind.Ready:
        switch (dashboard.state.reply.content.kind) {
          case "Task":
            return "Complete";
          case "Workflow":
            return dashboard.state.reply.content.value.tasks.end;
          case "Features":
          case "History":
            return dashboard.state.reply.content.value.end;
        }
    }
  });
  function loadPage(page: number) {
    switch (dashboard.state.kind) {
      case LoadKind.Loading:
      case LoadKind.Failed:
        return;
      case LoadKind.Ready: {
        const view = dashboard.state.reply.selection.view;
        switch (view.kind) {
          case "Features": {
            const request: DesktopRead = { kind: "Features", page };
            dashboard.load(request);
            return;
          }
          case "Tasks": {
            const request: DesktopRead = {
              kind: "Workflow",
              feature: view.feature,
              page,
            };
            dashboard.load(request);
            return;
          }
          case "History": {
            const request: DesktopRead = {
              kind: "History",
              query: view.query,
              page,
            };
            dashboard.load(request);
            return;
          }
          case "Task":
            return;
        }
      }
    }
  }
</script>

<div
  class="app-shell grid h-dvh grid-cols-[200px_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_38px] max-[800px]:grid-cols-[175px_minmax(0,1fr)] max-[620px]:grid-cols-[65px_minmax(0,1fr)]"
>
  <aside
    class="sidebar row-span-2 flex min-h-0 flex-col border-r border-border bg-sidebar px-3 py-[26px] max-[620px]:px-2 max-[620px]:py-5"
  >
    <Button
      variant="ghost"
      class="brand h-auto min-h-[70px] justify-start gap-2.5 rounded-none bg-transparent px-2.5 pb-7 text-left text-[17px] font-semibold whitespace-normal hover:bg-transparent max-[800px]:gap-[7px] max-[800px]:pl-[3px] max-[800px]:text-sm max-[620px]:min-h-[50px] max-[620px]:px-[7px] max-[620px]:pb-[15px] [&_small]:mt-1 [&_small]:block [&_small]:text-[10px] [&_small]:font-normal [&_small]:tracking-[1.5px] [&_small]:uppercase max-[620px]:[&>div]:hidden"
      onclick={() => {
        const request: DesktopRead = { kind: "Features", page: 0 };
        dashboard.load(request);
      }}
      ><span
        class="brand-mark grid size-[33px] shrink-0 place-items-center text-primary [&_svg]:size-[30px]"
        ><svg
          class="size-[30px]"
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
      <div>Meta-Cortex<small>Workbench</small></div></Button
    >
    <div
      class="sidebar-label flex justify-between px-3 pb-4 text-[11px] text-muted-foreground max-[620px]:hidden"
    >
      Features <span>{dashboard.features.length}</span>
    </div>
    <nav aria-label="Features" class="min-h-0 flex-1 overflow-auto">
      {#each dashboard.features as feature (feature.id)}<Button
          variant="ghost"
          class="group mb-1 h-auto min-h-11 w-full justify-start gap-[9px] rounded-[5px] bg-transparent px-3 py-[11px] text-left font-normal text-muted-foreground hover:bg-secondary data-[selected=true]:bg-selection data-[selected=true]:text-primary data-[selected=true]:shadow-[inset_3px_0_var(--primary)] max-[620px]:justify-center max-[620px]:p-[9px] [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-medium max-[620px]:[&_strong]:hidden"
          data-selected={currentFeature === feature.id}
          aria-label={feature.id}
          title={feature.id}
          onclick={() => {
            const request: DesktopRead = {
              kind: "Workflow",
              feature: feature.id,
              page: 0,
            };
            dashboard.load(request);
          }}
          ><svg
            class="feature-dot size-[19px] shrink-0 group-data-[selected=true]:text-primary max-[620px]:hidden"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"><path d="M3 5h7l2 3h9v11H3z" /></svg
          ><strong>{FlowPresentation.label(feature.id)}</strong><span
            class="feature-short hidden text-[10px] uppercase max-[620px]:inline-block"
            aria-hidden="true">{feature.id.slice(0, 2)}</span
          ></Button
        >{/each}
    </nav>
    <div
      class="sidebar-note border-t border-border px-2.5 pt-[17px] text-[11px] text-primary max-[620px]:hidden [&_small]:mt-1.5 [&_small]:block [&_small]:text-[10px] [&_small]:leading-[1.8]"
    >
      Recorded in Turso<small>Read only · refresh to observe changes</small>
    </div>
  </aside>
  <main class="min-w-0 overflow-auto">
    {#if dashboard.state.kind !== LoadKind.Ready || dashboard.state.reply.content.kind !== "Workflow"}<header
        class="app-header flex items-center justify-between gap-6 px-[25px] pt-[25px] pb-[18px] max-[800px]:px-[22px] max-[800px]:pt-6 max-[620px]:gap-2.5 max-[620px]:px-4 max-[620px]:pt-[23px] max-[620px]:pb-[17px] [&_h1]:text-[28px] [&_h1]:tracking-[-.65px] max-[800px]:[&_h1]:text-[23px] max-[620px]:[&_h1]:text-xl"
      >
        <div>
          <h1 class="font-bold">
            {FlowPresentation.label(currentFeature) || "Workbench"}
          </h1>
          <p class="mt-[7px] text-[13px] text-muted-foreground">
            Recorded work · Turso
          </p>
        </div>
        <Button
          variant="dashboard"
          class="button"
          onclick={() => dashboard.load(dashboard.state.request)}
          >Refresh</Button
        >
      </header>{/if}
    {#if dashboard.state.kind === LoadKind.Loading}<div
        class="empty-state px-6 py-[60px] text-center [&_h2]:text-xl [&_p]:my-[15px] [&_p]:text-xs [&_p]:text-muted-foreground"
      >
        <span class="mb-5 inline-block size-2.5 rounded-full bg-primary"></span>
        <h2 class="font-bold">Reading recorded work…</h2>
      </div>
    {:else if dashboard.state.kind === LoadKind.Failed}<div
        class="empty-state px-6 py-[60px] text-center [&_h2]:text-xl [&_p]:my-[15px] [&_p]:text-xs [&_p]:text-muted-foreground"
      >
        <h2 class="font-bold">Unable to read the ledger</h2>
        <p>{dashboard.state.failure.message}</p>
        <Button
          variant="dashboard"
          class="button"
          onclick={() => dashboard.load(dashboard.state.request)}>Retry</Button
        >
      </div>
    {:else if dashboard.state.kind === LoadKind.Ready}
      {#key JSON.stringify(dashboard.state.reply.selection)}
        {@const reply = dashboard.state.reply}
        {#if reply.content.kind === "Features"}
          <section
            class="feature-catalog px-8 py-[15px] max-[800px]:px-[22px] max-[620px]:px-4"
          >
            <div
              class="section-heading [&_h2]:text-xl [&_p]:mt-2.5 [&_p]:mb-[25px] [&_p]:text-xs [&_p]:text-muted-foreground"
            >
              <h2 class="font-bold">Choose a feature</h2>
              <p>
                Explore its agents, task dependencies, and recorded Git
                integrations.
              </p>
            </div>
            <div class="feature-grid flex flex-col gap-2.5">
              {#each reply.content.value.records as feature (feature.id)}<Button
                  variant="ghost"
                  class="block h-auto w-full rounded-[6px] border border-border bg-card px-[22px] py-[18px] text-left font-normal whitespace-normal hover:border-primary/60 hover:bg-card [&_h3]:mt-[7px] [&_h3]:mb-2 [&_h3]:text-base [&_p]:max-w-[780px] [&_p]:line-clamp-2 [&_p]:text-xs [&_p]:text-muted-foreground [&_code]:mt-3 [&_code]:block [&_code]:text-[10px] [&_code]:text-muted-foreground"
                  onclick={() => {
                    const request: DesktopRead = {
                      kind: "Workflow",
                      feature: feature.id,
                      page: 0,
                    };
                    dashboard.load(request);
                  }}
                  ><span
                    class="eyebrow text-[10px] tracking-[1.3px] text-muted-foreground"
                    >FEATURE</span
                  >
                  <h3 class="font-bold">{feature.id}</h3>
                  <p>{feature.objective}</p>
                  <code>{feature.branch}</code><span
                    class="open-feature mt-[13px] block text-[11px] text-primary"
                    >Open workflow →</span
                  ></Button
                >{/each}
            </div>
          </section>
        {:else if reply.content.kind === "Workflow"}
          <Workflow
            flow={reply.content.value}
            select={(task: TaskV2) => {
              const request: DesktopRead = {
                kind: "Task",
                query: { feature: task.common.feature, task: task.common.id },
              };
              dashboard.load(request);
            }}
            history={(task: TaskV2) => {
              const request: DesktopRead = {
                kind: "History",
                query: { feature: task.common.feature, task: task.common.id },
                page: 0,
              };
              dashboard.load(request);
            }}
            refresh={() => dashboard.load(dashboard.state.request)}
          />
        {:else if reply.content.kind === "Task"}
          {@const task = reply.content.value}
          <TaskDetail
            {task}
            back={() => {
              const request: DesktopRead = {
                kind: "Workflow",
                feature: task.common.feature,
                page: 0,
              };
              dashboard.load(request);
            }}
            history={() => {
              const request: DesktopRead = {
                kind: "History",
                query: { feature: task.common.feature, task: task.common.id },
                page: 0,
              };
              dashboard.load(request);
            }}
          />
        {:else if reply.content.kind === "History"}
          <section
            class="task-detail px-8 py-6 max-[800px]:px-[22px] max-[620px]:px-4 [&>h2]:mt-6 [&>h2]:text-[23px]"
          >
            <Button
              variant="dashboard"
              class="button"
              onclick={() => {
                switch (reply.selection.view.kind) {
                  case "History": {
                    const request: DesktopRead = {
                      kind: "Task",
                      query: reply.selection.view.query,
                    };
                    dashboard.load(request);
                  }
                }
              }}>← Task</Button
            >
            <h2 class="font-bold">Recorded history</h2>
            <div
              class="history-feed mt-6 [&_h3]:mb-2 [&_h3]:text-xs [&_p]:mb-2.5 [&_p]:text-xs [&_p]:text-muted-foreground [&_small]:text-[10px]"
            >
              {#each reply.content.value.records as event (event.task.common.revision)}<article
                  class="mb-[5px] flex flex-wrap gap-5 border-l-2 border-primary/60 bg-card p-5 max-[620px]:gap-2.5 max-[620px]:p-[14px]"
                >
                  <Badge variant="status" class="status">{event.kind}</Badge>
                  <div>
                    <h3 class="font-bold">
                      {event.actor.team} / {event.actor.role}
                    </h3>
                    <p>{event.note}</p>
                    <small
                      >Attempt {event.task.common.attempt} · revision {event
                        .task.common.revision} · {new Date(
                        event.task.common.last_update,
                      ).toLocaleString()}</small
                    >
                  </div>
                  <details
                    class="recorded-snapshot w-full mt-[18px] text-[11px] [&_summary]:cursor-pointer [&_summary]:text-muted-foreground [&_pre]:max-h-[400px] [&_pre]:overflow-auto [&_pre]:bg-code [&_pre]:p-[14px] [&_pre]:text-[11px] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]"
                  >
                    <summary
                      >Event snapshot · revision {event.task.common
                        .revision}</summary
                    >
                    <pre>{JSON.stringify(event, null, 2)}</pre>
                  </details>
                </article>{/each}
            </div>
          </section>
        {/if}
        {#if reply.selection.view.kind !== "Task"}
          <footer
            class="page-controls flex items-center justify-between gap-[15px] px-8 pb-6 text-[10px] text-muted-foreground max-[800px]:px-[22px] max-[620px]:flex-wrap max-[620px]:gap-3 max-[620px]:px-4 max-[620px]:pb-[22px] [&>div]:flex [&>div]:gap-[7px]"
          >
            <span
              >Page {reply.selection.page + 1} · recorded tasks and history are paged</span
            >
            <div>
              <Button
                variant="dashboard"
                class="button min-h-9 px-2.5 py-1.5 text-[11px]"
                disabled={reply.selection.page === 0}
                onclick={() => loadPage(reply.selection.page - 1)}
                >Previous</Button
              ><Button
                variant="dashboard"
                class="button min-h-9 px-2.5 py-1.5 text-[11px]"
                disabled={pageEnd === "Complete"}
                onclick={() => loadPage(reply.selection.page + 1)}>Next</Button
              >
            </div>
          </footer>
        {/if}
      {/key}
    {/if}
  </main>
  {#if dashboard.state.kind === LoadKind.Ready && dashboard.state.reply.content.kind === "Workflow"}<ActivityBar
      flow={dashboard.state.reply.content.value}
    />{:else}<footer
      class="activity-bar col-start-2 flex min-w-0 items-center gap-3 border-t border-border bg-tree px-[25px] text-[11px] text-activity max-[620px]:px-4"
    >
      <span class="read-only ml-auto flex items-center gap-2 whitespace-nowrap"
        >Read only · Turso</span
      >
    </footer>{/if}
</div>

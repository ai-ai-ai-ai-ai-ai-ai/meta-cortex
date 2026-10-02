<script lang="ts">
  import StatusMark from "./StatusMark.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import type { AgentSelection } from "./agent-tree";
  import type { TaskV2 } from "./contracts";
  import { TaskPresentation } from "./task-presentation";
  import { FlowPresentation } from "./workflow";
  import ProgressSummary from "./ProgressSummary.svelte";
  let {
    selection,
    close,
    openTask,
    openHistory,
  }: {
    selection: AgentSelection;
    close: () => void;
    openTask: (task: TaskV2) => void;
    openHistory: (task: TaskV2) => void;
  } = $props();
  let task = $derived(selection.task.task);
  let presentation = $derived(new TaskPresentation(task));
  function focusClose(element: HTMLButtonElement) {
    element.focus();
  }
</script>

<aside
  class="agent-inspector sticky top-4 flex max-h-[calc(100dvh-185px)] min-h-[360px] flex-col overflow-hidden rounded-[7px] border border-panel-border bg-panel max-[1100px]:fixed max-[1100px]:inset-y-0 max-[1100px]:right-0 max-[1100px]:z-30 max-[1100px]:h-dvh max-[1100px]:max-h-none max-[1100px]:min-h-0 max-[1100px]:w-[min(410px,90vw)] max-[1100px]:rounded-none max-[1100px]:border-y-0 max-[1100px]:shadow-[-14px_0_40px_#0005] [&>header]:flex [&>header]:items-center [&>header]:justify-between [&>header]:gap-3 [&>header]:border-b [&>header]:border-border [&>header]:px-[18px] [&>header]:py-5 [&_h2]:mt-[7px] [&_h2]:text-xl [&_h2]:[overflow-wrap:anywhere] max-[1100px]:[&>header]:p-6"
  aria-label={`${selection.group.name()} details`}
>
  <header>
    <div>
      <span class="eyebrow text-[10px] tracking-[1.3px] text-muted-foreground"
        >AGENT DETAILS</span
      >
      <h2 class="font-bold">{selection.group.name()}</h2>
    </div>
    <button
      type="button"
      class="icon-button grid size-10 shrink-0 place-items-center rounded-[4px] bg-transparent text-2xl text-muted-foreground hover:bg-secondary hover:text-primary"
      aria-label="Close agent details"
      onclick={close}
      use:focusClose>×</button
    >
  </header>
  <div
    class="inspector-content overflow-auto p-[18px] max-[1100px]:p-6 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:leading-normal [&>section]:mt-5 [&>section]:border-t [&>section]:border-border [&>section]:pt-5 [&_h4]:mb-[13px] [&_h4]:text-xs [&_h4]:font-semibold [&_h4>span]:ml-[5px] [&_h4>span]:text-[10px] [&_h4>span]:text-muted-foreground [&_dl]:grid [&_dl]:grid-cols-[80px_minmax(0,1fr)] [&_dl]:gap-[13px] [&_dl]:text-[11px] [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere] [&_dd_code]:text-[11px]"
  >
    <div
      class="inspector-state mb-4 flex flex-wrap items-center gap-3 [&>span:last-child]:text-[10px] [&>span:last-child]:text-muted-foreground"
    >
      <Badge variant="status" class="status" data-state={presentation.status()}
        >{presentation.status()}</Badge
      ><span>Attempt {task.common.attempt} · {selection.group.summary()}</span>
    </div>
    <ProgressSummary counts={selection.group.counts()} class="my-4 w-full" />
    <h3>{task.common.objective}</h3>
    <p
      class="inspector-summary mt-3 text-xs leading-[1.7] text-muted-foreground"
    >
      {task.common.progress.summary || "No progress summary recorded."}
    </p>
    {#if presentation.reason()}<p
        class="mt-[15px] border-l-2 border-blocked pl-2.5 text-xs text-blocked"
      >
        {presentation.reason()}
      </p>{/if}
    <section>
      <h4>Recorded tasks <span>{selection.group.tasks.length}</span></h4>
      <div class="inspector-tasks flex flex-col">
        {#each selection.group.tasks as item (item.task.common.id)}<Button
            variant="ghost"
            class="h-auto min-h-[42px] w-full justify-start gap-2.5 rounded-[3px] bg-transparent px-1 py-2 text-left text-[11px] font-normal whitespace-normal hover:bg-selection data-[current=true]:bg-selection [&>span:nth-child(2)]:flex-1 [&>span:nth-child(2)]:[overflow-wrap:anywhere] [&_small]:ml-auto [&_small]:text-[10px] [&_small]:capitalize"
            data-current={item.task.common.id === task.common.id}
            onclick={() => openTask(item.task)}
            ><StatusMark
              state={new TaskPresentation(item.task).status()}
              class="size-[18px] before:text-[11px]"
            /><span>{item.task.common.id}</span><small
              >{new TaskPresentation(item.task).status()}</small
            ></Button
          >{/each}
      </div>
    </section>
    {#if task.common.progress.checks.length > 0}<section>
        <h4>Recorded checks</h4>
        {#each task.common.progress.checks as check, index (index)}<details
            class="inspector-check border-b border-row py-[9px] text-[11px] [&_summary]:flex [&_summary]:min-h-7 [&_summary]:cursor-pointer [&_summary]:items-center [&_summary]:gap-2 [&_code]:min-w-0 [&_code]:flex-1 [&_code]:text-[10px] [&_pre]:max-h-[200px] [&_pre]:overflow-auto [&_pre]:bg-code [&_pre]:p-2 [&_pre]:text-[10px] [&_pre]:leading-[1.7] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]"
          >
            <summary
              ><StatusMark
                state={check.outcome}
                class="size-[18px] before:text-[11px]"
              /><code>{check.command}</code><span
                class="check-outcome text-[9px] text-muted-foreground"
                >{check.outcome}</span
              ></summary
            >
            <pre>{check.evidence}</pre>
          </details>{/each}
      </section>{/if}
    <section>
      <h4>Git evidence</h4>
      <dl>
        <dt>Worker</dt>
        <dd>
          {#if selection.task.worker.kind === "recorded"}
            {selection.task.worker.agent.team} / {selection.task.worker.agent
              .role}
          {:else}Unrecorded{/if}
        </dd>
        <dt>Reports to</dt>
        <dd>{presentation.reportsTo()}</dd>
        <dt>Branch</dt>
        <dd>
          {#if task.workspace.kind === "git"}<code>{task.workspace.branch}</code
            >{:else}{presentation.workspace()}{/if}
        </dd>
        <dt>Checkpoint</dt>
        <dd>
          <code title={presentation.checkpoint()}
            >{presentation.checkpoint().slice(0, 12)}</code
          >
        </dd>
        <dt>Integration</dt>
        <dd>
          <code title={presentation.integration()}
            >{presentation.integration().slice(0, 12)}</code
          >
        </dd>
      </dl>
      {#each [...selection.task.checkpoints, ...selection.task.integrations] as commit (`${commit.revision}:${commit.commit}`)}<div
          class="commit-evidence mt-3 flex flex-wrap gap-2 text-[10px] [&_code]:text-[10px] [&_code]:text-primary [&_span]:text-muted-foreground [&_time]:ml-auto [&_time]:text-muted-foreground"
        >
          <code>{commit.commit.slice(0, 8)}</code><span
            >{commit.actor.role}</span
          ><time>{new Date(commit.at).toLocaleDateString()}</time>
        </div>{/each}
    </section>
    {#if task.common.progress.findings.length > 0}<details
        class="inspector-notes mt-5 border-t border-border pt-[15px] [&_summary]:cursor-pointer [&_summary]:text-[11px] [&_summary]:text-foreground [&_p]:mt-2.5 [&_p]:text-[11px] [&_p]:text-muted-foreground"
      >
        <summary>Findings · {task.common.progress.findings.length}</summary
        >{#each task.common.progress.findings as finding, index (index)}<p>
            {finding}
          </p>{/each}
      </details>{/if}
    {#if task.common.progress.next_steps.length > 0}<details
        class="inspector-notes mt-5 border-t border-border pt-[15px] [&_summary]:cursor-pointer [&_summary]:text-[11px] [&_summary]:text-foreground [&_p]:mt-2.5 [&_p]:text-[11px] [&_p]:text-muted-foreground"
      >
        <summary>Next steps · {task.common.progress.next_steps.length}</summary
        >{#each task.common.progress.next_steps as step, index (index)}<p>
            {step}
          </p>{/each}
      </details>{/if}
    <section>
      <h4>Recent history</h4>
      {#each selection.task.milestones.slice(0, 5) as event (event.revision)}<div
          class="inspector-event grid grid-cols-[minmax(0,1fr)_auto] gap-[5px] border-b border-row py-[9px] text-[10px] [&_span]:leading-[1.6] [&_small]:col-start-1 [&_small]:text-[9px] [&_time]:col-start-2 [&_time]:row-start-1 [&_time]:text-[9px] [&_time]:text-muted-foreground [&_time]:whitespace-nowrap"
        >
          <span>{FlowPresentation.action(event)}</span><small
            >{event.actor.role}</small
          ><time
            >{new Date(event.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}</time
          >
        </div>{/each}{#if selection.task.history_end === "More"}<p
          class="text-muted-foreground"
        >
          Older events are available in full history.
        </p>{/if}
    </section>
    <div class="inspector-actions mt-[22px] flex flex-col gap-[7px]">
      <Button
        variant="dashboard"
        class="button"
        onclick={() => openHistory(task)}>↶ Open full history</Button
      ><Button
        variant="ghost"
        class="text-button h-auto min-h-11 bg-transparent py-3 text-center text-xs font-normal text-primary hover:bg-transparent hover:text-primary"
        onclick={() => openTask(task)}>View full task record →</Button
      >
    </div>
    <details
      class="inspector-notes recorded-snapshot mt-5 border-t border-border pt-[15px] text-[11px] [&_summary]:cursor-pointer [&_summary]:text-foreground [&_pre]:max-h-[400px] [&_pre]:overflow-auto [&_pre]:bg-code [&_pre]:p-[14px] [&_pre]:text-[11px] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]"
    >
      <summary>All recorded fields</summary>
      <pre>{JSON.stringify(task, null, 2)}</pre>
    </details>
  </div>
</aside>

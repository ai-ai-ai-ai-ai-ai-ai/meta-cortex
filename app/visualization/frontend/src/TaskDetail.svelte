<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import type { Task } from "./contracts";
  import { TaskPresentation } from "./task-presentation";
  let {
    task,
    back,
    history,
  }: { task: Task; back: () => void; history: () => void } = $props();
  let presentation = $derived(new TaskPresentation(task));
</script>

<section class="task-detail px-8 py-6 max-[800px]:px-[22px] max-[620px]:px-4">
  <div class="detail-toolbar mb-[25px] flex justify-between gap-3">
    <Button variant="dashboard" class="button" onclick={back}>← Workflow</Button
    ><Button variant="dashboard" class="button" onclick={history}
      >History & attempts</Button
    >
  </div>
  <div
    class="detail-title mb-[25px] flex items-start justify-between gap-[25px] max-[620px]:flex-wrap max-[620px]:gap-3 [&_h2]:mt-2 [&_h2]:mb-3 [&_h2]:text-[23px] [&_p]:max-w-[750px] [&_p]:text-[13px] [&_p]:text-muted-foreground"
  >
    <div>
      <span class="eyebrow text-[10px] tracking-[1.3px] text-muted-foreground"
        >TASK · ATTEMPT {task.attempt}</span
      >
      <h2>{task.id}</h2>
      <p>{task.objective}</p>
    </div>
    <Badge variant="status" class="status" data-state={presentation.status()}
      >{presentation.status()}</Badge
    >
  </div>
  <div class="detail-grid grid grid-cols-2 gap-[18px] max-[800px]:grid-cols-1">
    <Card.Root
      class="detail-card overflow-visible block min-w-0 rounded-[6px] border border-border bg-card p-5 shadow-none ring-0 [&_h3]:mb-[18px] [&_h3]:text-base [&_h4]:mt-5 [&_h4]:mb-2.5 [&_h4]:text-[11px] [&_h4]:text-muted-foreground [&_dl]:grid [&_dl]:grid-cols-[100px_minmax(0,1fr)] [&_dl]:gap-[14px] [&_dl]:text-xs [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere]"
    >
      <h3>Latest contribution</h3>
      <p class="text-sm">{task.progress.summary}</p>
      {#if presentation.reason()}<p
          class="mt-[15px] border-l-2 border-blocked pl-2.5 text-xs text-blocked"
        >
          {presentation.reason()}
        </p>{/if}
      <h4>Findings</h4>
      {#each task.progress.findings as finding, index (index)}<p
          class="finding mb-2.5 border-l-2 border-tree-line pl-3 text-xs"
        >
          {finding}
        </p>{/each}
      <h4>Next steps</h4>
      {#each task.progress.next_steps as step, index (index)}<p
          class="finding mb-2.5 border-l-2 border-tree-line pl-3 text-xs"
        >
          {step}
        </p>{/each}
    </Card.Root>
    <Card.Root
      class="detail-card overflow-visible block min-w-0 rounded-[6px] border border-border bg-card p-5 shadow-none ring-0 [&_h3]:mb-[18px] [&_h3]:text-base [&_h4]:mt-5 [&_h4]:mb-2.5 [&_h4]:text-[11px] [&_h4]:text-muted-foreground [&_dl]:grid [&_dl]:grid-cols-[100px_minmax(0,1fr)] [&_dl]:gap-[14px] [&_dl]:text-xs [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere]"
    >
      <h3>Git evidence</h3>
      <dl>
        <dt>Workspace</dt>
        <dd class="whitespace-pre-wrap">{presentation.workspace()}</dd>
        <dt>Checkpoint</dt>
        <dd><code>{presentation.checkpoint()}</code></dd>
        <dt>Integration</dt>
        <dd><code>{presentation.integration()}</code></dd>
        <dt>Updated</dt>
        <dd>{new Date(task.last_update).toLocaleString()}</dd>
      </dl>
      <p class="mt-[18px] text-[11px] text-muted-foreground">
        Actors recording commits are available in history. Git authorship is not
        recorded.
      </p>
    </Card.Root>
    <Card.Root
      class="detail-card overflow-visible block min-w-0 rounded-[6px] border border-border bg-card p-5 shadow-none ring-0 [&_h3]:mb-[18px] [&_h3]:text-base [&_h4]:mt-5 [&_h4]:mb-2.5 [&_h4]:text-[11px] [&_h4]:text-muted-foreground [&_dl]:grid [&_dl]:grid-cols-[100px_minmax(0,1fr)] [&_dl]:gap-[14px] [&_dl]:text-xs [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere]"
    >
      <h3>Checks <span>{task.progress.checks.length}</span></h3>
      {#each task.progress.checks as check, index (index)}<details
          class="check border-t border-border py-3 [&_summary]:flex [&_summary]:cursor-pointer [&_summary]:items-center [&_summary]:gap-2.5 [&_pre]:bg-code [&_pre]:p-3 [&_pre]:text-[11px] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]"
        >
          <summary
            ><Badge variant="status" class="status" data-state={check.outcome}
              >{check.outcome}</Badge
            ><code>{check.command}</code></summary
          >
          <pre>{check.evidence}</pre>
        </details>{/each}
    </Card.Root>
    <Card.Root
      class="detail-card overflow-visible block min-w-0 rounded-[6px] border border-border bg-card p-5 shadow-none ring-0 [&_h3]:mb-[18px] [&_h3]:text-base [&_h4]:mt-5 [&_h4]:mb-2.5 [&_h4]:text-[11px] [&_h4]:text-muted-foreground [&_dl]:grid [&_dl]:grid-cols-[100px_minmax(0,1fr)] [&_dl]:gap-[14px] [&_dl]:text-xs [&_dt]:text-muted-foreground [&_dd]:m-0 [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere]"
    >
      <h3>Acceptance & dependencies</h3>
      {#each task.acceptance as criterion, index (index)}<p
          class="finding mb-2.5 border-l-2 border-tree-line pl-3 text-xs"
        >
          {criterion}
        </p>{/each}
      <div class="dependency-list mt-5 flex flex-wrap gap-2.5 text-primary">
        {#each task.dependencies as dependency (dependency)}<code
            >{dependency}</code
          >{/each}
      </div>
    </Card.Root>
  </div>
  <details
    class="recorded-snapshot mt-[18px] text-[11px] [&_summary]:cursor-pointer [&_summary]:text-muted-foreground [&_pre]:max-h-[400px] [&_pre]:overflow-auto [&_pre]:bg-code [&_pre]:p-[14px] [&_pre]:text-[11px] [&_pre]:whitespace-pre-wrap [&_pre]:[overflow-wrap:anywhere]"
  >
    <summary>All recorded fields</summary>
    <pre>{JSON.stringify(task, null, 2)}</pre>
  </details>
</section>

<script lang="ts">
  import StatusMark from "./StatusMark.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { Button } from "$lib/components/ui/button";
  import { AgentContribution, TreeExpansion, PanelKind } from "./agent-tree";
  import type { AgentSelection, AgentPanel } from "./agent-tree";
  import { TaskPresentation } from "./task-presentation";
  let {
    group,
    identity,
    select,
    panel,
  }: {
    group: AgentContribution;
    identity: string;
    select: (selection: AgentSelection) => void;
    panel: AgentPanel;
  } = $props();
  let expansion = $state(new TreeExpansion());
  function toggle() {
    expansion = expansion.toggle();
  }
</script>

<li
  class="tree-agent relative border-l border-tree-line last:border-transparent before:absolute before:-left-px before:top-0 before:h-[30px] before:border-l before:border-tree-line after:absolute after:top-[30px] after:left-0 after:w-3 after:border-t after:border-tree-line"
  data-state={group.status()}
>
  <div
    class="agent-row flex min-h-[60px] items-stretch border-t border-row pl-3 pr-[14px] max-[800px]:pl-1.5 max-[800px]:pr-[7px]"
  >
    <Button
      variant="ghost"
      class="disclosure group aria-expanded:bg-transparent aria-expanded:text-muted-foreground grid h-auto w-8 shrink-0 place-items-center rounded-[5px] bg-transparent p-0 text-2xl text-muted-foreground hover:bg-transparent hover:text-primary max-[800px]:w-[30px]"
      aria-label={`Expand ${group.name()} tasks`}
      aria-expanded={expansion.ariaExpanded()}
      onclick={toggle}
      ><span aria-hidden="true" class="group-aria-[expanded=true]:rotate-90"
        >›</span
      ></Button
    >
    <Button
      variant="ghost"
      class="agent-select h-auto whitespace-normal rounded-[5px] font-normal shadow-none grid min-w-0 flex-1 grid-cols-[22px_minmax(0,1fr)_102px_70px] items-center gap-[13px] bg-transparent px-[7px] py-2.5 text-left hover:bg-selection data-[selected=true]:bg-selection max-[800px]:grid-cols-[20px_minmax(0,1fr)_76px] max-[800px]:gap-2 max-[620px]:grid-cols-[18px_minmax(0,1fr)_68px] max-[620px]:gap-[7px] group-data-[inspector=true]:min-[1101px]:max-[1350px]:grid-cols-[24px_minmax(0,1fr)_72px] group-data-[inspector=true]:min-[1101px]:max-[1350px]:gap-2.5"
      data-selected={panel.kind === PanelKind.Agent &&
        panel.origin.startsWith(identity)}
      id={identity}
      onclick={() => select({ group, task: group.latest(), origin: identity })}
    >
      <StatusMark state={group.status()} />
      <div
        class="agent-title min-w-0 [&_strong]:block [&_strong]:text-sm [&_strong]:font-semibold [&_strong]:leading-[1.4] [&_strong]:[overflow-wrap:anywhere] [&_strong_small]:ml-3 [&_strong_small]:text-[10px] [&_strong_small]:font-normal [&>span]:mt-[3px] [&>span]:block [&>span]:max-w-[52ch] [&>span]:truncate [&>span]:text-xs [&>span]:text-muted-foreground max-[620px]:[&_strong]:text-[13px] max-[620px]:[&>span]:text-[11px] group-data-[inspector=true]:min-[1101px]:max-[1350px]:[&>span]:text-[11px]"
      >
        <strong
          >{group.name()}{#if group.tasks.length > 1}<small
              >{group.tasks.length} tasks</small
            >{/if}</strong
        ><span title={group.latest().task.objective}
          >{group.latest().task.objective}</span
        >
      </div>
      <Badge
        variant="status"
        class="status before:text-[13px] before:content-['✓'] data-[state=working]:before:size-[7px] data-[state=working]:before:rounded-full data-[state=working]:before:bg-current data-[state=working]:before:content-[''] data-[state=queued]:before:content-['○'] data-[state=ready]:before:content-['→'] data-[state=cancelled]:before:content-['×'] data-[state=blocked]:before:content-['!']"
        data-state={group.status()}>{group.status()}</Badge
      >
      {#if group.checkpoint() !== "Unrecorded"}<code
          class="row-commit text-right text-xs font-normal text-commit max-[800px]:hidden group-data-[inspector=true]:min-[1101px]:max-[1350px]:hidden"
          title={group.checkpoint()}>{group.checkpoint().slice(0, 7)}</code
        >{:else}<span
          class="row-commit text-right text-xs font-normal text-muted-foreground max-[800px]:hidden group-data-[inspector=true]:min-[1101px]:max-[1350px]:hidden"
          >—</span
        >{/if}
    </Button>
  </div>
  {#if expansion.ariaExpanded()}
    <ul
      class="task-children m-0 ml-[46px] list-none pb-3 pr-[15px] max-[620px]:ml-9 max-[620px]:pr-[7px] [&>li]:relative [&>li]:border-l [&>li]:border-tree-line [&>li]:pl-[18px] [&>li]:before:absolute [&>li]:before:top-[27px] [&>li]:before:left-0 [&>li]:before:w-3 [&>li]:before:border-t [&>li]:before:border-tree-line"
    >
      {#each group.tasks as item (item.task.id)}<li>
          <Button
            variant="ghost"
            class="h-auto min-h-12 w-full justify-start gap-3 rounded-[5px] bg-transparent px-1.5 py-2.5 text-left font-normal whitespace-normal hover:bg-selection max-[620px]:gap-[7px] [&>div]:min-w-0 [&>div]:flex-1 [&_strong]:block [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-medium"
            id={`${identity}:${item.task.id}`}
            onclick={() =>
              select({
                group,
                task: item,
                origin: `${identity}:${item.task.id}`,
              })}
            ><StatusMark
              state={new TaskPresentation(item.task).status()}
              class="size-[18px] before:text-[11px]"
            />
            <div>
              <strong title={`${item.task.id} · ${item.task.objective}`}
                >{item.task.objective}</strong
              >
            </div>
            <Badge
              variant="status"
              class="status border-0 bg-transparent p-0 data-[state=integrated]:bg-transparent data-[state=working]:bg-transparent data-[state=queued]:bg-transparent data-[state=ready]:bg-transparent data-[state=blocked]:bg-transparent data-[state=cancelled]:bg-transparent text-[11px] max-[620px]:text-[9px] before:text-[13px] before:content-['✓'] data-[state=working]:before:size-[7px] data-[state=working]:before:rounded-full data-[state=working]:before:bg-current data-[state=working]:before:content-[''] data-[state=queued]:before:content-['○'] data-[state=ready]:before:content-['→'] data-[state=cancelled]:before:content-['×'] data-[state=blocked]:before:content-['!']"
              data-state={new TaskPresentation(item.task).status()}
              >{new TaskPresentation(item.task).childStatus()}</Badge
            ></Button
          >
        </li>{/each}
    </ul>
  {/if}
</li>

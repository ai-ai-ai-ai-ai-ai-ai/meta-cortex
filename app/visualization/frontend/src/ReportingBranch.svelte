<script lang="ts">
  import * as Collapsible from "$lib/components/ui/collapsible";
  import type { Option } from "effect";
  import { Button } from "$lib/components/ui/button";
  import { Badge } from "$lib/components/ui/badge";
  import { ActivityKind } from "./agent-tree";
  import type { ReportingNode, AgentSelection } from "./agent-tree";
  import TreeAgent from "./TreeAgent.svelte";
  import ReportingBranch from "./ReportingBranch.svelte";
  import ProgressSummary from "./ProgressSummary.svelte";
  import StatusMark from "./StatusMark.svelte";
  interface ReportingBranchProperties {
    node: ReportingNode;
    select: (selection: AgentSelection) => void;
    selection: Option.Option<AgentSelection>;
  }
  let { node, select, selection }: ReportingBranchProperties = $props();
  let identity = $derived(`reporting:${node.id().serialize()}`);
</script>

{#if node.children.length === 0 && node.activity.kind === ActivityKind.Recorded}
  <TreeAgent group={node.activity.group} {identity} {select} {selection} />
{:else}
  <Collapsible.Root open>
    {#snippet child({ props })}
      <li {...props} class="border-b border-border last:border-b-0">
        <div
          class="grid grid-cols-[minmax(0,1fr)] items-center gap-x-3 bg-delegation px-3 @min-[620px]:grid-cols-[minmax(0,1fr)_210px]"
        >
          <div class="flex min-h-[60px] min-w-0 items-stretch">
            <Collapsible.Trigger
              class="group grid h-auto w-8 shrink-0 place-items-center rounded-[5px] bg-transparent p-0 text-2xl text-muted-foreground hover:bg-transparent hover:text-primary data-[state=open]:bg-transparent data-[state=open]:text-muted-foreground"
              aria-label={`Expand ${node.name()} reporting children`}
            >
              <span aria-hidden="true" class="group-data-[state=open]:rotate-90"
                >›</span
              >
            </Collapsible.Trigger>
            {#if node.activity.kind === ActivityKind.Recorded}
              {@const group = node.activity.group}
              {@const representative = group.latest()}
              {@const checkpoint = representative.task.common.checkpoint}
              <Button
                variant="ghost"
                class="grid h-auto min-w-0 flex-1 grid-cols-[20px_minmax(0,1fr)_68px] items-center gap-2 rounded-[5px] bg-transparent px-1.5 py-2.5 text-left font-normal whitespace-normal hover:bg-selection data-[selected=true]:bg-selection @min-[800px]:grid-cols-[20px_minmax(0,1fr)_68px_58px]"
                id={`${identity}:own`}
                data-selected={selection._tag === "Some" &&
                  selection.value.origin === `${identity}:own`}
                onclick={() => {
                  const nextSelection: AgentSelection = {
                    group,
                    task: representative,
                    origin: `${identity}:own`,
                  };
                  select(nextSelection);
                }}
              >
                <StatusMark state={group.status()} />
                <span class="min-w-0">
                  <strong
                    class="block text-sm font-semibold [overflow-wrap:anywhere]"
                    >{node.name()}<small
                      class="ml-2 text-[9px] font-normal text-muted-foreground"
                      >{group.tasks.length} own activities</small
                    ></strong
                  >
                  <span
                    class="mt-0.5 block truncate text-[11px] text-muted-foreground"
                    title={representative.task.common.objective}
                    >{representative.task.common.objective}</span
                  >
                </span>
                <Badge
                  variant="status"
                  class="status"
                  data-state={group.status()}>{group.status()}</Badge
                >
                {#if checkpoint.kind === "git"}<code
                    class="hidden text-right text-[11px] font-normal text-commit @min-[800px]:block"
                    title={checkpoint.commit}
                    >{checkpoint.commit.slice(0, 7)}</code
                  >
                {:else}<span
                    class="hidden text-right text-[11px] text-muted-foreground @min-[800px]:block"
                    >—</span
                  >{/if}
              </Button>
            {:else}
              <div class="min-w-0 flex-1 self-center px-1.5 py-2.5">
                <strong
                  class="block text-sm font-semibold [overflow-wrap:anywhere]"
                  >{node.name()}</strong
                >
                <span class="mt-0.5 block text-[10px] text-muted-foreground"
                  >No activity on this page</span
                >
              </div>
            {/if}
          </div>
          {#if node.children.length > 0}
            <div class="ml-[38px] pb-3 @min-[620px]:ml-0 @min-[620px]:py-2.5">
              <p class="mb-1.5 text-[9px] text-muted-foreground">
                Descendant activities · loaded page
              </p>
              <ProgressSummary
                counts={node.descendantCounts()}
                class="w-full"
              />
            </div>
          {/if}
        </div>
        <Collapsible.Content hiddenUntilFound={false}>
          <ul
            id={identity}
            class="m-0 list-none border-l border-tree-line pl-5 max-[800px]:pl-[18px]"
          >
            {#each node.children as child (child.id().serialize())}
              <ReportingBranch node={child} {select} {selection} />
            {/each}
          </ul>
        </Collapsible.Content>
      </li>
    {/snippet}
  </Collapsible.Root>
{/if}

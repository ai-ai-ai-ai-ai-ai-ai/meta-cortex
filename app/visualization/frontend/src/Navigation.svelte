<script lang="ts">
  import {
    Box,
    LayoutDashboard,
    Workflow,
    Database,
    Search,
  } from "@lucide/svelte";
  import * as Sidebar from "$lib/components/ui/sidebar";
  import { Input } from "$lib/components/ui/input";
  import type { Feature } from "./contracts";
  let {
    features,
    selected,
    navigate,
    overview,
  }: {
    features: Feature[];
    selected: string;
    navigate: (feature: string) => void;
    overview: () => void;
  } = $props();
  let search = $state("");
  const sidebar = Sidebar.useSidebar();
  let filtered = $derived(
    features.filter((feature) =>
      `${feature.id} ${feature.objective}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ),
  );
  function choose(feature: string) {
    navigate(feature);
    sidebar.setOpenMobile(false);
  }
</script>

<Sidebar.Root>
  <Sidebar.Header class="gap-4 p-4">
    <div class="flex items-center gap-3">
      <Box class="size-7" />
      <div>
        <p class="font-semibold">Meta-Cortex</p>
        <p class="text-xs text-muted-foreground">Workbench</p>
      </div>
    </div>
    <label for="workflow-search" class="sr-only">Search workflows</label>
    <div class="relative">
      <Search class="absolute top-2.5 left-3 size-4 text-muted-foreground" />
      <Input
        id="workflow-search"
        bind:value={search}
        placeholder="Search workflows…"
        class="pl-9"
      />
    </div>
  </Sidebar.Header>
  <Sidebar.Content>
    <nav aria-label="Workflow navigation">
      <Sidebar.Group>
        <Sidebar.Menu
          ><Sidebar.MenuItem>
            <Sidebar.MenuButton
              isActive={!selected}
              onclick={() => {
                overview();
                sidebar.setOpenMobile(false);
              }}
              class="min-h-11"
            >
              <LayoutDashboard /><span>All workflows</span>
            </Sidebar.MenuButton>
          </Sidebar.MenuItem></Sidebar.Menu
        >
      </Sidebar.Group>
      <Sidebar.Group>
        <Sidebar.GroupLabel
          >Workflows · {features.length} loaded</Sidebar.GroupLabel
        >
        <Sidebar.Menu>
          {#each filtered as feature (feature.id)}
            <Sidebar.MenuItem>
              <Sidebar.MenuButton
                isActive={selected === feature.id}
                onclick={() => choose(feature.id)}
                title={feature.objective}
                class="min-h-11"
              >
                <Workflow /><span>{feature.id}</span>
              </Sidebar.MenuButton>
            </Sidebar.MenuItem>
          {:else}<p class="p-3 text-sm text-muted-foreground">
              No matching workflows.
            </p>{/each}
        </Sidebar.Menu>
      </Sidebar.Group>
    </nav>
  </Sidebar.Content>
  <Sidebar.Footer class="border-t p-4">
    <div class="flex items-center gap-3 text-sm text-muted-foreground">
      <Database class="size-4" />
      <div>
        <p>Local Turso ledger</p>
        <p class="text-xs">Read-only observation</p>
      </div>
    </div>
  </Sidebar.Footer>
</Sidebar.Root>

<script lang="ts">
  import Dashboard from "./Dashboard.svelte";
  import AgentGuidePage from "./AgentGuidePage.svelte";
  import { GuideRoute } from "./agent-guide";
  import { GuideNavigation } from "./guide-state.svelte";
  const navigation = new GuideNavigation();
</script>

{#if navigation.route === GuideRoute.Guide}
  <AgentGuidePage onback={() => navigation.dashboard()} />
{:else}
  <Dashboard onguide={() => navigation.guide()} />
{/if}
